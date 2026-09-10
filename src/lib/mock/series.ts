import { rngFrom } from "./rng";
import { TOPICS, CLAIMS, NOW } from "./content";
import type {
  Filters,
  Kpis,
  VolumePoint,
  Topic,
  EmotionPoint,
  TopicSentimentRow,
  SentimentShiftEvent,
  Claim,
  Topic as TopicT,
} from "./types";

/** How strongly a topic matches the current language filter (0..1). */
function languageWeight(topic: Topic, languages: string[]): number {
  if (languages.length === 0) return 1;
  const overlap = topic.languages.filter((l) => languages.includes(l)).length;
  if (overlap === 0) return 0.08; // residual multilingual spillover
  return 0.55 + 0.45 * (overlap / languages.length);
}

/** Search relevance: query tokens vs topic label/gloss/category. */
function searchWeight(topic: Topic, query: string): number {
  const q = query.trim().toLowerCase();
  if (!q) return 1;
  const haystack = `${topic.label} ${topic.gloss} ${topic.category} ${topic.id}`.toLowerCase();
  const tokens = q.split(/\s+/).filter(Boolean);
  const hits = tokens.filter((tk) => haystack.includes(tk.replace(/^[#:]/, ""))).length;
  if (hits === 0) return 0;
  return 0.4 + 0.6 * (hits / tokens.length);
}

/** Topics surviving current filters, with their effective weight. */
export function effectiveTopics(filters: Filters): { topic: Topic; weight: number }[] {
  return TOPICS.map((topic) => {
    const lw = languageWeight(topic, filters.languages);
    const sw = searchWeight(topic, filters.query);
    return { topic, weight: lw * sw };
  }).filter((t) => t.weight > 0.05);
}

/** Range → bucket config. */
function rangeConfig(filters: Filters) {
  switch (filters.range) {
    case "24h":
      return { points: 24, stepMs: 3.6e6, kind: "hour" as const };
    case "7d":
      return { points: 56, stepMs: 1.08e7, kind: "3h" as const }; // 3h buckets
    case "custom":
      return { points: Math.min(90, Math.max(3, filters.customDays)), stepMs: 8.64e7, kind: "day" as const };
    default:
      return { points: 30, stepMs: 8.64e7, kind: "day" as const };
  }
}

/** Cycle multiplier: humans sleep, feeds don't. */
function cycleFactor(hourOfDay: number, kind: "hour" | "3h" | "day"): number {
  if (kind === "day") return 1;
  const h = hourOfDay;
  const morning = Math.exp(-Math.pow(h - 9.5, 2) / 8);
  const lunch = Math.exp(-Math.pow(h - 13.5, 2) / 6) * 0.7;
  const evening = Math.exp(-Math.pow(h - 20.5, 2) / 10) * 1.25;
  return 0.35 + morning * 0.5 + lunch * 0.35 + evening * 0.9;
}

function pointLabel(t: number, kind: "hour" | "3h" | "day"): string {
  const d = new Date(t);
  if (kind === "day") {
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
  }
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false });
}

/** Volume multiplier for platform filter. */
function platformFactor(topic: Topic, platform: Filters["platform"]): number {
  if (platform === "all") return 1;
  return platform === "x" ? topic.xShare : 1 - topic.xShare;
}

/** Single-topic series with spikes, baseline & sentiment band. */
export function getTopicSeries(topic: Topic, filters: Filters): VolumePoint[] {
  const cfg = rangeConfig(filters);
  const rng = rngFrom("series", topic.id, filters.range, filters.platform, filters.languages.join(","), filters.customDays);
  const end = NOW;
  const points: VolumePoint[] = [];
  const pf = platformFactor(topic, filters.platform);
  const lw = languageWeight(topic, filters.languages);

  for (let i = 0; i < cfg.points; i++) {
    const t = end - (cfg.points - 1 - i) * cfg.stepMs;
    const d = new Date(t);
    const hour = d.getHours();
    const dow = d.getDay();
    const weekend = cfg.kind === "day" && (dow === 0 || dow === 6) ? 0.78 : 1;

    // Spike injection: topic.spikeDay measured back from today
    let spikeBoost = 1;
    if (cfg.kind === "day" && topic.spikeDay !== null) {
      const dayIndex = cfg.points - 1 - i; // 0 = today
      const dist = Math.abs(dayIndex - topic.spikeDay);
      spikeBoost *= 1 + (topic.emerging ? 3.4 : 2.2) * Math.exp(-Math.pow(dist, 2) / 2.2);
    }
    if (cfg.kind !== "day" && topic.spikeHour !== null && filters.range === "24h") {
      const hourIndex = cfg.points - 1 - i;
      const dist = Math.abs(hourIndex - topic.spikeHour);
      spikeBoost *= 1 + (topic.emerging ? 2.8 : 1.8) * Math.exp(-Math.pow(dist, 2) / 3);
    }

    const noise = 1 + rng.gauss(0, 0.09);
    const total =
      topic.baseVolume * pf * lw * cycleFactor(hour, cfg.kind) * weekend * spikeBoost * noise * (0.9 + 0.1 * Math.sin(i / 5));

    // Baseline: same signal without noise/spike
    const baseline =
      topic.baseVolume * pf * lw * cycleFactor(hour, cfg.kind) * weekend * 0.94;

    // Sentiment drift: spikes polarise high-risk topics
    const spikePolarise = Math.min(1, (spikeBoost - 1) / 2) * topic.risk;
    const pos = Math.max(0.02, topic.sentiment.positive - spikePolarise * 0.14 + rng.gauss(0, 0.015));
    const neg = Math.max(0.02, topic.sentiment.negative + spikePolarise * 0.2 + rng.gauss(0, 0.018));
    const neu = Math.max(0.02, 1 - pos - neg);
    const norm = pos + neg + neu;

    points.push({
      t,
      label: pointLabel(t, cfg.kind),
      total: Math.round(total),
      x: Math.round(total * topic.xShare),
      telegram: Math.round(total * (1 - topic.xShare)),
      positive: Math.round((total * pos) / norm),
      neutral: Math.round((total * neu) / norm),
      negative: Math.round((total * neg) / norm),
      baseline: Math.round(baseline),
      spike: total > baseline * (topic.emerging ? 1.9 : 2.4),
    });
  }
  return points;
}

/** Aggregate conversation series across surviving topics. */
export function getVolumeSeries(filters: Filters): VolumePoint[] {
  const cfg = rangeConfig(filters);
  const topics = effectiveTopics(filters);
  if (topics.length === 0) {
    // empty result grid
    const end = NOW;
    return Array.from({ length: cfg.points }, (_, i) => {
      const t = end - (cfg.points - 1 - i) * cfg.stepMs;
      return {
        t,
        label: pointLabel(t, cfg.kind),
        total: 0,
        x: 0,
        telegram: 0,
        positive: 0,
        neutral: 0,
        negative: 0,
        baseline: 0,
        spike: false,
      };
    });
  }
  const perTopic = topics.map(({ topic }) => getTopicSeries(topic, filters));
  return perTopic[0].map((_, idx) => {
    const acc = perTopic.reduce(
      (a, series) => {
        const p = series[idx];
        a.total += p.total;
        a.x += p.x;
        a.telegram += p.telegram;
        a.positive += p.positive;
        a.neutral += p.neutral;
        a.negative += p.negative;
        a.baseline += p.baseline;
        if (p.spike) a.spike = true;
        return a;
      },
      { total: 0, x: 0, telegram: 0, positive: 0, neutral: 0, negative: 0, baseline: 0, spike: false }
    );
    return {
      t: perTopic[0][idx].t,
      label: perTopic[0][idx].label,
      total: acc.total,
      x: acc.x,
      telegram: acc.telegram,
      positive: acc.positive,
      neutral: acc.neutral,
      negative: acc.negative,
      baseline: acc.baseline,
      spike: acc.total > acc.baseline * 1.6,
    };
  });
}

/** Filter-aware KPI block. */
export function getKpis(filters: Filters): Kpis {
  const series = getVolumeSeries(filters);
  const topics = effectiveTopics(filters);
  const half = Math.max(1, Math.floor(series.length / 2));
  const recent = series.slice(-half);
  const prior = series.slice(0, half);

  const sum = (arr: VolumePoint[], k: keyof VolumePoint) =>
    arr.reduce((a, p) => a + (p[k] as number), 0);

  const postsTracked = sum(series, "total");
  const avgSentiment =
    postsTracked > 0 ? (sum(recent, "positive") - sum(recent, "negative")) / Math.max(1, sum(recent, "total")) : 0;
  const priorSentiment =
    postsTracked > 0 ? (sum(prior, "positive") - sum(prior, "negative")) / Math.max(1, sum(prior, "total")) : 0;

  // Rough scaling: series buckets represent the sampled window
  const windowScale =
    filters.range === "24h" ? 1 : filters.range === "7d" ? 1 : filters.range === "custom" ? 1 / filters.customDays : 1 / 30;

  const xTotal = sum(series, "total") > 0 ? sum(series.slice(-half), "x") / Math.max(1, sum(recent, "total")) : 0.65;

  return {
    postsTracked: Math.round(postsTracked * (windowScale === 1 ? 1 : 1) || 0),
    activeNarratives: topics.filter((t) => t.topic.change24h > 5).length || topics.length,
    avgSentiment,
    sentimentDelta: avgSentiment - priorSentiment,
    highRiskAlerts: 4,
    botShare: 0.08 + (filters.platform === "telegram" ? 0.05 : 0) + (filters.query.includes("bot") ? 0.02 : 0),
    xShare: xTotal,
    telegramShare: 1 - xTotal,
  };
}

/** Emotion mix for radar chart. */
export function getEmotions(filters: Filters): EmotionPoint[] {
  const rng = rngFrom("emotions", filters.platform, filters.range, filters.languages.join(","));
  const base: Record<string, number> = {
    Support: 34,
    Opposition: 27,
    Anxiety: 14,
    Anger: 11,
    Joy: 9,
    Curiosity: 5,
  };
  return Object.entries(base).map(([emotion, value]) => ({
    emotion,
    value: Math.round(Math.min(60, Math.max(2, value + rng.gauss(0, 3)))),
    delta: Number(rng.gauss(0, 6).toFixed(1)),
  }));
}

/** Topic-level sentiment comparison table. */
export function getTopicSentimentTable(filters: Filters): TopicSentimentRow[] {
  return effectiveTopics(filters)
    .map(({ topic }) => {
      const series = getTopicSeries(topic, filters);
      const half = Math.max(1, Math.floor(series.length / 2));
      const recent = series.slice(-half);
      const prior = series.slice(0, half);
      const vol = recent.reduce((a, p) => a + p.total, 0);
      const pos = recent.reduce((a, p) => a + p.positive, 0);
      const neg = recent.reduce((a, p) => a + p.negative, 0);
      const neu = Math.max(0, vol - pos - neg);
      const net = vol > 0 ? (pos - neg) / vol : 0;
      const pvol = prior.reduce((a, p) => a + p.total, 0);
      const ppos = prior.reduce((a, p) => a + p.positive, 0);
      const pneg = prior.reduce((a, p) => a + p.negative, 0);
      const pnet = pvol > 0 ? (ppos - pneg) / pvol : 0;
      return {
        topicId: topic.id,
        label: topic.label,
        volume: vol,
        positive: vol > 0 ? pos / vol : 0,
        neutral: vol > 0 ? neu / vol : 0,
        negative: vol > 0 ? neg / vol : 0,
        net,
        shift: net - pnet,
      };
    })
    .sort((a, b) => b.volume - a.volume);
}

/** Detected sharp sentiment flips within the window. */
export function getSentimentShifts(filters: Filters): SentimentShiftEvent[] {
  const series = getVolumeSeries(filters);
  const events: SentimentShiftEvent[] = [];
  const netAt = (p: VolumePoint) => (p.positive - p.negative) / Math.max(1, p.total);
  for (let i = 4; i < series.length; i += 2) {
    const before = netAt(series[i - 4]);
    const after = netAt(series[i]);
    if (Math.abs(after - before) > 0.16) {
      events.push({
        id: `SHF-${i}`,
        topicLabel: "aggregate feed",
        from: before,
        to: after,
        windowLabel: `${series[i - 4].label} → ${series[i].label}`,
        t: series[i].t,
        note:
          after > before
            ? "Positive recovery — verified counter-narrative gained traction"
            : "Negative swing — anxiety-classified posts compounding",
      });
    }
  }
  return events.slice(0, 6);
}

/** Claims enriched with deterministic spread timelines. */
export function getClaims(filters: Filters): Claim[] {
  return CLAIMS.map((claim) => {
    const rng = rngFrom("claim", claim.id, filters.platform);
    const topic = TOPICS.find((t) => t.id === claim.topicId);
    const platformShift = filters.platform === "x" ? 1.25 : filters.platform === "telegram" ? 0.85 : 1;
    const steps = Math.max(8, Math.min(24, Math.round(claim.spreadHours / 2.5)));
    let xReach = 0;
    let tgReach = 0;
    const spread: Claim["spread"] = [];
    for (let i = 0; i <= steps; i++) {
      const hour = (claim.spreadHours * i) / steps;
      const curve = Math.pow(i / steps, 2.1);
      xReach = Math.round(claim.totalReach * 0.68 * curve * platformShift * (0.9 + rng.next() * 0.2));
      tgReach = Math.round(claim.totalReach * 0.32 * curve * (0.9 + rng.next() * 0.2));
      spread.push({ hour: Math.round(hour), xReach, tgReach });
    }
    const events: Claim["events"] = [
      {
        hour: 0,
        platform: "x",
        reach: Math.round(claim.totalReach * 0.01),
        botShare: claim.botCorrelation,
        note: "Origin post detected",
      },
      {
        hour: Math.round(claim.spreadHours * 0.2),
        platform: "telegram",
        reach: Math.round(claim.totalReach * 0.12),
        botShare: Math.min(1, claim.botCorrelation + 0.07),
        note: "Forward-burst across regional channels",
      },
      {
        hour: Math.round(claim.spreadHours * 0.55),
        platform: "x",
        reach: Math.round(claim.totalReach * 0.45),
        botShare: Math.max(0.1, claim.botCorrelation - 0.12),
        note: "Peak velocity — quote-posts compounding",
      },
      {
        hour: Math.round(claim.spreadHours * 0.85),
        platform: "telegram",
        reach: Math.round(claim.totalReach * 0.28),
        botShare: Math.max(0.08, claim.botCorrelation - 0.2),
        note: "Fact-check counter-narrative injected",
      },
    ];
    return {
      ...claim,
      firstSeen: claim.firstSeen,
      spread,
      events,
      totalReach: xReach + tgReach,
      topicLabel: topic?.label,
    } as Claim;
  }).filter((c) => {
    if (!filters.query) return true;
    const q = filters.query.toLowerCase();
    return (
      c.text.toLowerCase().includes(q) ||
      (c.translation ?? "").toLowerCase().includes(q) ||
      (TOPICS.find((t) => t.id === c.topicId)?.label ?? "").toLowerCase().includes(q)
    );
  });
}

export { NOW };
export type { TopicT };
