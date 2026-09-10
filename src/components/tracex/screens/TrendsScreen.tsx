"use client";

/**
 * SCREEN 02 — TREND EXPLORER.
 * Narrative velocity vs baseline, spike flags, emerging narratives,
 * tracked keyword table and the per-topic drill-down sheet.
 */
import { useMemo, useState } from "react";
import { useApp } from "@/lib/app-state";
import {
  effectiveTopics,
  getTopicSeries,
  getTopicById,
  getSamplePosts,
  LANGUAGES,
  NOW,
  type Topic,
  type VolumePoint,
  type SamplePost,
} from "@/lib/mock";
import { fmtCompact, fmtSigned, fmtScore, relTime, riskTone } from "@/lib/fmt";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { Panel, Badge, Delta, ScoreBar, Legend, Chip, MetricRow, Taxonomy } from "../common/primitives";
import { Sparkline } from "../common/Sparkline";
import { HeatCalendar } from "../common/HeatCalendar";
import { ScreenHeader } from "../common/ScreenHeader";
import { ChartTooltip, CHART, GRID, useChartTheme } from "../common/ChartBits";
import { useRefresh, PanelSkeleton } from "../common/Skeletons";
import {
  ResponsiveContainer,
  ComposedChart,
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceDot,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  Flame,
  TrendingUp,
  TrendingDown,
  Minus,
  Search,
  SearchX,
  Hash,
  Star,
  Activity,
  Sparkles,
  ArrowUpRight,
  Users,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { downloadCsv, csvStamp } from "@/lib/csv";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";

const WINDOW_LABEL: Record<string, string> = {
  "24h": "last 24 hours",
  "7d": "last 7 days",
  "30d": "last 30 days",
  custom: "custom window",
};

const VELOCITY_META: Record<Topic["velocity"], { icon: LucideIcon; className: string }> = {
  surging: { icon: Flame, className: "text-signal-orange" },
  rising: { icon: TrendingUp, className: "text-signal-green" },
  steady: { icon: Minus, className: "text-muted-foreground" },
  declining: { icon: TrendingDown, className: "text-signal-red" },
};

const riskTextClass = (t: "green" | "amber" | "red") =>
  t === "red" ? "text-signal-red" : t === "amber" ? "text-signal-amber" : "text-signal-green";

/* ---------------- Sample post card (drill-down) ---------------- */

function PostCard({ post }: { post: SamplePost }) {
  return (
    <div className="border border-border rounded-md p-2.5 bg-muted/20">
      <div className="flex items-center gap-2 min-w-0">
        <span className="font-mono text-[11px] text-foreground truncate">{post.handle}</span>
        <Badge tone={post.platform === "x" ? "orange" : "cyan"} className="shrink-0">
          {post.platform === "x" ? "X" : "TG"}
        </Badge>
        {post.botProb > 0.5 && (
          <Badge tone="red" className="shrink-0">
            bot-flagged
          </Badge>
        )}
        <span className="ml-auto font-mono text-[10px] tnum text-muted-foreground/70 shrink-0">
          {relTime(NOW - post.minutesAgo * 60_000)}
        </span>
      </div>
      <p className="mt-1.5 text-[11px] leading-relaxed text-foreground/90">{post.text}</p>
      <div className="mt-2 flex items-center gap-3 min-w-0">
        <span className="font-mono text-[10px] tnum text-muted-foreground whitespace-nowrap truncate">
          ↻ {fmtCompact(post.engagement.reposts)} · {fmtCompact(post.engagement.replies)} replies ·{" "}
          {fmtCompact(post.engagement.likes)} likes
        </span>
        <span className="ml-auto flex items-center gap-1.5 min-w-0 w-20 shrink-0">
          <span className="font-mono text-[9px] text-muted-foreground shrink-0">bot P</span>
          <ScoreBar value={post.botProb} height="h-1" className="flex-1" />
        </span>
      </div>
    </div>
  );
}

/* ---------------- Drill-down sheet body ---------------- */

function TopicDrill({
  topic,
  series,
  volume24h,
  onSelectTopic,
}: {
  topic: Topic;
  series: VolumePoint[];
  volume24h: number;
  onSelectTopic: (id: string) => void;
}) {
  const chartTheme = useChartTheme();
  const { watchlist, toggleWatchlist, filters } = useApp();
  const posts = getSamplePosts(topic.id);
  const related = topic.relatedTopics
    .map((id) => getTopicById(id))
    .filter((t): t is Topic => t !== null);
  /* 30-day intensity strip — always daily-bucketed regardless of the active
     console range, so the drill-down shows the full month context. */
  const heatDays = useMemo(
    () =>
      getTopicSeries(topic, { ...filters, range: "30d" }).map((p) => ({
        t: p.t,
        total: p.total,
        spike: p.spike,
        label: p.label,
      })),
    [topic, filters]
  );

  const xVol = series.reduce((a, p) => a + p.x, 0);
  const tgVol = series.reduce((a, p) => a + p.telegram, 0);
  const totalVol = xVol + tgVol;
  const platformData = [
    { name: "X", value: xVol },
    { name: "Telegram", value: tgVol },
  ];
  const velocity = series.slice(-14).map((p) => ({ t: p.t, label: p.label, v: p.total }));

  const s = topic.sentiment;
  const dom =
    s.positive >= s.neutral && s.positive >= s.negative
      ? "positive"
      : s.negative >= s.neutral
        ? "negative"
        : "neutral";
  const domTone: "green" | "red" | "slate" = dom === "positive" ? "green" : dom === "negative" ? "red" : "slate";
  const langs = topic.languages
    .map((code) => LANGUAGES.find((l) => l.code === code)?.native ?? code)
    .join(" · ");

  return (
    <>
      <SheetHeader className="border-b border-border pb-3">
        <div className="flex items-center gap-2 flex-wrap pr-8">
          <SheetTitle className="font-display text-lg font-semibold tracking-tight text-foreground">
            {topic.label}
          </SheetTitle>
          <Badge tone="slate">{topic.category}</Badge>
          {topic.emerging && <Badge tone="orange">emerging</Badge>}
          <button
            type="button"
            onClick={() => toggleWatchlist(topic.id)}
            className="ml-auto size-6 rounded-sm border border-border flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors cursor-pointer"
            title={watchlist.includes(topic.id) ? "Remove from watchlist" : "Add to watchlist"}
            aria-label={watchlist.includes(topic.id) ? "Unwatch narrative" : "Watch narrative"}
          >
            <Star
              className={cn("size-3.5", watchlist.includes(topic.id) && "fill-primary text-primary")}
            />
          </button>
        </div>
        <SheetDescription className="text-xs leading-relaxed">{topic.gloss}</SheetDescription>
      </SheetHeader>

      <div className="p-4 space-y-4">
        {/* telemetry */}
        <div>
          <Taxonomy className="block mb-1">Telemetry</Taxonomy>
          <MetricRow label="Volume · 24h" value={fmtCompact(volume24h)} />
          <MetricRow label="24h change" value={<Delta value={topic.change24h} />} />
          <MetricRow
            label="Dominant sentiment"
            value={
              <Badge tone={domTone} dot>
                {dom}
              </Badge>
            }
          />
          <MetricRow
            label="Risk score"
            value={<span className={riskTextClass(riskTone(topic.risk))}>{fmtScore(topic.risk)}</span>}
          />
          {/* Languages list can be long — wrappable right-aligned row instead
              of MetricRow (whose value is shrink-0 and would overflow the sheet). */}
          <div className="flex items-baseline justify-between gap-3 py-1.5 border-b border-border/60 last:border-0">
            <span className="text-xs text-muted-foreground shrink-0">Languages</span>
            <span className="font-mono text-xs tnum text-foreground text-right min-w-0 break-words">
              {langs || "—"}
            </span>
          </div>
        </div>

        {/* 30-day intensity strip */}
        <div className="border border-border rounded-md p-3 pt-2.5">
          <div className="flex items-center justify-between">
            <Taxonomy>30-day intensity</Taxonomy>
            <span className="font-mono text-[9px] tnum text-muted-foreground/60">
              {heatDays.filter((d) => d.spike).length} spikes · ←/→ to walk
            </span>
          </div>
          <div className="mt-2">
            <HeatCalendar days={heatDays} compact />
          </div>
        </div>

        {/* platform split donut + velocity mini chart */}
        <div className="grid grid-cols-2 gap-3">
          <div className="border border-border rounded-md p-3 min-w-0">
            <Taxonomy>Platform split</Taxonomy>
            <div className="relative h-32 mt-1">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip
                    content={(props) => (
                      <ChartTooltip
                        {...props}
                        format={(e) =>
                          typeof e.value === "number"
                            ? `${((e.value / Math.max(1, totalVol)) * 100).toFixed(0)}%`
                            : String(e.value)
                        }
                      />
                    )}
                  />
                  <Pie data={platformData} dataKey="value" nameKey="name" innerRadius={36} outerRadius={54} strokeWidth={0}>
                    <Cell fill={CHART.orange} />
                    <Cell fill={CHART.green} />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="font-mono text-sm tnum text-foreground leading-none">
                  {fmtCompact(totalVol)}
                </span>
                <span className="taxonomy text-[9px] text-muted-foreground mt-1">posts</span>
              </div>
            </div>
            <div className="mt-1.5 flex justify-center">
              <Legend
                items={[
                  { label: `X ${Math.round((xVol / Math.max(1, totalVol)) * 100)}%`, color: CHART.orange },
                  { label: `TG ${Math.round((tgVol / Math.max(1, totalVol)) * 100)}%`, color: CHART.green },
                ]}
              />
            </div>
          </div>

          <div className="border border-border rounded-md p-3 min-w-0">
            <Taxonomy>Velocity</Taxonomy>
            <div className="h-32 -mx-1 mt-1">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={velocity} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                  <defs>
                    <linearGradient id="tvSheetVel" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CHART.orange} stopOpacity={0.45} />
                      <stop offset="100%" stopColor={CHART.orange} stopOpacity={0.1} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="t"
                    type="number"
                    domain={["dataMin", "dataMax"]}
                    tickFormatter={(t: number) => {
                      const p = velocity.find((s) => s.t === t);
                      return p?.label ?? "";
                    }}
                    minTickGap={40}
                    tick={{ fontSize: 9, fill: chartTheme.tick, fontFamily: "var(--font-jetbrains), monospace" }}
                    axisLine={{ stroke: chartTheme.grid }}
                    tickLine={false}
                  />
                  <YAxis hide domain={["dataMin", "dataMax"]} />
                  <CartesianGrid horizontal vertical={false} stroke={chartTheme.grid} strokeDasharray="3 5" strokeOpacity={0.5} />
                  <Tooltip
                    cursor={{ stroke: chartTheme.crosshair, strokeDasharray: "4 4" }}
                    content={(props) => (
                      <ChartTooltip
                        {...props}
                        label={(() => {
                          const p = velocity.find(
                            (s) => s.t === (props as { payload?: { t?: number } }).payload?.t
                          );
                          return p?.label ?? "";
                        })()}
                      />
                    )}
                  />
                  <Area dataKey="v" name="Volume" stroke={CHART.orange} strokeWidth={1.5} fill="url(#tvSheetVel)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* sample posts */}
        <div>
          <Taxonomy className="block mb-2">Sample posts</Taxonomy>
          <div className="space-y-2">
            {posts.map((p) => (
              <PostCard key={p.id} post={p} />
            ))}
          </div>
        </div>

        {/* related narratives */}
        <div className="border-t border-border/60 pt-3">
          <Taxonomy className="block mb-2">Related narratives</Taxonomy>
          <div className="flex flex-wrap gap-1.5">
            {related.length > 0 ? (
              related.map((t) => (
                <Chip key={t.id} onClick={() => onSelectTopic(t.id)} title={t.gloss}>
                  {t.label}
                </Chip>
              ))
            ) : (
              <span className="text-[11px] text-muted-foreground">No linked narratives.</span>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

/* ---------------- Main screen ---------------- */

export function TrendsScreen() {
  const { filters, go, selectedTopicId, setSelectedTopicId, resetFilters, watchlist, toggleWatchlist } = useApp();
  const ready = useRefresh("trends");
  const chartTheme = useChartTheme();
  const [kw, setKw] = useState("");
  /* local sheet state — opens on mount when arriving with a topic, then via selectTopic */
  const [sheetOpen, setSheetOpen] = useState(() => selectedTopicId != null);
  const selectTopic = (id: string) => {
    setSelectedTopicId(id);
    setSheetOpen(true);
  };
  const handleSheetOpenChange = (open: boolean) => {
    setSheetOpen(open);
    if (!open) setSelectedTopicId(null);
  };

  /* filter-aware topic rows (sorted by 24h change) */
  const topicRows = useMemo(
    () =>
      effectiveTopics(filters)
        .map(({ topic }) => {
          const series = getTopicSeries(topic, filters);
          return { topic, series, volume: series.reduce((a, p) => a + p.total, 0) };
        })
        .sort((a, b) => b.topic.change24h - a.topic.change24h),
    [filters]
  );

  const activeId = selectedTopicId ?? topicRows[0]?.topic.id ?? null;
  const activeRow = activeId ? (topicRows.find((r) => r.topic.id === activeId) ?? null) : null;
  const activeTopic = activeRow?.topic ?? getTopicById(activeId);
  const activeSeries = useMemo(() => {
    if (activeRow) return activeRow.series;
    if (activeTopic) return getTopicSeries(activeTopic, filters);
    return [];
  }, [activeRow, activeTopic, filters]);

  /* drill-down sheet lifecycle */
  const sheetTopic = getTopicById(selectedTopicId);
  const sheetSeries = useMemo(
    () => (sheetTopic ? getTopicSeries(sheetTopic, filters) : []),
    [sheetTopic, filters]
  );
  const sheet24h = useMemo(
    () =>
      sheetTopic
        ? getTopicSeries(sheetTopic, { ...filters, range: "24h" }).reduce((a, p) => a + p.total, 0)
        : 0,
    [sheetTopic, filters]
  );

  const emerging = topicRows.filter((r) => r.topic.emerging);
  const filteredRows =
    kw.trim() === ""
      ? topicRows
      : topicRows.filter((r) => {
          const hay = `${r.topic.label} ${r.topic.gloss} ${r.topic.category}`.toLowerCase();
          return kw
            .trim()
            .toLowerCase()
            .split(/\s+/)
            .every((tk) => hay.includes(tk.replace(/^[#:]/, "")));
        });

  if (!ready) {
    return (
      <div className="space-y-4 animate-in fade-in duration-200">
        <PanelSkeleton height="h-14" />
        <PanelSkeleton height="h-80" />
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
          <PanelSkeleton className="xl:col-span-5" height="h-64" />
          <PanelSkeleton className="xl:col-span-7" height="h-64" />
        </div>
      </div>
    );
  }

  const windowLabel = WINDOW_LABEL[filters.range] ?? "window";

  /* empty filter-bank state */
  if (topicRows.length === 0) {
    return (
      <div className="space-y-4 animate-in fade-in duration-300">
        <ScreenHeader
          kicker="MODULE 02 // TREND EXPLORER"
          title="Trend Explorer"
          description="Narrative velocity against historical baselines, spike detection and emerging-narrative flags across X and Telegram."
          right={<Badge tone="cyan" dot>{filters.platform === "all" ? "X + Telegram" : filters.platform === "x" ? "X only" : "Telegram only"}</Badge>}
        />
        <Panel title="Monitored narratives" icon={SearchX} sub="no results">
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <SearchX className="size-8 text-muted-foreground/60" strokeWidth={1.5} />
            <p className="mt-3 text-sm font-medium text-foreground">
              No narratives match the current filter bank
            </p>
            <p className="mt-1 text-xs text-muted-foreground max-w-md">
              Adjust the platform, language or search filters in the top bar, or reset the filter
              bank to restore the monitored narrative set.
            </p>
            <Button variant="outline" size="sm" className="mt-4 h-7 text-[11px]" onClick={resetFilters}>
              Reset filter bank
            </Button>
          </div>
        </Panel>
      </div>
    );
  }

  const topChips = topicRows.slice(0, 10);
  const moreChips = topicRows.slice(10);
  /* active topic when it lives beyond the visible chip row */
  const activeMore = activeId ? (moreChips.find((r) => r.topic.id === activeId) ?? null) : null;

  /* velocity stats strip */
  const peak = activeSeries.length ? activeSeries.reduce((a, b) => (b.total > a.total ? b : a)) : null;
  const avgTotal = activeSeries.length
    ? activeSeries.reduce((a, p) => a + p.total, 0) / activeSeries.length
    : 0;
  const avgBase = activeSeries.length
    ? activeSeries.reduce((a, p) => a + p.baseline, 0) / activeSeries.length
    : 0;
  const vsBaseline = avgBase > 0 ? (avgTotal / avgBase - 1) * 100 : 0;
  const spikeCount = activeSeries.filter((p) => p.spike).length;

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <ScreenHeader
        kicker="MODULE 02 // TREND EXPLORER"
        title="Trend Explorer"
        description={`Narrative velocity against historical baselines for the ${windowLabel} — spike flags, emerging narratives and per-topic drill-down across X and Telegram.`}
        right={
          <div className="flex items-center gap-2">
            <Badge tone="cyan" dot>
              {filters.platform === "all" ? "X + Telegram" : filters.platform === "x" ? "X only" : "Telegram only"}
            </Badge>
            <Badge tone="neutral" dot>
              {topicRows.length} narratives
            </Badge>
            <Button variant="outline" size="sm" className="h-7 text-[11px] gap-1.5" onClick={() => go("sentiment")}>
              Sentiment lab <ArrowUpRight className="size-3" />
            </Button>
          </div>
        }
      />

      {/* topic selector */}
      <Panel
        title="Monitored narratives"
        icon={Hash}
        sub={`${topicRows.length} tracked`}
        bodyClassName="p-3"
        right={<span className="font-mono text-[10px] text-muted-foreground/70 hidden sm:inline">sorted by 24h Δ</span>}
      >
        <div className="flex flex-wrap items-center gap-1.5">
          {topChips.map(({ topic }) => (
            <Chip
              key={topic.id}
              active={topic.id === activeId}
              onClick={() => selectTopic(topic.id)}
              title={topic.gloss}
            >
              {topic.label}
              <span className="ml-1.5 font-mono text-[10px] tnum opacity-70">
                {fmtSigned(topic.change24h)}%
              </span>
            </Chip>
          ))}
          {moreChips.length > 0 && (
            <Select
              value={activeMore?.topic.id ?? "__none__"}
              onValueChange={(v) => {
                if (v !== "__none__") selectTopic(v);
              }}
            >
              <SelectTrigger
                size="sm"
                className="h-7 rounded-sm text-[11px] gap-1.5 px-2 font-medium text-muted-foreground"
                aria-label="More narratives"
              >
                <span className="truncate max-w-36">
                  {activeMore ? activeMore.topic.label : `+${moreChips.length} more`}
                </span>
              </SelectTrigger>
              <SelectContent className="rounded-md">
                {moreChips.map(({ topic }) => (
                  <SelectItem key={topic.id} value={topic.id} className="text-xs rounded-sm">
                    {topic.label}
                    <span className="ml-1.5 font-mono text-[10px] tnum text-muted-foreground">
                      {fmtSigned(topic.change24h)}%
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </Panel>

      {/* main velocity chart */}
      <Panel
        title="Narrative velocity"
        icon={Activity}
        sub={`${activeTopic?.label ?? "—"} · ${windowLabel}`}
        right={
          <Legend
            items={[
              { label: "Volume", color: CHART.orange },
              { label: "Baseline", color: CHART.cyan, dashed: true },
              { label: "Spike flag", color: CHART.amber },
            ]}
          />
        }
      >
        <div className="h-72 md:h-80 -mx-1">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={activeSeries} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="tvVel" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART.orange} stopOpacity={0.5} />
                  <stop offset="100%" stopColor={CHART.orange} stopOpacity={0.16} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={chartTheme.grid} strokeDasharray={GRID.strokeDasharray} vertical={GRID.vertical} />
              <XAxis
                dataKey="t"
                type="number"
                domain={["dataMin", "dataMax"]}
                tickFormatter={(t: number) => {
                  const p = activeSeries.find((s) => s.t === t);
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
                      const p = activeSeries.find(
                        (s) => s.t === (props as { payload?: { t?: number } }).payload?.t
                      );
                      return p?.label ?? "";
                    })()}
                    labelExtra={
                      (props as { payload?: { spike?: boolean } }).payload?.spike ? (
                        <Badge tone="amber">spike</Badge>
                      ) : null
                    }
                  />
                )}
              />
              <Area dataKey="total" name="Volume" stroke={CHART.orange} strokeWidth={1.5} fill="url(#tvVel)" />
              <Line
                dataKey="baseline"
                name="Baseline"
                stroke={CHART.cyan}
                strokeWidth={1.25}
                strokeDasharray="4 4"
                dot={false}
              />
              {activeSeries
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
        <div className="mt-3 grid grid-cols-3 gap-3 border-t border-border/60 pt-3">
          <div>
            <Taxonomy>Peak volume</Taxonomy>
            <div className="font-mono text-sm tnum text-foreground mt-0.5">
              {peak ? `${peak.label} · ${fmtCompact(peak.total)}` : "—"}
            </div>
          </div>
          <div>
            <Taxonomy>Avg vs baseline</Taxonomy>
            <div
              className={cn(
                "font-mono text-sm tnum mt-0.5",
                vsBaseline >= 0 ? "text-signal-green" : "text-signal-red"
              )}
            >
              {fmtSigned(vsBaseline, 1)}%
            </div>
          </div>
          <div>
            <Taxonomy>Spikes flagged</Taxonomy>
            <div className="font-mono text-sm tnum text-signal-amber mt-0.5">
              {spikeCount} vs baseline
            </div>
          </div>
        </div>
      </Panel>

      {/* emerging narratives + keyword table */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <Panel
          className="xl:col-span-5 min-w-0"
          title="Emerging narratives"
          icon={Sparkles}
          sub={`${emerging.length} flagged`}
          bodyClassName="p-0"
          scroll
        >
          {emerging.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-muted-foreground">
              No narratives exceeded their baseline in this window.
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {emerging.map(({ topic, series }) => (
                <button
                  key={topic.id}
                  type="button"
                  onClick={() => selectTopic(topic.id)}
                  className="w-full text-left px-4 py-3 hover:bg-accent transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Flame className="size-3.5 text-signal-orange shrink-0" />
                    <span className="text-xs font-medium text-foreground truncate group-hover:text-primary transition-colors">
                      {topic.label}
                    </span>
                    <Delta value={topic.change24h} className="ml-auto shrink-0" />
                  </div>
                  <div className="mt-0.5 text-[10px] text-muted-foreground truncate pl-[22px]">
                    {topic.gloss}
                  </div>
                  <div className="mt-2 flex items-center gap-3 pl-[22px]">
                    <Sparkline data={series.map((p) => p.total)} color={CHART.orange} width={96} height={22} />
                    <ScoreBar value={topic.risk} showValue className="flex-1 min-w-14" />
                    <span className="font-mono text-[10px] tnum text-muted-foreground shrink-0">
                      {topic.spikeDay !== null ? `spike −${topic.spikeDay}d` : "no spike"}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </Panel>

        <Panel
          className="xl:col-span-7 min-w-0"
          title="Tracked keywords & hashtags"
          icon={Hash}
          sub={`${filteredRows.length}/${topicRows.length} tracked`}
          bodyClassName="p-0"
          right={
            <Legend
              items={[
                { label: "X", color: CHART.orange },
                { label: "TG", color: CHART.cyan },
              ]}
            />
          }
        >
          <div className="px-4 py-2.5 border-b border-border flex items-center gap-3">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
              <Input
                value={kw}
                onChange={(e) => setKw(e.target.value)}
                placeholder="Filter keywords · hashtags · categories"
                className="h-7 rounded-sm pl-8 text-xs"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2.5 text-[11px] gap-1.5 shrink-0"
              title="Export the visible keyword table as CSV"
              onClick={() => {
                downloadCsv(
                  `tracex-keywords-${csvStamp()}.csv`,
                  ["keyword", "category", "velocity", "volume", "change_24h_pct", "risk", "x_share", "watched"],
                  filteredRows.map((r) => [
                    r.topic.label,
                    r.topic.category,
                    r.topic.velocity,
                    Math.round(r.volume),
                    r.topic.change24h.toFixed(1),
                    r.topic.risk.toFixed(2),
                    Math.round(r.topic.xShare * 100) + "%",
                    watchlist.includes(r.topic.id) ? "yes" : "no",
                  ])
                );
                toast("Keyword table exported", {
                  description: `${filteredRows.length} narratives → CSV (current filter bank).`,
                });
              }}
            >
              <Download className="size-3.5" /> CSV
            </Button>
            <span className="ml-auto font-mono text-[10px] tnum text-muted-foreground shrink-0 hidden sm:inline">
              click a row to drill down
            </span>
          </div>
          <div className="overflow-auto max-h-[520px]">
            <table className="w-full text-left">
              <thead className="sticky top-0 bg-card z-10">
                <tr className="border-b border-border">
                  {["", "Keyword / hashtag", "Category", "Volume", "24h Δ", "Platforms", "Risk"].map((h, i) => (
                    <th key={i} className="taxonomy text-muted-foreground/70 font-semibold px-4 py-2 whitespace-nowrap w-8 first:w-8">
                      {h === "" ? <Star className="size-2.5 text-muted-foreground/50" /> : h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRows.map(({ topic, volume }) => {
                  const meta = VELOCITY_META[topic.velocity];
                  return (
                    <tr
                      key={topic.id}
                      onClick={() => selectTopic(topic.id)}
                      className="border-b border-border/50 last:border-0 hover:bg-accent cursor-pointer transition-colors"
                    >
                      <td className="px-2 py-2.5 w-8" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => toggleWatchlist(topic.id)}
                          className="size-5 rounded-sm flex items-center justify-center text-muted-foreground/50 hover:text-primary transition-colors cursor-pointer"
                          title={watchlist.includes(topic.id) ? "Remove from watchlist" : "Add to watchlist"}
                          aria-label={watchlist.includes(topic.id) ? "Unwatch narrative" : "Watch narrative"}
                        >
                          <Star
                            className={cn(
                              "size-3.5",
                              watchlist.includes(topic.id) && "fill-primary text-primary"
                            )}
                          />
                        </button>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <meta.icon className={cn("size-3 shrink-0", meta.className)} strokeWidth={2} />
                          <div className="min-w-0">
                            <div className="text-xs font-medium text-foreground truncate max-w-40">
                              {topic.label}
                            </div>
                            <div className="text-[10px] text-muted-foreground truncate max-w-48 mt-0.5">
                              {topic.gloss}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <Badge tone="slate">{topic.category}</Badge>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs tnum text-foreground whitespace-nowrap">
                        {fmtCompact(volume)}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <Delta value={topic.change24h} />
                      </td>
                      <td className="px-4 py-2.5">
                        <div
                          className="flex h-1.5 w-20 rounded-sm overflow-hidden bg-muted"
                          title={`X ${Math.round(topic.xShare * 100)}% · Telegram ${Math.round((1 - topic.xShare) * 100)}%`}
                        >
                          <div className="bg-signal-orange" style={{ width: `${topic.xShare * 100}%` }} />
                          <div className="bg-signal-cyan" style={{ width: `${(1 - topic.xShare) * 100}%` }} />
                        </div>
                      </td>
                      <td className="px-4 py-2.5 w-28">
                        <ScoreBar value={topic.risk} showValue />
                      </td>
                    </tr>
                  );
                })}
                {filteredRows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-xs text-muted-foreground">
                      No tracked keywords match “{kw}”.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      {/* drill-down sheet */}
      <Sheet open={sheetOpen} onOpenChange={handleSheetOpenChange}>
        <SheetContent side="right" className="w-[420px] sm:max-w-[420px] gap-0 overflow-y-auto">
          {sheetTopic && (
            <TopicDrill
              key={sheetTopic.id}
              topic={sheetTopic}
              series={sheetSeries}
              volume24h={sheet24h}
              onSelectTopic={(id) => selectTopic(id)}
            />
          )}
        </SheetContent>
      </Sheet>

      <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground/60 px-1">
        <Users className="size-3" />
        Source: aggregated public posts (X, Telegram) · anonymised cohorts · window {windowLabel} ·
        prototype data
      </div>
    </div>
  );
}
