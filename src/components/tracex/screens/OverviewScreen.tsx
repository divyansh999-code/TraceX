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
  getAlerts,
  getNetwork,
  getInfluencers,
  NOW,
  type IntelligenceAlert,
} from "@/lib/mock";
import { fmtCompact, fmtNet, relTime, riskTone, sentimentTone, fmtSigned } from "@/lib/fmt";
import { Panel, Badge, Delta, ScoreBar, SeverityDot, LiveDot, Legend, Taxonomy } from "../common/primitives";
import { KpiCard } from "../common/KpiCard";
import { Sparkline } from "../common/Sparkline";
import { ScreenHeader } from "../common/ScreenHeader";
import { ChartTooltip, CHART, GRID, useChartTheme } from "../common/ChartBits";
import { useRefresh, KpiRowSkeleton, PanelSkeleton } from "../common/Skeletons";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceDot,
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const WINDOW_LABEL: Record<string, string> = {
  "24h": "last 24 hours",
  "7d": "last 7 days",
  "30d": "last 30 days",
  custom: "custom window",
};

/* ---------------- Live alert feed ---------------- */

function LiveAlertFeed() {
  const { go } = useApp();
  const [alerts, setAlerts] = useState<IntelligenceAlert[]>(() => getAlerts().slice(0, 9));

  useEffect(() => {
    let n = 0;
    const id = setInterval(() => {
      setAlerts((prev) => {
        const templates = [
          {
            type: "spike" as const,
            severity: "medium" as const,
            title: "Velocity anomaly detected",
            detail: "Hourly z-score 3.2 on monitored keyword set; evaluating correlation.",
            status: "New" as const,
            linkScreen: "trends" as const,
          },
          {
            type: "bot-cluster" as const,
            severity: "high" as const,
            title: "Amplification burst — TX-88 fringe",
            detail: "19 sibling accounts posted within 6s; escalation queued.",
            status: "New" as const,
            linkScreen: "bots" as const,
          },
          {
            type: "misinformation" as const,
            severity: "medium" as const,
            title: "Claim re-emergence flagged",
            detail: "Disputed claim text re-matched at 0.92 similarity.",
            status: "New" as const,
            linkScreen: "misinfo" as const,
          },
          {
            type: "sentiment-shift" as const,
            severity: "low" as const,
            title: "Sentiment drift observed",
            detail: "Anxiety share rising 0.8%/h on civic keyword cluster.",
            status: "New" as const,
            linkScreen: "sentiment" as const,
          },
        ];
        const t = templates[n % templates.length];
        n += 1;
        const fresh: IntelligenceAlert = {
          ...t,
          id: `ALR-L${9000 + n}`,
          t: Date.now(),
        };
        return [fresh, ...prev].slice(0, 9);
      });
    }, 22_000);
    return () => clearInterval(id);
  }, []);

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
        {alerts.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => a.linkScreen && go(a.linkScreen)}
            className="w-full text-left px-4 py-2.5 hover:bg-accent transition-colors cursor-pointer group"
          >
            <div className="flex items-center gap-2">
              <SeverityDot severity={a.severity} />
              <span className="text-xs font-medium text-foreground truncate group-hover:text-primary transition-colors">
                {a.title}
              </span>
              <span className="ml-auto font-mono text-[10px] tnum text-muted-foreground/70 shrink-0">
                {relTime(a.t, NOW)}
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
              <span className="text-[11px] text-muted-foreground truncate">{a.detail}</span>
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

const MODULES = [
  { icon: Database, name: "API Ingestion", metric: "12.4k/min", spark: [8, 9, 11, 10, 12, 13, 12, 14, 13, 15] },
  { icon: Fingerprint, name: "Demographics", metric: "k≥50", spark: [5, 6, 5, 7, 6, 6, 7, 6, 7, 7] },
  { icon: HeartPulse, name: "Sentiment", metric: "7 langs", spark: [4, 5, 6, 5, 6, 7, 6, 7, 8, 7] },
  { icon: Flame, name: "Trend Detection", metric: "z>2.5", spark: [3, 5, 4, 6, 8, 7, 9, 11, 10, 12] },
  { icon: Bot, name: "Bot Detection", metric: "5k sample", spark: [2, 3, 2, 4, 3, 5, 4, 6, 5, 6] },
  { icon: Share2, name: "Network Analysis", metric: "90 nodes", spark: [6, 6, 7, 7, 8, 8, 9, 8, 9, 10] },
  { icon: ShieldAlert, name: "Misinformation", metric: "10 claims", spark: [4, 5, 7, 6, 8, 9, 8, 10, 11, 12] },
  { icon: Layers, name: "Intelligence Fusion", metric: "this view", spark: [7, 8, 8, 9, 10, 9, 10, 11, 12, 13] },
];

function ModuleStrip() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3">
      {MODULES.map((m) => (
        <div
          key={m.name}
          className="bg-card border border-border rounded-lg p-3 hover:border-muted-foreground/30 transition-colors"
        >
          <div className="flex items-center gap-2">
            <m.icon className="size-3.5 text-muted-foreground" strokeWidth={1.75} />
            <span className="size-1.5 rounded-[2px] bg-signal-green pulse-dot" />
            <span className="ml-auto font-mono text-[9px] text-muted-foreground tnum">{m.metric}</span>
          </div>
          <div className="mt-2 text-[11px] font-medium text-foreground leading-tight">{m.name}</div>
          <div className="mt-1.5">
            <Sparkline data={m.spark} color={CHART.cyan} width={120} height={18} area={false} />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------------- Main screen ---------------- */

export function OverviewScreen() {
  const { filters, go } = useApp();
  const ready = useRefresh("overview");

  const kpis = useMemo(() => getKpis(filters), [filters]);
  const series = useMemo(() => getVolumeSeries(filters), [filters]);
  const topics = useMemo(
    () =>
      effectiveTopics(filters)
        .map((t) => ({ ...t, spark: getTopicSeries(t.topic, filters).map((p) => p.total) }))
        .sort((a, b) => b.topic.change24h - a.topic.change24h)
        .slice(0, 7),
    [filters]
  );
  const chartTheme = useChartTheme();

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

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <ScreenHeader
        kicker="MODULE 01 // INTELLIGENCE FUSION"
        title="Mission Control"
        description={`Unified signal picture across X and Telegram for the ${windowLabel} — volume, narratives, influence, bot activity and misinformation risk in a single operating view.`}
        right={
          <div className="flex items-center gap-2">
            <Badge tone="cyan" dot>
              {filters.platform === "all" ? "X + Telegram" : filters.platform === "x" ? "X only" : "Telegram only"}
            </Badge>
            <Badge tone={sentimentToneOfKpi} dot>
              net {fmtNet(kpis.avgSentiment)}
            </Badge>
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
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Posts tracked"
          value={fmtCompact(kpis.postsTracked)}
          icon={MessageSquare}
          tone="cyan"
          delta={12.4}
          spark={series.map((p) => p.total)}
          sparkColor={CHART.cyan}
          footnote={
            <>
              <span className="text-signal-cyan">X {Math.round(kpis.xShare * 100)}%</span>
              <span className="text-border">/</span>
              <span className="text-signal-green">TG {Math.round(kpis.telegramShare * 100)}%</span>
            </>
          }
        />
        <KpiCard
          label="Active narratives"
          value={String(kpis.activeNarratives)}
          icon={GitBranch}
          tone="orange"
          delta={8.1}
          spark={series.map((p) => Math.max(1, Math.round(p.total / 900)))}
          sparkColor={CHART.orange}
          footnote={<span>3 emerging · 2 coordinated</span>}
        />
        <KpiCard
          label="Avg sentiment"
          value={fmtNet(kpis.avgSentiment)}
          icon={HeartPulse}
          tone={sentimentToneOfKpi === "green" ? "green" : sentimentToneOfKpi === "red" ? "red" : "amber"}
          delta={Number((kpis.sentimentDelta * 100).toFixed(1))}
          deltaSuffix=""
          spark={series.map((p) => (p.positive - p.negative) / Math.max(1, p.total))}
          sparkColor={sentimentToneOfKpi === "red" ? CHART.red : CHART.green}
          footnote={<span>scale −1.00 … +1.00</span>}
        />
        <KpiCard
          label="High-risk alerts"
          value={String(kpis.highRiskAlerts)}
          icon={ShieldAlert}
          tone="red"
          invertDelta
          delta={25}
          spark={[2, 3, 2, 4, 3, 5, 4, 6, 5, 4]}
          sparkColor={CHART.red}
          footnote={<span className="text-signal-red">2 critical · 2 high</span>}
        />
      </div>

      {/* Volume × sentiment band + live alerts */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <Panel
          className="xl:col-span-8"
          title="Conversation volume · sentiment composition"
          icon={Flame}
          sub={windowLabel}
          right={
            <Legend
              items={[
                { label: "Positive", color: CHART.green },
                { label: "Neutral", color: "#64748B" },
                { label: "Negative", color: CHART.red },
                { label: "Baseline", color: CHART.cyan, dashed: true },
                { label: "Spike", color: CHART.amber },
              ]}
            />
          }
        >
          <div className="h-64 md:h-72 -mx-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
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
                  minTickGap={48}
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
                {series
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
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-3 border-t border-border/60 pt-3">
            <div>
              <Taxonomy>Peak hour</Taxonomy>
              <div className="font-mono text-sm tnum text-foreground mt-0.5">
                {(() => {
                  const peak = series.reduce((a, b) => (b.total > a.total ? b : a), series[0]);
                  return peak ? `${peak.label} · ${fmtCompact(peak.total)}` : "—";
                })()}
              </div>
            </div>
            <div>
              <Taxonomy>Negative share</Taxonomy>
              <div className="font-mono text-sm tnum text-signal-red mt-0.5">
                {(() => {
                  const tot = series.reduce((a, p) => a + p.total, 0) || 1;
                  const neg = series.reduce((a, p) => a + p.negative, 0);
                  return `${((neg / tot) * 100).toFixed(1)}%`;
                })()}
              </div>
            </div>
            <div>
              <Taxonomy>Spikes flagged</Taxonomy>
              <div className="font-mono text-sm tnum text-signal-amber mt-0.5">
                {series.filter((p) => p.spike).length} vs baseline
              </div>
            </div>
          </div>
        </Panel>

        <div className="xl:col-span-4 min-w-0">
          <LiveAlertFeed />
        </div>
      </div>

      {/* Trending narratives + network preview */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <Panel
          className="xl:col-span-7"
          title="Top trending narratives"
          icon={Flame}
          sub={`24h Δ · ${windowLabel}`}
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
                {topics.map(({ topic, spark }) => {
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
                        {fmtCompact(topic.baseVolume * 1.75)}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <Delta value={topic.change24h} />
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
