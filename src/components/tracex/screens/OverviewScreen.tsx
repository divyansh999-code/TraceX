"use client";

/**
 * OVERVIEW — the Intelligence Fusion Dashboard.
 * Mission control: KPIs, volume × sentiment band, live alert feed,
 * trending narratives, network preview, module pipeline strip.
 */
import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/lib/app-state";
import {
  getKpis,
  getVolumeSeries,
  effectiveTopics,
  getTopicSeries,
  getNetwork,
  getInfluencers,
  NOW,
} from "@/lib/mock";
import { fmtCompact, fmtNet, relTime, riskTone, sentimentTone, fmtSigned, fmtFull } from "@/lib/fmt";
import { cn } from "@/lib/utils";
import { Panel, Badge, Delta, ScoreBar, SeverityDot, LiveDot, Legend, Taxonomy } from "../common/primitives";
import { KpiCard } from "../common/KpiCard";
import { Sparkline } from "../common/Sparkline";
import { ScreenHeader } from "../common/ScreenHeader";
import { ChartTooltip, CHART, GRID, useChartTheme } from "../common/ChartBits";
import { useRefresh, useNow, KpiRowSkeleton, PanelSkeleton } from "../common/Skeletons";
import { HeatCalendar, type HeatDay } from "../common/HeatCalendar";
import { DayDossier } from "../common/DayDossier";
import { TimeMachine } from "../common/TimeMachine";
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceDot,
  ReferenceLine,
} from "recharts";
import {
  Database,
  GitBranch,
  HeartPulse,
  Radar,
  Bot,
  Share2,
  ShieldAlert,
  Layers,
  Flame,
  ArrowUpRight,
  Users,
  MessageSquare,
  Fingerprint,
  Cpu,
  History,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { ScreenId } from "@/lib/mock/types";

const WINDOW_LABEL: Record<string, string> = {
  "24h": "last 24 hours",
  "7d": "last 7 days",
  "30d": "last 30 days",
  custom: "custom window",
};

/* ---------------- Live alert feed ---------------- */

/** Consumes the shared live-alert bus (app-state): the shell-level feed
 *  singleton generates arrivals, fires the audio cue on every screen and
 *  publishes here — so this panel, the top-bar bell and the tab-title
 *  unread count all render ONE stream (no per-screen timers). Fresh rows
 *  animate in via their keyed `feed-arrival` class. */
function LiveAlertFeed() {
  const { go, alertsFeed } = useApp();
  const now = useNow(15_000);

  return (
    <Panel
      title="Live alert feed"
      sub="auto-refresh"
      icon={Radar}
      className="min-h-0"
      bodyClassName="p-0"
      right={<LiveDot />}
    >
      <div className="max-h-[420px] overflow-y-auto divide-y divide-border/60">
        {alertsFeed.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => a.linkScreen && go(a.linkScreen)}
            title={`${a.id} — ${a.title}: ${a.detail}`}
            className="feed-arrival w-full text-left px-4 py-2.5 hover:bg-accent transition-colors cursor-pointer group"
          >
            <div className="flex items-center gap-2">
              <SeverityDot severity={a.severity} />
              <span className="text-xs font-medium text-foreground truncate group-hover:text-primary transition-colors">
                {a.title}
              </span>
              <span className="ml-auto font-mono text-[10px] tnum text-muted-foreground/70 shrink-0">
                {relTime(a.t, now ? now.getTime() : NOW)}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-2 pl-4">
              <Badge
                tone={
                  a.type === "spike"
                    ? "orange"
                    : a.type === "bot-cluster"
                      ? "red"
                      : a.type === "misinformation"
                        ? "amber"
                        : "cyan"
                }
                className="shrink-0"
              >
                {a.type}
              </Badge>
              <span className="text-[11px] text-muted-foreground truncate" title={a.detail}>
                {a.detail}
              </span>
            </div>
          </button>
        ))}
      </div>
    </Panel>
  );
}

/* ---------------- Network preview (static mini graph) ---------------- */

function NetworkPreview() {
  const { go } = useApp();
  const { filters } = useApp();
  const { nodes, edges, communities } = useMemo(() => getNetwork(filters), [filters]);
  const influencers = useMemo(() => getInfluencers(filters, 3), [filters]);

  const W = 360;
  const H = 210;
  const layout = useMemo(() => {
    const top = [...nodes].sort((a, b) => b.pageRank - a.pageRank).slice(0, 16);
    const ids = new Set(top.map((n) => n.id));
    const subEdges = edges.filter((e) => ids.has(e.source) && ids.has(e.target)).slice(0, 26);
    // deterministic radial-ish layout
    const placed = top.map((n, i) => {
      const angle = (i / top.length) * Math.PI * 2 + (n.id.charCodeAt(4) % 10) * 0.06;
      const radius = n.pageRank > 0.06 ? 0.28 : n.pageRank > 0.04 ? 0.55 : 0.82;
      return {
        ...n,
        x: W / 2 + Math.cos(angle) * radius * (W / 2 - 18),
        y: H / 2 + Math.sin(angle) * radius * (H / 2 - 14),
      };
    });
    return { placed, subEdges };
  }, [nodes, edges]);

  const byId = new Map(layout.placed.map((n) => [n.id, n]));
  const communityColor = (id: string) => communities.find((c) => c.id === id)?.color ?? "#5FA1C4";

  return (
    <Panel
      title="Influence network"
      sub="preview"
      icon={Share2}
      right={
        <Button
          variant="outline"
          size="sm"
          className="h-6 px-2 text-[10px] gap-1"
          onClick={() => go("network")}
        >
          Open graph <ArrowUpRight className="size-3" />
        </Button>
      }
    >
      <button
        type="button"
        onClick={() => go("network")}
        className="w-full block cursor-pointer group"
        aria-label="Open full network analysis"
      >
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full group-hover:opacity-90 transition-opacity">
          {layout.subEdges.map((e, i) => {
            const a = byId.get(e.source);
            const b = byId.get(e.target);
            if (!a || !b) return null;
            return (
              <line
                key={i}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke="#232838"
                strokeWidth={Math.max(0.6, e.weight / 6)}
              />
            );
          })}
          {layout.placed.map((n) => {
            const r = 3 + Math.sqrt(n.pageRank) * 34;
            const bot = n.botProb > 0.6;
            return (
              <g key={n.id}>
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={r}
                  fill={communityColor(n.communityId)}
                  fillOpacity={0.85}
                  stroke={bot ? CHART.red : "none"}
                  strokeWidth={bot ? 1.4 : 0}
                />
                {n.botProb > 0.6 && (
                  <circle cx={n.x} cy={n.y} r={r + 2.5} fill="none" stroke={CHART.red} strokeOpacity={0.35} />
                )}
              </g>
            );
          })}
        </svg>
      </button>
      <div className="mt-3 space-y-2">
        <Taxonomy>Top influencers</Taxonomy>
        {influencers.map((inf) => (
          <div key={inf.nodeId} className="flex items-center gap-2 text-xs">
            <span className="size-2 rounded-[2px] shrink-0" style={{ background: inf.communityColor }} />
            <span className="font-mono text-[11px] text-foreground truncate">{inf.handle}</span>
            <span className="ml-auto font-mono text-[10px] tnum text-muted-foreground shrink-0">
              PR {inf.pageRank.toFixed(3)}
            </span>
            <span className="font-mono text-[10px] tnum text-muted-foreground shrink-0 w-12 text-right">
              {fmtCompact(inf.reach)}
            </span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

/* ---------------- Module pipeline strip ---------------- */

const MODULES: { icon: typeof Database; name: string; metric: string; spark: number[]; screen: ScreenId }[] = [
  { icon: Database, name: "API Ingestion", metric: "12.4k/min", spark: [8, 9, 11, 10, 12, 13, 12, 14, 13, 15], screen: "overview" },
  { icon: Fingerprint, name: "Demographics", metric: "k≥50", spark: [5, 6, 5, 7, 6, 6, 7, 6, 7, 7], screen: "demographics" },
  { icon: HeartPulse, name: "Sentiment", metric: "7 langs", spark: [4, 5, 6, 5, 6, 7, 6, 7, 8, 7], screen: "sentiment" },
  { icon: Flame, name: "Trend Detection", metric: "z>2.5", spark: [3, 5, 4, 6, 8, 7, 9, 11, 10, 12], screen: "trends" },
  { icon: Bot, name: "Bot Detection", metric: "5k sample", spark: [2, 3, 2, 4, 3, 5, 4, 6, 5, 6], screen: "bots" },
  { icon: Share2, name: "Network Analysis", metric: "90 nodes", spark: [6, 6, 7, 7, 8, 8, 9, 8, 9, 10], screen: "network" },
  { icon: ShieldAlert, name: "Misinformation", metric: "10 claims", spark: [4, 5, 7, 6, 8, 9, 8, 10, 11, 12], screen: "misinfo" },
  { icon: Layers, name: "Intelligence Fusion", metric: "this view", spark: [7, 8, 8, 9, 10, 9, 10, 11, 12, 13], screen: "overview" },
];

function ModuleStrip() {
  const { go } = useApp();
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3">
      {MODULES.map((m) => (
        <button
          key={m.name}
          type="button"
          onClick={() => go(m.screen)}
          title={`Open the ${m.screen} module — pipeline stage: ${m.name.toLowerCase()}`}
          className="group text-left bg-card border border-border rounded-lg p-3 hover:border-primary/50 hover:bg-accent/40 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <m.icon className="size-3.5 text-muted-foreground group-hover:text-primary transition-colors" strokeWidth={1.75} />
            <span className="size-1.5 rounded-[2px] bg-signal-green pulse-dot" />
            <span className="ml-auto font-mono text-[9px] text-muted-foreground tnum">{m.metric}</span>
            <ArrowUpRight className="size-3 text-muted-foreground/0 group-hover:text-muted-foreground/70 transition-colors shrink-0" />
          </div>
          <div className="mt-2 text-[11px] font-medium text-foreground leading-tight">{m.name}</div>
          <div className="mt-1.5">
            <Sparkline data={m.spark} color={CHART.cyan} width={120} height={18} area={false} />
          </div>
        </button>
      ))}
    </div>
  );
}

/* ---------------- Main screen ---------------- */

export function OverviewScreen() {
  const { filters, go, setRange, alertsFeed, setDossierDay } = useApp();
  const ready = useRefresh("overview");

  const kpis = useMemo(() => getKpis(filters), [filters]);
  const series = useMemo(() => getVolumeSeries(filters), [filters]);
  /* 30-day corpus heat strip — always 30d context regardless of active range */
  const heatDays = useMemo<HeatDay[]>(
    () => getVolumeSeries({ ...filters, range: "30d" }).map((p) => ({ t: p.t, total: p.total, spike: p.spike, label: p.label })),
    [filters]
  );
  const onHeatDay = (day: HeatDay) => {
    setRange("30d");
    go("trends");
    toast(`Corpus view: ${day.label}`, {
      description: `${fmtFull(day.total)} posts on that day — 30-day window loaded in Trend Explorer.`,
    });
  };
  const topics = useMemo(
    () =>
      effectiveTopics(filters)
        .map((t) => ({ ...t, spark: getTopicSeries(t.topic, filters).map((p) => p.total) }))
        .sort((a, b) => b.topic.change24h - a.topic.change24h)
        .slice(0, 7),
    [filters]
  );
  const chartTheme = useChartTheme();

  /* ---- temporal replay (v0.13 time machine) ----
     cursorIdx = null → live full window; otherwise the playhead index.
     Playback = a self-rescheduling timeout (recreated per tick because
     cursorIdx is a dependency, so the closure always sees fresh state);
     ALL setState happens inside the async tick callback — lint-clean. */
  const [cursorIdx, setCursorIdx] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  const stepMs = Math.max(120, Math.round(14_000 / Math.max(2, series.length) / speed));
  useEffect(() => {
    if (!playing || series.length < 2) return;
    const cur = cursorIdx ?? series.length - 1;
    const id = setTimeout(() => {
      if (cur >= series.length - 1) {
        /* swept to the live edge — hand back to the live window */
        setPlaying(false);
        setCursorIdx(null);
        return;
      }
      setCursorIdx(cur + 1);
    }, stepMs);
    return () => clearTimeout(id);
  }, [playing, cursorIdx, series.length, stepMs]);

  /* keyboard seek keeps playing: TimeMachine calls onCursor directly
     (no onPlaying(false)) — the timer picks up from the new position */
  const onSeekKeepPlay = (i: number | null) => setCursorIdx(i);

  const isLive = cursorIdx == null;
  const effCursor = Math.min(cursorIdx ?? series.length - 1, series.length - 1);
  /* every artefact below renders from `view` — the as-of slice */
  const view = useMemo(
    () => (isLive ? series : series.slice(0, effCursor + 1)),
    [series, isLive, effCursor]
  );
  const viewEnd = view[view.length - 1];

  /* v0.16: summon the day dossier for the playhead's calendar day — the
     playhead may sit on an hourly/3-hourly bucket (24h/7d ranges), so map
     its timestamp onto the containing 30d heat day */
  const onInspectPlayhead = () => {
    const p = series[effCursor];
    if (!p) return;
    const d = heatDays.find((h) => p.t >= h.t && p.t < h.t + 86_400_000);
    if (d) setDossierDay(d.t);
  };

  const totalVol = useMemo(() => series.reduce((a, p) => a + p.total, 0) || 1, [series]);
  const viewVol = useMemo(() => view.reduce((a, p) => a + p.total, 0), [view]);
  /* as-of KPI derivations — real arithmetic over the sliced corpus */
  const postsAsOf = Math.round(kpis.postsTracked * (viewVol / totalVol));
  const sentimentAsOf = useMemo(() => {
    const pos = view.reduce((a, p) => a + p.positive, 0);
    const neg = view.reduce((a, p) => a + p.negative, 0);
    const tot = view.reduce((a, p) => a + p.total, 0) || 1;
    return (pos - neg) / tot;
  }, [view]);
  const narrativesAsOf = useMemo(
    () =>
      topics.filter((t) => {
        const prefix = t.spark.slice(0, effCursor + 1);
        const full = t.spark.reduce((a, b) => a + b, 0) || 1;
        return prefix.reduce((a, b) => a + b, 0) / full >= 0.12;
      }).length,
    [topics, effCursor]
  );
  const highRiskAsOf = useMemo(() => {
    if (isLive) return kpis.highRiskAlerts;
    const edge = viewEnd?.t ?? 0;
    return alertsFeed.filter(
      (a) => a.t <= edge && a.status === "New" && (a.severity === "critical" || a.severity === "high")
    ).length;
  }, [alertsFeed, isLive, viewEnd, kpis.highRiskAlerts]);

  /* chart payload: stacked sentiment up to the playhead, ghost of the
     still-upcoming window after it (null-padded so recharts breaks both) */
  const chartData = useMemo(
    () =>
      series.map((p, i) =>
        i <= effCursor
          ? { ...p, ghost: null as number | null }
          : { ...p, positive: null, neutral: null, negative: null, baseline: null, ghost: p.total }
      ),
    [series, effCursor]
  );

  /* trending rows during replay: only narratives that have actually
     emerged by the playhead, ranked by their as-of growth rate, with
     volume and spark truncated to the arrived prefix */
  const trendingAsOf = useMemo(() => {
    if (isLive) return topics.map((t) => ({ ...t, share: 1, asOfChange: t.topic.change24h, spark: t.spark }));
    const rows = topics
      .map((t) => {
        const prefix = t.spark.slice(0, effCursor + 1);
        const full = t.spark.reduce((a, b) => a + b, 0) || 1;
        const share = prefix.reduce((a, b) => a + b, 0) / full;
        const n = prefix.length;
        const last3 = prefix.slice(-3).reduce((a, b) => a + b, 0) / Math.max(1, Math.min(3, n));
        const prev3 = prefix.slice(Math.max(0, n - 6), Math.max(0, n - 3));
        const prevAvg = prev3.length ? prev3.reduce((a, b) => a + b, 0) / prev3.length : last3;
        const asOfChange = prevAvg > 0 ? ((last3 - prevAvg) / prevAvg) * 100 : t.topic.change24h;
        return { ...t, spark: prefix, share, asOfChange };
      })
      .filter((t) => t.share >= 0.12)
      .sort((a, b) => b.asOfChange - a.asOfChange);
    return rows.slice(0, 7);
  }, [topics, isLive, effCursor]);

  if (!ready) {
    return (
      <div className="space-y-4 animate-in fade-in duration-200">
        <KpiRowSkeleton />
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
          <PanelSkeleton className="xl:col-span-8" height="h-72" />
          <PanelSkeleton className="xl:col-span-4" height="h-72" />
        </div>
        <PanelSkeleton height="h-48" />
      </div>
    );
  }

  const windowLabel = WINDOW_LABEL[filters.range] ?? "window";
  const sentimentToneOfKpi = sentimentTone(kpis.avgSentiment);
  const sentimentToneAsOf = sentimentTone(sentimentAsOf);
  const replayLabel = viewEnd?.label ?? "—";

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <ScreenHeader
        kicker="MODULE 01 // INTELLIGENCE FUSION"
        title="Mission Control"
        description={`Unified signal picture across X and Telegram for the ${windowLabel} — volume, narratives, influence, bot activity and misinformation risk in a single operating view.`}
        right={
          <div className="flex items-center gap-2 flex-wrap">
            <Badge tone="cyan" dot>
              {filters.platform === "all" ? "X + Telegram" : filters.platform === "x" ? "X only" : "Telegram only"}
            </Badge>
            <Badge tone={sentimentToneOfKpi} dot>
              net {fmtNet(kpis.avgSentiment)}
            </Badge>
            {!isLive && (
              <Badge tone="orange" dot>
                <History className="size-2.5" /> replay · as of {replayLabel}
              </Badge>
            )}
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[11px] gap-1.5"
              onClick={() => {
                toast("Fusion snapshot queued", {
                  description: "Intelligence summary attached to the daily briefing (mock).",
                });
              }}
            >
              <Layers className="size-3.5" /> Snapshot
            </Button>
          </div>
        }
      />

      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4" data-tour="kpi-row">
        <KpiCard
          label="Posts tracked"
          value={fmtCompact(postsAsOf)}
          icon={MessageSquare}
          tone="cyan"
          delta={12.4}
          spark={view.map((p) => p.total)}
          sparkColor={CHART.cyan}
          footnote={
            isLive ? (
              <>
                <span className="text-signal-cyan">X {Math.round(kpis.xShare * 100)}%</span>
                <span className="text-border">/</span>
                <span className="text-signal-green">TG {Math.round(kpis.telegramShare * 100)}%</span>
              </>
            ) : (
              <span className="text-signal-orange">as of {replayLabel}</span>
            )
          }
        />
        <KpiCard
          label="Active narratives"
          value={String(narrativesAsOf)}
          icon={GitBranch}
          tone="orange"
          delta={8.1}
          spark={view.map((p) => Math.max(1, Math.round(p.total / 900)))}
          sparkColor={CHART.orange}
          footnote={<span>{isLive ? "3 emerging · 2 coordinated" : `${Math.round((viewVol / totalVol) * 100)}% of window volume`}</span>}
        />
        <KpiCard
          label="Avg sentiment"
          value={fmtNet(sentimentAsOf)}
          icon={HeartPulse}
          tone={sentimentToneAsOf === "green" ? "green" : sentimentToneAsOf === "red" ? "red" : "amber"}
          delta={Number((kpis.sentimentDelta * 100).toFixed(1))}
          deltaSuffix=""
          spark={view.map((p) => (p.positive - p.negative) / Math.max(1, p.total))}
          sparkColor={sentimentToneAsOf === "red" ? CHART.red : CHART.green}
          footnote={<span>{isLive ? "scale −1.00 … +1.00" : `as of ${replayLabel}`}</span>}
        />
        <KpiCard
          label="High-risk alerts"
          value={String(highRiskAsOf)}
          icon={ShieldAlert}
          tone="red"
          invertDelta
          delta={25}
          spark={view.map((p) => (p.spike ? 5 : 2))}
          sparkColor={CHART.red}
          footnote={<span className="text-signal-red">{isLive ? "2 critical · 2 high" : `timeline to ${replayLabel}`}</span>}
        />
      </div>

      {/* 30-day corpus intensity strip */}
      <Panel
        title="Corpus intensity"
        icon={Cpu}
        sub={isLive ? "30-day daily volume · reflects filter bank" : `30-day volume · playhead ${replayLabel}`}
        right={
          <span className="font-mono text-[10px] text-muted-foreground/70 hidden sm:inline">
            click a day → dossier
          </span>
        }
      >
        <HeatCalendar
          days={heatDays}
          activeT={isLive ? undefined : (viewEnd?.t ?? undefined)}
          renderDayDossier={(day) => <DayDossier day={day} filters={filters} onOpenTrends={onHeatDay} />}
        />
      </Panel>

      {/* Volume × sentiment band + live alerts */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <Panel
          className="xl:col-span-8"
          title="Conversation volume · sentiment composition"
          icon={Flame}
          sub={isLive ? windowLabel : `temporal replay · as of ${replayLabel}`}
          right={
            <Legend
              items={[
                { label: "Positive", color: CHART.green },
                { label: "Neutral", color: "#64748B" },
                { label: "Negative", color: CHART.red },
                { label: "Baseline", color: CHART.cyan, dashed: true },
                { label: "Spike", color: CHART.amber },
                ...(isLive ? [] : [{ label: "Upcoming", color: "#64748B", dashed: true }]),
              ]}
            />
          }
        >
          <div className="h-64 md:h-72 -mx-1">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="ovPos" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART.green} stopOpacity={0.55} />
                    <stop offset="100%" stopColor={CHART.green} stopOpacity={0.28} />
                  </linearGradient>
                  <linearGradient id="ovNeu" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#64748B" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#64748B" stopOpacity={0.22} />
                  </linearGradient>
                  <linearGradient id="ovNeg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART.red} stopOpacity={0.6} />
                    <stop offset="100%" stopColor={CHART.red} stopOpacity={0.34} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={chartTheme.grid} strokeDasharray={GRID.strokeDasharray} vertical={GRID.vertical} />
                <XAxis
                  dataKey="t"
                  type="number"
                  domain={["dataMin", "dataMax"]}
                  tickFormatter={(t: number) => {
                    const p = series.find((s) => s.t === t);
                    return p?.label ?? "";
                  }}
                  minTickGap={filters.range === "30d" ? 24 : filters.range === "7d" ? 36 : 48}
                  tick={{ fontSize: 10, fill: chartTheme.tick, fontFamily: "var(--font-jetbrains), monospace" }}
                  axisLine={{ stroke: chartTheme.grid }}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(v: number) => fmtCompact(v)}
                  width={44}
                  tick={{ fontSize: 10, fill: chartTheme.tick, fontFamily: "var(--font-jetbrains), monospace" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ stroke: chartTheme.crosshair, strokeDasharray: "4 4" }}
                  content={(props) => (
                    <ChartTooltip
                      {...props}
                      label={
                        (() => {
                          const p = series.find((s) => s.t === (props as { payload?: { t?: number } }).payload?.t);
                          return p?.label ?? "";
                        })()
                      }
                      labelExtra={
                        (props as { payload?: { spike?: boolean } }).payload?.spike ? (
                          <Badge tone="amber">spike</Badge>
                        ) : null
                      }
                    />
                  )}
                />
                <Area
                  dataKey="positive"
                  name="Positive"
                  stackId="s"
                  stroke={CHART.green}
                  strokeWidth={0}
                  fill="url(#ovPos)"
                />
                <Area
                  dataKey="neutral"
                  name="Neutral"
                  stackId="s"
                  stroke="#64748B"
                  strokeWidth={0}
                  fill="url(#ovNeu)"
                />
                <Area
                  dataKey="negative"
                  name="Negative"
                  stackId="s"
                  stroke={CHART.red}
                  strokeWidth={0}
                  fill="url(#ovNeg)"
                />
                {/* historical baseline — dashed cyan reference (promised by the legend) */}
                <Line
                  type="monotone"
                  dataKey="baseline"
                  name="Baseline"
                  stroke={CHART.cyan}
                  strokeOpacity={0.7}
                  strokeWidth={1}
                  strokeDasharray="3 4"
                  dot={false}
                  connectNulls={false}
                />
                {/* still-upcoming window behind the replay playhead — dimmed ghost */}
                {!isLive && (
                  <Line
                    type="monotone"
                    dataKey="ghost"
                    name="Upcoming"
                    stroke={"#64748B"}
                    strokeOpacity={0.55}
                    strokeWidth={1}
                    strokeDasharray="2 6"
                    dot={false}
                    connectNulls={false}
                  />
                )}
                {/* replay playhead — vertical hairline at the as-of edge */}
                {!isLive && viewEnd && (
                  <ReferenceLine
                    x={viewEnd.t}
                    stroke={CHART.orange}
                    strokeOpacity={0.55}
                    strokeWidth={1}
                  />
                )}
                {view
                  .filter((p) => p.spike)
                  .map((p) => (
                    <ReferenceDot
                      key={p.t}
                      x={p.t}
                      y={p.total}
                      r={4}
                      fill={CHART.amber}
                      stroke="#0A0E14"
                      strokeWidth={1}
                    />
                  ))}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 border-t border-border/60 pt-3" data-tour="time-machine">
            <div className="flex items-center gap-2 flex-wrap">
              <Taxonomy>Temporal replay</Taxonomy>
              <span className="font-mono text-[9px] text-muted-foreground/60 hidden md:inline">
                ←/→ seek · ⏎ day dossier · End → live
              </span>
            </div>
            <div className="mt-2">
              <TimeMachine
                points={series}
                cursor={cursorIdx}
                onCursor={onSeekKeepPlay}
                playing={playing}
                onPlaying={setPlaying}
                speed={speed}
                onSpeed={setSpeed}
                onInspect={onInspectPlayhead}
              />
            </div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-3 border-t border-border/60 pt-3">
            <div>
              <Taxonomy>Peak {isLive ? "hour" : "to date"}</Taxonomy>
              <div className="font-mono text-sm tnum text-foreground mt-0.5">
                {(() => {
                  const peak = view.reduce((a, b) => (b.total > a.total ? b : a), view[0]);
                  return peak ? `${peak.label} · ${fmtCompact(peak.total)}` : "—";
                })()}
              </div>
            </div>
            <div>
              <Taxonomy>Negative share</Taxonomy>
              <div className="font-mono text-sm tnum text-signal-red mt-0.5">
                {(() => {
                  const tot = view.reduce((a, p) => a + p.total, 0) || 1;
                  const neg = view.reduce((a, p) => a + p.negative, 0);
                  return `${((neg / tot) * 100).toFixed(1)}%`;
                })()}
              </div>
            </div>
            <div>
              <Taxonomy>Spikes flagged</Taxonomy>
              <div
                className={cn(
                  "font-mono text-sm tnum mt-0.5",
                  view.filter((p) => p.spike).length > 0 ? "text-signal-amber" : "text-muted-foreground"
                )}
              >
                {view.filter((p) => p.spike).length > 0
                  ? `${view.filter((p) => p.spike).length} vs baseline`
                  : "none · nominal"}
              </div>
            </div>
          </div>
        </Panel>

        <div className="xl:col-span-4 min-w-0" data-tour="live-feed">
          <LiveAlertFeed />
        </div>
      </div>

      {/* Trending narratives + network preview */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <Panel
          className="xl:col-span-7"
          title="Top trending narratives"
          icon={Flame}
          sub={isLive ? `24h Δ · ${windowLabel}` : `emerged by ${replayLabel} · temporal replay`}
          bodyClassName="p-0"
          right={
            <Button variant="outline" size="sm" className="h-6 px-2 text-[10px] gap-1" onClick={() => go("trends")}>
              Trend explorer <ArrowUpRight className="size-3" />
            </Button>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border">
                  {["Narrative", "Volume", "24h Δ", "Sentiment", "Risk", "Trend"].map((h) => (
                    <th key={h} className="taxonomy text-muted-foreground/70 font-semibold px-4 py-2 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {trendingAsOf.map(({ topic, spark, share, asOfChange }) => {
                  const dom =
                    topic.sentiment.positive > topic.sentiment.negative
                      ? topic.sentiment.positive > topic.sentiment.neutral
                        ? "positive"
                        : "neutral"
                      : topic.sentiment.negative > topic.sentiment.neutral
                        ? "negative"
                        : "neutral";
                  return (
                    <tr
                      key={topic.id}
                      onClick={() => go("trends", { topicId: topic.id })}
                      className="border-b border-border/50 last:border-0 hover:bg-accent cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2 min-w-0">
                          {topic.velocity === "surging" && <Flame className="size-3 text-signal-orange shrink-0" />}
                          <span className="text-xs font-medium text-foreground truncate max-w-40">{topic.label}</span>
                          {topic.emerging && <Badge tone="orange">emerging</Badge>}
                        </div>
                        <div className="text-[10px] text-muted-foreground truncate max-w-44 mt-0.5">{topic.gloss}</div>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs tnum text-foreground whitespace-nowrap">
                        {fmtCompact(topic.baseVolume * 1.75 * (isLive ? 1 : Math.max(0.02, share)))}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <Delta value={Number(asOfChange.toFixed(1))} />
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge tone={dom === "positive" ? "green" : dom === "negative" ? "red" : "slate"}>
                          {dom}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 w-28">
                        <ScoreBar value={topic.risk} showValue />
                      </td>
                      <td className="px-4 py-2.5">
                        <Sparkline data={spark} color={CHART.orange} width={72} height={22} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>

        <div className="xl:col-span-5 min-w-0">
          <NetworkPreview />
        </div>
      </div>

      {/* Module pipeline */}
      <Panel title="Capability pipeline" icon={Cpu} sub="all modules nominal">
        <ModuleStrip />
      </Panel>

      <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground/60 px-1">
        <Users className="size-3" />
        Source: aggregated public posts (X, Telegram) · anonymised cohorts · window {windowLabel} ·
        generated {relTime(NOW)} ago · prototype data
      </div>
    </div>
  );
}

export { fmtSigned };
