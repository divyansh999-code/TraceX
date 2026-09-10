"use client";

/**
 * BOT DETECTION — MODULE 06.
 * Behavioural scoring of a 5k account sample: age × frequency scatter,
 * bot-probability distribution, flagged-account watchlist, and
 * coordinated cluster forensics with mini topology diagrams.
 */
import { useMemo, useState } from "react";
import { useApp } from "@/lib/app-state";
import { getBots, getNetwork, NOW } from "@/lib/mock";
import type { BotCluster, NetNode, ScatterPoint } from "@/lib/mock";
import { fmtCompact, fmtFull, relTime } from "@/lib/fmt";
import { cn } from "@/lib/utils";
import {
  Panel,
  Badge,
  ScoreBar,
  Taxonomy,
  MonoTag,
  MetricRow,
  Legend,
  Chip,
} from "../common/primitives";
import { KpiCard } from "../common/KpiCard";
import { Sparkline } from "../common/Sparkline";
import { ScreenHeader } from "../common/ScreenHeader";
import { ChartTooltip, CHART, GRID, useChartTheme } from "../common/ChartBits";
import { useRefresh, KpiRowSkeleton, PanelSkeleton } from "../common/Skeletons";
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import {
  Bot,
  Database,
  Flag,
  Siren,
  Network,
  ArrowUpDown,
  Download,
  BarChart3,
  ScatterChart as ScatterIcon,
  Table as TableIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { downloadCsv, csvStamp } from "@/lib/csv";

/* ---------------- scatter dot shapes ---------------- */

function OrganicDot(props: { cx?: number; cy?: number }) {
  const { cx, cy } = props;
  if (cx === undefined || cy === undefined) return <g />;
  return <circle cx={cx} cy={cy} r={3} fill={CHART.green} fillOpacity={0.5} />;
}

function FlaggedDot(props: { cx?: number; cy?: number }) {
  const { cx, cy } = props;
  if (cx === undefined || cy === undefined) return <g />;
  return <circle cx={cx} cy={cy} r={3.5} fill={CHART.red} fillOpacity={0.75} />;
}

const DIST_COLORS = [CHART.green, CHART.green, CHART.amber, CHART.red, CHART.red];

/* ---------------- cluster mini topology ---------------- */

function ClusterGraph({ members, color }: { members: NetNode[]; color: string }) {
  const W = 260;
  const H = 118;
  if (members.length === 0) {
    return (
      <div className="mt-1 w-full max-w-[260px] h-[118px] border border-dashed border-border rounded-md flex items-center justify-center">
        <span className="text-[10px] font-mono text-muted-foreground/60 px-3 text-center">
          no sampled members on this platform
        </span>
      </div>
    );
  }
  const hub = { x: W / 2, y: H / 2 };
  const pts = members.map((m, i) => {
    const angle = (i / members.length) * Math.PI * 2 - Math.PI / 2;
    return {
      x: hub.x + Math.cos(angle) * (W / 2 - 18),
      y: hub.y + Math.sin(angle) * (H / 2 - 16),
      key: m.id,
    };
  });
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-1 w-full max-w-[260px]">
      {pts.map((p, i) => {
        const next = pts[(i + 1) % pts.length];
        return (
          <line key={`ring-${p.key}`} x1={p.x} y1={p.y} x2={next.x} y2={next.y} stroke="#232838" strokeWidth={0.8} />
        );
      })}
      {pts.map((p) => (
        <line key={`spoke-${p.key}`} x1={hub.x} y1={hub.y} x2={p.x} y2={p.y} stroke="#232838" strokeWidth={0.8} />
      ))}
      {pts.map((p, i) => (
        <circle key={`node-${p.key}`} cx={p.x} cy={p.y} r={3 + (i % 3)} fill={color} fillOpacity={0.9} />
      ))}
      <circle cx={hub.x} cy={hub.y} r={5} fill={color} />
      <circle cx={hub.x} cy={hub.y} r={8.5} fill="none" stroke={color} strokeOpacity={0.4} />
    </svg>
  );
}

function ClusterCard({ cluster, nodeById }: { cluster: BotCluster; nodeById: Map<string, NetNode> }) {
  const members = cluster.memberIds
    .map((id) => nodeById.get(id))
    .filter((n): n is NetNode => n !== undefined);
  const color = cluster.severity === "high" ? CHART.red : CHART.amber;

  return (
    <div className="bg-card border border-border rounded-lg p-4 flex flex-col gap-3 min-w-0">
      <div className="flex items-center gap-2 flex-wrap">
        <MonoTag>{cluster.id}</MonoTag>
        <Badge tone={cluster.severity === "high" ? "red" : "amber"} dot>
          {cluster.severity}
        </Badge>
        <span className="ml-auto font-mono text-[10px] tnum text-muted-foreground shrink-0">
          {fmtFull(cluster.size)} accounts
        </span>
      </div>
      <div className="text-xs font-medium text-foreground leading-tight">{cluster.label}</div>
      <div className="flex flex-wrap gap-1.5">
        {cluster.targetTopics.map((t) => (
          <Chip key={t} className="cursor-default">
            {t}
          </Chip>
        ))}
      </div>
      <div>
        <MetricRow label="Sync window" value={`${cluster.syncWindowSec}s`} sub="median inter-post gap" />
        <MetricRow label="Shared media hashes" value={String(cluster.sharedMediaHashes)} sub="identical media" />
      </div>
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="shrink-0 min-w-0">
          <Taxonomy>Topology · {members.length} sampled</Taxonomy>
          <ClusterGraph members={members} color={color} />
        </div>
        <div className="flex-1 min-w-0">
          <Taxonomy>Activity · last 24h</Taxonomy>
          <div className="mt-1.5">
            <Sparkline data={cluster.activity} color={CHART.red} width={220} height={46} />
          </div>
          <div className="mt-1.5 font-mono text-[10px] tnum text-muted-foreground/70">
            peak {Math.max(...cluster.activity)} posts/h · sync ×{fmtFull(cluster.size)}
          </div>
        </div>
      </div>
      <div className="border-t border-border/60 pt-2 text-[10px] font-mono text-muted-foreground/60">
        acting in unison — identical media hash forwarding
      </div>
    </div>
  );
}

/* ---------------- screen ---------------- */

export function BotScreen() {
  const { filters } = useApp();
  const ready = useRefresh("bots");
  const chartTheme = useChartTheme();

  const bots = useMemo(() => getBots(filters), [filters]);
  const nodeById = useMemo(() => {
    const net = getNetwork(filters);
    return new Map(net.nodes.map((n) => [n.id, n]));
  }, [filters]);

  const { organicPts, suspectPts } = useMemo(() => {
    const scoped = bots.scatter.filter(
      (p) => filters.platform === "all" || p.platform === filters.platform
    );
    return {
      organicPts: scoped.filter((p) => p.botProb < 0.5),
      suspectPts: scoped.filter((p) => p.botProb >= 0.5),
    };
  }, [bots, filters.platform]);

  const [probSort, setProbSort] = useState<"asc" | "desc">("desc");
  const rows = useMemo(() => {
    const scoped = bots.flagged.filter(
      (b) => filters.platform === "all" || b.platform === filters.platform
    );
    return [...scoped].sort((a, b) =>
      probSort === "desc" ? b.botProb - a.botProb : a.botProb - b.botProb
    );
  }, [bots, filters.platform, probSort]);

  const distHigh = (bots.distribution[3]?.count ?? 0) + (bots.distribution[4]?.count ?? 0);
  const distVeryHigh = bots.distribution[4]?.count ?? 0;
  const pctHigh = ((distHigh / bots.stats.sampled) * 100).toFixed(1);
  const pctVeryHigh = ((distVeryHigh / bots.stats.sampled) * 100).toFixed(1);

  if (!ready) {
    return (
      <div className="space-y-4 animate-in fade-in duration-200">
        <KpiRowSkeleton />
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
          <PanelSkeleton className="xl:col-span-7" height="h-80" />
          <PanelSkeleton className="xl:col-span-5" height="h-80" />
        </div>
        <PanelSkeleton height="h-56" />
        <PanelSkeleton height="h-72" />
      </div>
    );
  }

  const scopeLabel =
    filters.platform === "all" ? "X + Telegram" : filters.platform === "x" ? "X only" : "Telegram only";
  const stats = bots.stats;

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <ScreenHeader
        kicker="MODULE 06 // BOT DETECTION"
        title="Bot Detection & Coordinated Behaviour"
        description="Behavioural scoring across a rotating 5,000-account sample — posting frequency, account age, duplicate content and timing anomalies — with coordinated cluster forensics and a flagged-account watchlist."
        right={
          <div className="flex items-center gap-2">
            <Badge tone="red" dot>{fmtFull(stats.flaggedAccounts)} flagged</Badge>
            <Badge tone="amber" dot>{(stats.botShare * 100).toFixed(1)}% bot share</Badge>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[11px] gap-1.5"
              title="Export the visible flagged-account table as CSV"
              onClick={() => {
                downloadCsv(
                  `tracex-flagged-accounts-${csvStamp()}.csv`,
                  [
                    "handle",
                    "id",
                    "platform",
                    "bot_prob",
                    "posts_per_day",
                    "account_age_days",
                    "duplicate_pct",
                    "timing_anomaly",
                    "cluster",
                    "cluster_size",
                    "first_seen",
                  ],
                  rows.map((b) => [
                    b.handle,
                    b.id,
                    b.platform === "x" ? "X" : "TG",
                    b.botProb.toFixed(2),
                    b.postsPerDay,
                    b.accountAgeDays,
                    b.dupPct,
                    b.timingAnomaly.toFixed(2),
                    b.clusterId ?? "—",
                    b.clusterSize,
                    new Date(b.firstSeen).toISOString(),
                  ])
                );
                toast("Flagged accounts exported", {
                  description: `${rows.length} rows · botProb ≥ 0.50 · ${scopeLabel} scope.`,
                });
              }}
            >
              <Download className="size-3.5" /> Export watchlist
            </Button>
          </div>
        }
      />

      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Accounts sampled"
          value={fmtFull(stats.sampled)}
          icon={Database}
          tone="cyan"
          spark={[4980, 5000, 4955, 5010, 5000, 4985, 5000]}
          sparkColor={CHART.cyan}
          footnote={<span>scored on 4 behavioural signals</span>}
        />
        <KpiCard
          label="Flagged accounts"
          value={fmtFull(stats.flaggedAccounts)}
          icon={Flag}
          tone="red"
          delta={18}
          invertDelta
          spark={bots.flagged.map((b) => b.botProb * 100).slice(0, 14)}
          sparkColor={CHART.red}
          footnote={<span>botProb ≥ 0.50 threshold</span>}
        />
        <KpiCard
          label="Est. bot share"
          value={`${(stats.botShare * 100).toFixed(1)}%`}
          icon={Bot}
          tone="amber"
          delta={12}
          invertDelta
          spark={[9.8, 10.2, 10.6, 10.4, 11.0, 11.4, 11.8]}
          sparkColor={CHART.amber}
          footnote={<span>of total tracked volume</span>}
        />
        <KpiCard
          label="New flags 24h"
          value={String(stats.newLast24h)}
          icon={Siren}
          tone="orange"
          delta={35}
          invertDelta
          spark={[8, 12, 10, 15, 14, 19, 21, 23]}
          sparkColor={CHART.orange}
          footnote={<span>auto-escalated to alert feed</span>}
        />
      </div>

      {/* Scatter + distribution */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <Panel
          className="xl:col-span-7 min-w-0"
          title="Behavioural scatter"
          sub="account age × posting frequency"
          icon={ScatterIcon}
          right={
            <Legend
              items={[
                { label: "Organic", color: CHART.green },
                { label: "Bot-flagged", color: CHART.red },
              ]}
            />
          }
        >
          <div className="h-72 md:h-80 -mx-1">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                <CartesianGrid
                  stroke={chartTheme.grid}
                  strokeDasharray={GRID.strokeDasharray}
                  vertical={GRID.vertical}
                />
                <XAxis
                  dataKey="age"
                  type="number"
                  name="Account age (days)"
                  domain={[0, "dataMax"]}
                  allowDecimals={false}
                  tickFormatter={(v: number) => fmtCompact(v)}
                  tick={{ fontSize: 10, fill: chartTheme.tick, fontFamily: "var(--font-jetbrains), monospace" }}
                  axisLine={{ stroke: chartTheme.grid }}
                  tickLine={false}
                />
                <YAxis
                  dataKey="freq"
                  type="number"
                  name="Posts/day"
                  width={40}
                  allowDecimals={false}
                  tickFormatter={(v: number) => fmtCompact(v)}
                  tick={{ fontSize: 10, fill: chartTheme.tick, fontFamily: "var(--font-jetbrains), monospace" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ stroke: chartTheme.crosshair, strokeDasharray: "4 4" }}
                  content={(props) => {
                    const { active, payload } = props as {
                      active?: boolean;
                      payload?: { payload?: ScatterPoint }[];
                    };
                    const point = payload?.[0]?.payload;
                    if (!active || !point) return null;
                    const tone =
                      point.botProb >= 0.75
                        ? CHART.red
                        : point.botProb >= 0.45
                          ? CHART.amber
                          : CHART.green;
                    return (
                      <ChartTooltip
                        active
                        label={point.platform === "x" ? "X · sampled account" : "Telegram · sampled channel"}
                        payload={[
                          { name: "Account age", value: `${fmtFull(point.age)} d`, color: CHART.slate },
                          { name: "Posting frequency", value: `${point.freq}/day`, color: CHART.slate },
                          { name: "Bot probability", value: point.botProb.toFixed(2), color: tone },
                        ]}
                      />
                    );
                  }}
                />
                <Scatter name="Organic" data={organicPts} shape={OrganicDot} fill={CHART.green} legendType="circle" />
                <Scatter
                  name="Bot-flagged"
                  data={suspectPts}
                  shape={FlaggedDot}
                  fill={CHART.red}
                  legendType="circle"
                />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-2 text-[10px] font-mono text-muted-foreground/60">
            <span className="tnum">
              x: account age (days) · y: posts/day · n={organicPts.length + suspectPts.length}
            </span>
            <span>Behavioural signals: posting frequency, account age, duplicate content, timing patterns</span>
          </div>
        </Panel>

        <Panel
          className="xl:col-span-5 min-w-0"
          title="Bot probability distribution"
          sub={`${fmtFull(stats.sampled)} sampled`}
          icon={BarChart3}
        >
          <div className="h-56 -mx-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bots.distribution} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid
                  stroke={chartTheme.grid}
                  strokeDasharray={GRID.strokeDasharray}
                  vertical={GRID.vertical}
                />
                <XAxis
                  dataKey="bucket"
                  interval={0}
                  tick={{ fontSize: 9, fill: chartTheme.tick, fontFamily: "var(--font-jetbrains), monospace" }}
                  axisLine={{ stroke: chartTheme.grid }}
                  tickLine={false}
                />
                <YAxis
                  width={40}
                  tickFormatter={(v: number) => fmtCompact(v)}
                  tick={{ fontSize: 10, fill: chartTheme.tick, fontFamily: "var(--font-jetbrains), monospace" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: chartTheme.crosshair, fillOpacity: 0.15 }}
                  content={(props) => {
                    const { active, payload, label } = props as {
                      active?: boolean;
                      payload?: { name?: string; value?: number | string; color?: string }[];
                      label?: string | number;
                    };
                    if (!active || !payload || payload.length === 0) return null;
                    return (
                      <ChartTooltip
                        active
                        payload={payload}
                        label={label}
                        format={(e) => fmtFull(Number(e.value ?? 0))}
                      />
                    );
                  }}
                />
                <Bar dataKey="count" name="Accounts" barSize={26} radius={[2, 2, 0, 0]}>
                  {bots.distribution.map((d, i) => (
                    <Cell key={d.bucket} fill={DIST_COLORS[i % DIST_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3">
            <MetricRow label="Accounts ≥ 0.60" value={fmtFull(distHigh)} sub={`${pctHigh}% of sample`} />
            <MetricRow label="Accounts ≥ 0.80" value={fmtFull(distVeryHigh)} sub={`${pctVeryHigh}% of sample`} />
          </div>
        </Panel>
      </div>

      {/* Flagged accounts table */}
      <Panel
        title="Flagged accounts"
        sub="botProb ≥ 0.50"
        icon={TableIcon}
        bodyClassName="p-0"
        right={
          <span className="font-mono text-[10px] tnum text-muted-foreground">
            {rows.length} shown · sort {probSort === "desc" ? "↓" : "↑"} botProb
          </span>
        }
      >
        <div className="max-h-[420px] overflow-y-auto overflow-x-auto">
          <table className="w-full text-left">
            <thead className="sticky top-0 bg-card z-10">
              <tr className="border-b border-border">
                <th className="taxonomy text-muted-foreground/70 font-semibold px-4 py-2 whitespace-nowrap">
                  Account
                </th>
                <th className="taxonomy text-muted-foreground/70 font-semibold px-4 py-2 whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => setProbSort((d) => (d === "desc" ? "asc" : "desc"))}
                    className="inline-flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer"
                  >
                    Bot probability
                    <ArrowUpDown className="size-3" />
                    <span className="font-mono text-[9px] lowercase">{probSort}</span>
                  </button>
                </th>
                {["Posting freq", "Account age", "Duplicate content", "Timing anomaly", "Cluster", "First seen"].map(
                  (h) => (
                    <th
                      key={h}
                      className="taxonomy text-muted-foreground/70 font-semibold px-4 py-2 whitespace-nowrap"
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-xs text-muted-foreground">
                    No flagged accounts in the current scope.
                  </td>
                </tr>
              )}
              {rows.map((b) => (
                <tr
                  key={b.id}
                  className="border-b border-border/50 last:border-0 hover:bg-accent transition-colors"
                >
                  <td className="px-4 py-2.5">
                    <div className="font-mono text-[11px] text-foreground truncate max-w-40">{b.handle}</div>
                    <div className="mt-1 flex items-center gap-1.5">
                      <MonoTag>{b.id}</MonoTag>
                      <Badge tone={b.platform === "x" ? "cyan" : "green"}>{b.platform === "x" ? "X" : "TG"}</Badge>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 w-40">
                    <ScoreBar value={b.botProb} showValue />
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs tnum text-foreground whitespace-nowrap">
                    {b.postsPerDay}/day
                  </td>
                  <td
                    className={cn(
                      "px-4 py-2.5 font-mono text-xs tnum whitespace-nowrap",
                      b.accountAgeDays < 30 && "text-signal-red"
                    )}
                  >
                    {b.accountAgeDays}d
                  </td>
                  <td
                    className={cn(
                      "px-4 py-2.5 font-mono text-xs tnum whitespace-nowrap",
                      b.dupPct >= 50 && "text-signal-amber"
                    )}
                  >
                    {b.dupPct}%
                  </td>
                  <td
                    className={cn(
                      "px-4 py-2.5 font-mono text-xs tnum whitespace-nowrap",
                      b.timingAnomaly >= 0.6 && "text-signal-amber"
                    )}
                  >
                    {b.timingAnomaly.toFixed(2)}
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    {b.clusterId ? (
                      <span className="inline-flex items-center gap-1.5">
                        <MonoTag>{b.clusterId}</MonoTag>
                        <span className="font-mono text-[10px] tnum text-muted-foreground">
                          ×{fmtFull(b.clusterSize)}
                        </span>
                      </span>
                    ) : (
                      <span className="font-mono text-[10px] text-muted-foreground/50">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-[11px] tnum text-muted-foreground whitespace-nowrap">
                    {relTime(b.firstSeen, NOW)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* Coordinated clusters */}
      <Panel
        title="Coordinated activity clusters"
        sub="sync + shared media"
        icon={Network}
        right={<Badge tone="amber" dot>{bots.clusters.length} active</Badge>}
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {bots.clusters.map((c) => (
            <ClusterCard key={c.id} cluster={c} nodeById={nodeById} />
          ))}
        </div>
      </Panel>

      <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground/60 px-1">
        <Bot className="size-3" />
        Behavioural scoring on a rotating 5k account sample · signals: frequency, account age, duplication,
        timing · {scopeLabel} · prototype data
      </div>
    </div>
  );
}
