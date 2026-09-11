"use client";

/**
 * SCREEN 03 — SENTIMENT & EMOTION.
 * Net sentiment KPIs, sentiment composition over time with shift markers,
 * emotion radar, shift alert callouts and topic sentiment comparison.
 */
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useApp } from "@/lib/app-state";
import {
  getKpis,
  getVolumeSeries,
  getEmotions,
  getSentimentShifts,
  getTopicSentimentTable,
  type VolumePoint,
} from "@/lib/mock";
import { fmtCompact, fmtNet, sentimentTone } from "@/lib/fmt";
import { cn } from "@/lib/utils";
import { Panel, Badge, Delta, Legend } from "../common/primitives";
import { KpiCard } from "../common/KpiCard";
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
  ReferenceLine,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";
import {
  HeartPulse,
  Smile,
  ThumbsDown,
  ArrowLeftRight,
  ArrowUpRight,
  ArrowDownRight,
  ArrowRight,
  Activity,
  Radar as RadarIcon,
  Zap,
  Scale,
  SearchX,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

const WINDOW_LABEL: Record<string, string> = {
  "24h": "last 24 hours",
  "7d": "last 7 days",
  "30d": "last 30 days",
  custom: "custom window",
};

const EMOTION_TONE: Record<string, "green" | "red" | "amber" | "cyan"> = {
  Support: "green",
  Opposition: "red",
  Anxiety: "amber",
  Anger: "red",
  Joy: "green",
  Curiosity: "cyan",
};

const toneTextClass = (t: "green" | "amber" | "red") =>
  t === "green" ? "text-signal-green" : t === "red" ? "text-signal-red" : "text-signal-amber";

const emotionDotClass = (t: "green" | "red" | "amber" | "cyan") =>
  t === "green"
    ? "bg-signal-green"
    : t === "red"
      ? "bg-signal-red"
      : t === "cyan"
        ? "bg-signal-cyan"
        : "bg-signal-amber";

export function SentimentScreen() {
  const { filters, go } = useApp();
  const ready = useRefresh("sentiment");
  const chartTheme = useChartTheme();

  const kpis = useMemo(() => getKpis(filters), [filters]);
  const series = useMemo(() => getVolumeSeries(filters), [filters]);
  const emotions = useMemo(() => getEmotions(filters), [filters]);
  const shifts = useMemo(() => getSentimentShifts(filters), [filters]);
  const table = useMemo(() => getTopicSentimentTable(filters), [filters]);

  /* topic comparison selection — default first 3 by volume, max 5 */
  const [compare, setCompare] = useState<string[] | null>(null);
  const selectedIds = useMemo(() => {
    const valid = (compare ?? []).filter((id) => table.some((r) => r.topicId === id));
    return valid.length > 0 ? valid : table.slice(0, 3).map((r) => r.topicId);
  }, [compare, table]);
  const toggleCompare = (id: string) => {
    if (selectedIds.includes(id)) {
      setCompare(selectedIds.filter((x) => x !== id));
      return;
    }
    if (selectedIds.length >= 5) {
      toast("Comparison limit reached", {
        description: "Deselect a topic before adding another (max 5).",
      });
      return;
    }
    setCompare([...selectedIds, id]);
  };
  const selectedRows = table.filter((r) => selectedIds.includes(r.topicId));

  /* negative share + its drift */
  const negStats = useMemo(() => {
    const half = Math.max(1, Math.floor(series.length / 2));
    const recent = series.slice(-half);
    const prior = series.slice(0, half);
    const sum = (arr: VolumePoint[], k: "total" | "negative") => arr.reduce((a, p) => a + p[k], 0);
    const totalAll = sum(series, "total");
    const negShare = totalAll > 0 ? (sum(series, "negative") / totalAll) * 100 : 0;
    const rT = sum(recent, "total");
    const pT = sum(prior, "total");
    const delta = rT > 0 && pT > 0 ? (sum(recent, "negative") / rT - sum(prior, "negative") / pT) * 100 : 0;
    return { negShare, delta };
  }, [series]);

  const dominant = emotions.length ? emotions.reduce((a, b) => (b.value > a.value ? b : a)) : null;
  const netTone = sentimentTone(kpis.avgSentiment);
  const netSpark = series.map((p) => (p.positive - p.negative) / Math.max(1, p.total));

  if (!ready) {
    return (
      <div className="space-y-4 animate-in fade-in duration-200">
        <KpiRowSkeleton />
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
          <PanelSkeleton className="xl:col-span-8" height="h-72" />
          <PanelSkeleton className="xl:col-span-4" height="h-72" />
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
          <PanelSkeleton className="xl:col-span-5" height="h-56" />
          <PanelSkeleton className="xl:col-span-7" height="h-56" />
        </div>
      </div>
    );
  }

  const windowLabel = WINDOW_LABEL[filters.range] ?? "window";

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <ScreenHeader
        kicker="MODULE 03 // SENTIMENT & EMOTION"
        title="Sentiment & Emotion"
        description={`Positive / neutral / negative composition over time for the ${windowLabel}, with emotion classification, shift detection and per-narrative sentiment comparison.`}
        right={
          <div className="flex items-center gap-2">
            <Badge tone="cyan" dot>
              {filters.platform === "all" ? "X + Telegram" : filters.platform === "x" ? "X only" : "Telegram only"}
            </Badge>
            <Badge tone={netTone} dot>
              net {fmtNet(kpis.avgSentiment)}
            </Badge>
            <Button variant="outline" size="sm" className="h-7 text-[11px] gap-1.5" onClick={() => go("trends")}>
              Trend explorer <ArrowUpRight className="size-3" />
            </Button>
          </div>
        }
      />

      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Net sentiment"
          value={fmtNet(kpis.avgSentiment)}
          icon={HeartPulse}
          tone={netTone === "green" ? "green" : netTone === "red" ? "red" : "amber"}
          delta={Number((kpis.sentimentDelta * 100).toFixed(1))}
          deltaSuffix=""
          spark={netSpark}
          sparkColor={netTone === "red" ? CHART.red : CHART.green}
          footnote={<span>scale −1.00 … +1.00</span>}
        />
        <KpiCard
          label="Dominant emotion"
          value={dominant?.emotion ?? "—"}
          icon={Smile}
          tone={dominant ? (EMOTION_TONE[dominant.emotion] ?? "amber") : "amber"}
          delta={dominant ? dominant.delta : undefined}
          deltaSuffix="pp"
          spark={emotions.map((e) => e.value)}
          sparkColor={CHART.violet}
          footnote={<span>6-class emotion model</span>}
        />
        <KpiCard
          label="Negative share"
          value={`${negStats.negShare.toFixed(1)}%`}
          icon={ThumbsDown}
          tone="red"
          invertDelta
          delta={Number(negStats.delta.toFixed(1))}
          deltaSuffix="pp"
          spark={series.map((p) => p.negative / Math.max(1, p.total))}
          sparkColor={CHART.red}
          footnote={<span>of classified volume</span>}
        />
        <KpiCard
          label="Sentiment shifts"
          value={String(shifts.length)}
          icon={ArrowLeftRight}
          tone="amber"
          spark={netSpark}
          sparkColor={CHART.amber}
          footnote={<span>Δnet ≥ 0.16 flagged</span>}
        />
      </div>

      {/* composition chart + emotion radar */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <Panel
          className="xl:col-span-8 min-w-0"
          title="Sentiment composition over time"
          icon={Activity}
          sub={windowLabel}
          right={
            <Legend
              items={[
                { label: "Positive", color: CHART.green },
                { label: "Neutral", color: "#64748B" },
                { label: "Negative", color: CHART.red },
                { label: "Shift event", color: CHART.amber, dashed: true },
              ]}
            />
          }
        >
          <div className="h-64 md:h-72 -mx-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="sePos" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART.green} stopOpacity={0.55} />
                    <stop offset="100%" stopColor={CHART.green} stopOpacity={0.28} />
                  </linearGradient>
                  <linearGradient id="seNeu" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#64748B" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#64748B" stopOpacity={0.22} />
                  </linearGradient>
                  <linearGradient id="seNeg" x1="0" y1="0" x2="0" y2="1">
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
                      label={(() => {
                        const p = series.find((s) => s.t === (props as { payload?: { t?: number } }).payload?.t);
                        return p?.label ?? "";
                      })()}
                      labelExtra={
                        shifts.some((s) => s.t === (props as { payload?: { t?: number } }).payload?.t) ? (
                          <Badge tone="amber">shift</Badge>
                        ) : null
                      }
                    />
                  )}
                />
                <Area dataKey="positive" name="Positive" stackId="s" stroke={CHART.green} strokeWidth={0} fill="url(#sePos)" />
                <Area dataKey="neutral" name="Neutral" stackId="s" stroke="#64748B" strokeWidth={0} fill="url(#seNeu)" />
                <Area dataKey="negative" name="Negative" stackId="s" stroke={CHART.red} strokeWidth={0} fill="url(#seNeg)" />
                {shifts.map((s) => (
                  <ReferenceLine key={s.id} x={s.t} stroke={CHART.amber} strokeDasharray="4 4" strokeOpacity={0.8} />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel className="xl:col-span-4 min-w-0" title="Emotion mix" icon={RadarIcon} sub="classified share">
          <div className="h-56 md:h-64 -mx-1">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={emotions} outerRadius="72%">
                <PolarGrid stroke={chartTheme.grid} />
                <PolarAngleAxis dataKey="emotion" tick={{ fontSize: 10, fill: chartTheme.tick }} />
                <PolarRadiusAxis tick={false} axisLine={false} />
                <Tooltip
                  content={(props) => (
                    <ChartTooltip {...props} unit="%" format={(e) => (typeof e.value === "number" ? `${e.value}%` : String(e.value))} />
                  )}
                />
                <Radar dataKey="value" name="share" stroke={CHART.violet} fill={CHART.violet} fillOpacity={0.25} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 space-y-1.5 border-t border-border/60 pt-3">
            {emotions.map((e) => {
              const t = EMOTION_TONE[e.emotion] ?? "amber";
              return (
                <div key={e.emotion} className="flex items-center gap-2 min-w-0">
                  <span className={cn("size-2 rounded-[2px] shrink-0", emotionDotClass(t))} />
                  <span className="text-xs text-foreground truncate">{e.emotion}</span>
                  <span className="ml-auto font-mono text-[11px] tnum text-foreground shrink-0">{e.value}%</span>
                  <Delta value={e.delta} digits={1} suffix="pp" className="w-16 justify-end shrink-0" />
                </div>
              );
            })}
          </div>
        </Panel>
      </div>

      {/* shift alerts + topic comparison */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <Panel
          className="xl:col-span-5 min-w-0"
          title="Sentiment shift alerts"
          icon={Zap}
          sub={windowLabel}
          bodyClassName="p-0"
          right={<Badge tone={shifts.length > 0 ? "amber" : "neutral"}>{shifts.length} events</Badge>}
        >
          <div className="max-h-[380px] overflow-y-auto divide-y divide-border/60">
            {shifts.length === 0 && (
              <div className="px-4 py-8 text-center text-xs text-muted-foreground">
                No sentiment shifts detected in this window — Δnet stayed within the 0.16 threshold.
              </div>
            )}
            {shifts.map((s) => {
              const down = s.to < s.from;
              return (
                <div key={s.id} className="flex items-start gap-2.5 px-4 py-3">
                  {down ? (
                    <ArrowDownRight className="size-4 text-signal-red shrink-0 mt-0.5" strokeWidth={2} />
                  ) : (
                    <ArrowUpRight className="size-4 text-signal-green shrink-0 mt-0.5" strokeWidth={2} />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-xs font-medium text-foreground truncate">{s.topicLabel}</span>
                      <span className="font-mono text-[10px] tnum text-muted-foreground/80 whitespace-nowrap">
                        {s.windowLabel}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-1.5 font-mono text-[11px] tnum">
                      <span className={toneTextClass(sentimentTone(s.from))}>{fmtNet(s.from)}</span>
                      <ArrowRight className="size-3 text-muted-foreground shrink-0" />
                      <span className={toneTextClass(sentimentTone(s.to))}>{fmtNet(s.to)}</span>
                      <Delta value={(s.to - s.from) * 100} digits={1} suffix="pp" className="ml-auto" />
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">{s.note}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel
          className="xl:col-span-7 min-w-0"
          title="Topic sentiment comparison"
          icon={Scale}
          sub="select up to 5"
          bodyClassName="p-0"
        >
          {/* side-by-side comparison strip */}
          <div className="p-4 border-b border-border/60">
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-2">
              {selectedRows.map((r) => (
                <div key={r.topicId} className="border border-border rounded-md p-2.5 bg-muted/20 min-w-0">
                  <div className="text-[10px] text-muted-foreground truncate" title={r.label}>
                    {r.label}
                  </div>
                  <div className={cn("font-mono text-lg tnum leading-tight mt-1", toneTextClass(sentimentTone(r.net)))}>
                    {fmtNet(r.net)}
                  </div>
                  <div className="mt-1.5 flex items-center gap-1.5 font-mono text-[9px] tnum">
                    <span className="text-signal-green">{Math.round(r.positive * 100)}%</span>
                    <span className="text-muted-foreground/70">{Math.round(r.neutral * 100)}%</span>
                    <span className="text-signal-red">{Math.round(r.negative * 100)}%</span>
                  </div>
                </div>
              ))}
              {selectedRows.length === 0 && (
                <div className="col-span-full text-xs text-muted-foreground py-3 text-center">
                  Select topics below to compare side-by-side.
                </div>
              )}
            </div>
          </div>

          {/* comparison table */}
          <div className="overflow-auto max-h-[380px]">
            <table className="w-full text-left">
              <thead className="sticky top-0 bg-card z-10">
                <tr className="border-b border-border">
                  <th className="taxonomy text-muted-foreground/70 font-semibold px-4 py-2 w-10" />
                  {["Topic", "Volume", "Sentiment mix", "Net", "Shift"].map((h) => (
                    <th key={h} className="taxonomy text-muted-foreground/70 font-semibold px-4 py-2 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.map((r) => {
                  const checked = selectedIds.includes(r.topicId);
                  return (
                    <tr
                      key={r.topicId}
                      onClick={() => toggleCompare(r.topicId)}
                      className={cn(
                        "border-b border-border/50 last:border-0 hover:bg-accent cursor-pointer transition-colors",
                        checked && "bg-accent/50"
                      )}
                    >
                      <td className="px-4 py-2.5">
                        <Checkbox
                          checked={checked}
                          onClick={(e) => e.stopPropagation()}
                          onCheckedChange={() => toggleCompare(r.topicId)}
                          aria-label={`Compare ${r.label}`}
                        />
                      </td>
                      <td className="px-4 py-2.5 text-xs font-medium text-foreground max-w-44 truncate">
                        {r.label}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs tnum text-foreground whitespace-nowrap">
                        {fmtCompact(r.volume)}
                      </td>
                      <td className="px-4 py-2.5">
                        <div
                          className="flex h-1.5 w-24 rounded-sm overflow-hidden bg-muted"
                          title={`+${Math.round(r.positive * 100)}% · ${Math.round(r.neutral * 100)}% · −${Math.round(r.negative * 100)}%`}
                        >
                          <div className="bg-signal-green" style={{ width: `${r.positive * 100}%` }} />
                          <div className="bg-signal-slate" style={{ width: `${r.neutral * 100}%` }} />
                          <div className="bg-signal-red" style={{ width: `${r.negative * 100}%` }} />
                        </div>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <Badge tone={sentimentTone(r.net)}>{fmtNet(r.net)}</Badge>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <Delta value={r.shift * 100} digits={1} suffix="" />
                      </td>
                    </tr>
                  );
                })}
                {table.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8">
                      <div className="flex flex-col items-center text-center">
                        <SearchX className="size-6 text-muted-foreground/60" strokeWidth={1.5} />
                        <p className="mt-2 text-xs text-muted-foreground">
                          No narratives match the current filter bank.
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground/60 px-1">
        <Users className="size-3" />
        Source: aggregated public posts (X, Telegram) · anonymised cohorts · window {windowLabel} ·
        refresh cadence 5 min
      </div>
    </div>
  );
}
