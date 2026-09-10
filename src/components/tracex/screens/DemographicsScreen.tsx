"use client";

/**
 * DEMOGRAPHICS — MODULE 04.
 * Aggregated, anonymised audience cohorts: geography, language mix, age
 * brackets, interest affinity, diurnal rhythm. k≥50 enforced throughout.
 * The active filter scope deterministically reweights the cohort model.
 */
import { useMemo } from "react";
import { useApp } from "@/lib/app-state";
import { DEMOGRAPHICS } from "@/lib/mock";
import type { LanguageShare, StateShare } from "@/lib/mock";
import { fmtFull } from "@/lib/fmt";
import { Panel, Badge, Taxonomy, MetricRow, Legend } from "../common/primitives";
import { KpiCard } from "../common/KpiCard";
import { ScreenHeader } from "../common/ScreenHeader";
import { ChartTooltip, CHART, GRID, useChartTheme } from "../common/ChartBits";
import { useRefresh, KpiRowSkeleton, PanelSkeleton } from "../common/Skeletons";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  PieChart,
  Pie,
  AreaChart,
  Area,
} from "recharts";
import {
  ShieldCheck,
  MapPin,
  Languages,
  Users,
  Layers,
  Activity,
  FileText,
  CalendarClock,
  Tag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadCsv, csvStamp } from "@/lib/csv";
import { toast } from "sonner";

/* ---------------- deterministic cohort reweighting ---------------- */

const METRO_STATES = new Set(["Delhi NCR", "Karnataka", "Maharashtra"]);

const LANG_COLORS: Record<string, string> = {
  hi: CHART.orange,
  en: CHART.cyan,
  hinglish: CHART.green,
  ta: CHART.amber,
  te: CHART.violet,
  bn: CHART.slate,
};

/** Reweight a share-table to a fixed total (default 100) — deterministic. */
function reweight<T extends { share: number }>(
  rows: T[],
  weightOf: (row: T) => number,
  total = 100
): T[] {
  const raw = rows.map((r) => r.share * weightOf(r));
  const sum = raw.reduce((a, b) => a + b, 0) || 1;
  return rows.map((r, i) => ({ ...r, share: Number(((raw[i] / sum) * total).toFixed(1)) }));
}

interface CohortModel {
  states: StateShare[];
  languages: LanguageShare[];
  ages: { bracket: string; share: number }[];
  interests: { label: string; share: number }[];
  activitySeries: { hour: string; share: number }[];
  peakIdx: number;
  peakShare: number;
  eveningShare: number;
}

function buildCohortModel(platform: string, selectedLangs: string[]): CohortModel {
  // --- states: platform skews the geography mix ---
  const totalVolume = DEMOGRAPHICS.states.reduce((a, s) => a + s.volume, 0);
  const stateWeight = (s: StateShare) => {
    if (platform === "x" && METRO_STATES.has(s.state)) return 1.15;
    if (platform === "telegram" && !METRO_STATES.has(s.state) && s.state !== "Other states") return 1.18;
    return 1;
  };
  const weightedStates = reweight(DEMOGRAPHICS.states, stateWeight)
    .map((s) => ({ ...s, volume: Math.round((s.share / 100) * totalVolume) }))
    .sort((a, b) => b.share - a.share);
  const other = weightedStates.find((s) => s.state === "Other states");
  const states = [
    ...weightedStates.filter((s) => s.state !== "Other states"),
    ...(other ? [other] : []),
  ];

  // --- languages: explicit language filter boosts matching shares ---
  const selected = new Set(selectedLangs);
  const languages = reweight(DEMOGRAPHICS.languages, (l) =>
    selected.size > 0 ? (selected.has(l.code) ? 1.75 : 0.65) : 1
  ).sort((a, b) => b.share - a.share);

  // --- age brackets: platform tilts the inferred cohort curve ---
  const ages = reweight(DEMOGRAPHICS.ages, (a) => {
    if (platform === "x" && a.bracket === "18–24") return 1.12;
    if (platform === "telegram" && (a.bracket === "35–44" || a.bracket === "45–54")) return 1.15;
    return 1;
  });

  // --- interests: affinity shares stay raw (multi-label), light tilt ---
  const interests = DEMOGRAPHICS.interests
    .map((it) => ({
      ...it,
      share: Number(
        (
          it.share *
          (platform === "x" && (it.label === "Cricket & Sports" || it.label === "Technology")
            ? 1.1
            : platform === "telegram" && it.label === "Politics & Governance"
              ? 1.12
              : 1)
        ).toFixed(0)
      ),
    }))
    .sort((a, b) => b.share - a.share);

  // --- diurnal rhythm: static 24h profile ---
  const activityByHour = DEMOGRAPHICS.activityByHour;
  const totalActivity = activityByHour.reduce((a, b) => a + b, 0) || 1;
  const peakIdx = activityByHour.indexOf(Math.max(...activityByHour));
  const peakShare = activityByHour[peakIdx] ?? 0;
  const eveningShare = (activityByHour.slice(18).reduce((a, b) => a + b, 0) / totalActivity) * 100;

  return {
    states,
    languages,
    ages,
    interests,
    activitySeries: activityByHour.map((v, h) => ({ hour: String(h).padStart(2, "0"), share: v })),
    peakIdx,
    peakShare,
    eveningShare,
  };
}

/* ---------------- screen ---------------- */

export function DemographicsScreen() {
  const { filters } = useApp();
  const ready = useRefresh("demographics");
  const chartTheme = useChartTheme();

  const demo = useMemo(
    () => buildCohortModel(filters.platform, filters.languages),
    [filters.platform, filters.languages]
  );

  const namedStateCount = demo.states.filter((s) => s.state !== "Other states").length;
  const topAge = demo.ages.reduce((a, b) => (b.share > a.share ? b : a));
  const maxInterest = demo.interests[0]?.share ?? 1;
  const peakLabel = String(demo.peakIdx).padStart(2, "0");

  if (!ready) {
    return (
      <div className="space-y-4 animate-in fade-in duration-200">
        <div className="h-14 rounded-lg bg-card border border-border" />
        <KpiRowSkeleton />
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
          <PanelSkeleton className="xl:col-span-7" height="h-80" />
          <PanelSkeleton className="xl:col-span-5" height="h-80" />
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
          <PanelSkeleton className="xl:col-span-4" height="h-52" />
          <PanelSkeleton className="xl:col-span-4" height="h-52" />
          <PanelSkeleton className="xl:col-span-4" height="h-52" />
        </div>
      </div>
    );
  }

  const scopeLabel =
    filters.platform === "all" ? "X + Telegram" : filters.platform === "x" ? "X only" : "Telegram only";

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <ScreenHeader
        kicker="MODULE 04 // DEMOGRAPHICS"
        title="Demographics & Audience Cohorts"
        description="Anonymised, cohort-level audience composition for the active filter scope — geography, language mix, age brackets, interest affinity and diurnal activity rhythm. All statistics aggregated at k-anonymity ≥ 50."
        right={
          <div className="flex items-center gap-2">
            <Badge tone="cyan" dot>{scopeLabel}</Badge>
            <Badge tone="green" dot>k ≥ 50</Badge>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[11px] gap-1.5"
              title="Export the anonymised cohort tables as CSV"
              onClick={() => {
                const rows: (string | number)[][] = [
                  ...demo.states.map((s) => ["state", s.state, s.share.toFixed(1), s.volume]),
                  ...demo.languages.map((l) => ["language", l.label, l.share.toFixed(1), ""]),
                  ...demo.ages.map((a) => ["age_bracket", a.bracket, a.share.toFixed(1), ""]),
                  ...demo.interests.map((it) => ["interest", it.label, it.share, ""]),
                ];
                downloadCsv(
                  `tracex-cohorts-${csvStamp()}.csv`,
                  ["dimension", "label", "share_pct", "volume"],
                  rows
                );
                toast("Cohort tables exported", {
                  description: `${rows.length} anonymised rows → CSV (states · languages · ages · interests).`,
                });
              }}
            >
              CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[11px] gap-1.5"
              onClick={() => {
                toast("Cohort digest queued", {
                  description: "Anonymised demographic summary attached to the daily briefing (mock).",
                });
              }}
            >
              <ShieldCheck className="size-3.5" /> Cohort digest
            </Button>
          </div>
        }
      />

      {/* Privacy envelope banner */}
      <div className="flex items-center gap-3 bg-signal-green/10 border border-signal-green/30 rounded-lg px-4 py-2.5">
        <ShieldCheck className="size-4 text-signal-green shrink-0" strokeWidth={1.75} />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-foreground leading-tight">
            All demographic data is aggregated and anonymized — no individual profiling.
          </p>
          <p className="text-[10px] font-mono text-muted-foreground mt-0.5">
            Cohort-level statistics only · k-anonymity k≥50 · PII suppressed at ingest
          </p>
        </div>
        <Badge tone="green" className="shrink-0">PRIVACY ENVELOPE</Badge>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Audience segments"
          value={String(namedStateCount)}
          icon={MapPin}
          tone="cyan"
          delta={2.4}
          spark={demo.states.filter((s) => s.state !== "Other states").map((s) => s.share)}
          sparkColor={CHART.cyan}
          footnote={
            <span>
              {demo.states[0]?.state} leads · {demo.states[0]?.share.toFixed(1)}%
            </span>
          }
        />
        <KpiCard
          label="Dominant cohort"
          value={topAge.bracket}
          icon={Users}
          tone="orange"
          delta={1.1}
          spark={demo.ages.map((a) => a.share)}
          sparkColor={CHART.orange}
          footnote={<span>{topAge.share.toFixed(1)}% of sampled accounts · inferred</span>}
        />
        <KpiCard
          label="Languages detected"
          value={String(demo.languages.length)}
          icon={Languages}
          tone="cyan"
          spark={demo.languages.map((l) => l.share)}
          sparkColor={CHART.violet}
          footnote={
            <span>
              {filters.languages.length > 0
                ? `${filters.languages.length} filter-selected`
                : "hi · en · hinglish lead"}
            </span>
          }
        />
        <KpiCard
          label="Interest clusters"
          value={String(demo.interests.length)}
          icon={Layers}
          tone="green"
          delta={-0.8}
          spark={demo.interests.map((i) => i.share)}
          sparkColor={CHART.green}
          footnote={
            <span>
              {demo.interests[0]?.label} · {demo.interests[0]?.share}% affinity
            </span>
          }
        />
      </div>

      {/* Location + language split */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <Panel
          className="xl:col-span-7 min-w-0"
          title="Location distribution"
          sub="state-level · NER"
          icon={MapPin}
          right={<Legend items={[{ label: "share of tracked posts", color: CHART.cyan }]} />}
        >
          <div className="h-72 md:h-80 -mx-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={demo.states}
                layout="vertical"
                margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  stroke={chartTheme.grid}
                  strokeDasharray={GRID.strokeDasharray}
                  vertical={GRID.vertical}
                />
                <XAxis
                  type="number"
                  dataKey="share"
                  domain={[0, "dataMax"]}
                  allowDecimals={false}
                  tickFormatter={(v: number) => `${Math.round(v)}%`}
                  tick={{ fontSize: 10, fill: chartTheme.tick, fontFamily: "var(--font-jetbrains), monospace" }}
                  axisLine={{ stroke: chartTheme.grid }}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="state"
                  width={110}
                  interval={0}
                  tick={{ fontSize: 10, fill: chartTheme.tick, fontFamily: "var(--font-jetbrains), monospace" }}
                  axisLine={{ stroke: chartTheme.grid }}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: chartTheme.crosshair, fillOpacity: 0.15 }}
                  content={(props) => {
                    const { active, payload } = props as {
                      active?: boolean;
                      payload?: { payload?: StateShare }[];
                    };
                    const p = payload?.[0]?.payload;
                    if (!active || !p) return null;
                    return (
                      <ChartTooltip
                        active
                        label={p.state}
                        labelExtra={
                          <span className="font-mono text-[10px] tnum text-muted-foreground">
                            {fmtFull(p.volume)} posts
                          </span>
                        }
                        payload={[
                          { name: "Share of tracked posts", value: `${p.share.toFixed(1)}%`, color: CHART.cyan },
                        ]}
                      />
                    );
                  }}
                />
                <Bar dataKey="share" name="Share" barSize={12} radius={[0, 2, 2, 0]} fill={CHART.cyan}>
                  {demo.states.map((s, i) => (
                    <Cell
                      key={s.state}
                      fill={CHART.cyan}
                      fillOpacity={i === 0 ? 1 : Math.max(0.45, 0.95 - i * 0.045)}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 border-t border-border/60 pt-2 text-[10px] font-mono text-muted-foreground/60">
            Explicit traits via NER on public posts (location mentions, profile language)
          </div>
        </Panel>

        <Panel
          className="xl:col-span-5 min-w-0"
          title="Language split"
          sub={`${demo.languages.length} detected`}
          icon={Languages}
          right={<Badge tone="violet" dot>code-mixed</Badge>}
        >
          <div className="flex flex-col sm:flex-row items-center gap-5">
            <div className="relative w-44 h-44 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={demo.languages}
                    dataKey="share"
                    nameKey="label"
                    innerRadius="55%"
                    outerRadius="82%"
                    paddingAngle={2}
                    stroke="none"
                  >
                    {demo.languages.map((l) => (
                      <Cell key={l.code} fill={LANG_COLORS[l.code] ?? "#64748B"} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={(props) => {
                      const { active, payload } = props as {
                        active?: boolean;
                        payload?: { payload?: LanguageShare }[];
                      };
                      const p = payload?.[0]?.payload;
                      if (!active || !p) return null;
                      return (
                        <ChartTooltip
                          active
                          label={p.label}
                          payload={[
                            {
                              name: `${p.native} · share`,
                              value: `${p.share.toFixed(1)}%`,
                              color: LANG_COLORS[p.code] ?? "#64748B",
                            },
                          ]}
                        />
                      );
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="font-mono text-xl tnum text-foreground leading-none">
                  {demo.languages.length}
                </span>
                <span className="taxonomy mt-1">languages</span>
              </div>
            </div>
            <div className="flex-1 w-full min-w-0">
              {demo.languages.map((l) => (
                <div key={l.code} className="flex items-center gap-2 py-[3px]">
                  <span
                    className="size-2 rounded-[2px] shrink-0"
                    style={{ background: LANG_COLORS[l.code] ?? "#64748B" }}
                  />
                  <span className="text-xs text-foreground truncate">{l.native}</span>
                  <span className="text-[10px] text-muted-foreground/70 truncate hidden sm:inline">
                    {l.label}
                  </span>
                  <span className="ml-auto font-mono text-[11px] tnum text-foreground shrink-0">
                    {l.share.toFixed(1)}%
                  </span>
                </div>
              ))}
              <div className="mt-2 border-t border-border/60 pt-2 text-[10px] font-mono text-muted-foreground/60">
                Code-mixed (Hinglish) tracked as a first-class category — core TraceX differentiator
              </div>
            </div>
          </div>
        </Panel>
      </div>

      {/* Age + interests + activity rhythm */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <Panel
          className="xl:col-span-4 min-w-0"
          title="Age bracket distribution"
          sub="inferred"
          icon={CalendarClock}
        >
          <div className="h-52 -mx-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={demo.ages} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid
                  stroke={chartTheme.grid}
                  strokeDasharray={GRID.strokeDasharray}
                  vertical={GRID.vertical}
                />
                <XAxis
                  dataKey="bracket"
                  interval={0}
                  tick={{ fontSize: 10, fill: chartTheme.tick, fontFamily: "var(--font-jetbrains), monospace" }}
                  axisLine={{ stroke: chartTheme.grid }}
                  tickLine={false}
                />
                <YAxis
                  width={34}
                  allowDecimals={false}
                  tickFormatter={(v: number) => `${v}%`}
                  tick={{ fontSize: 10, fill: chartTheme.tick, fontFamily: "var(--font-jetbrains), monospace" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: chartTheme.crosshair, fillOpacity: 0.15 }}
                  content={(props) => {
                    const { active, payload } = props as {
                      active?: boolean;
                      payload?: { payload?: { bracket: string; share: number } }[];
                    };
                    const p = payload?.[0]?.payload;
                    if (!active || !p) return null;
                    return (
                      <ChartTooltip
                        active
                        label={p.bracket}
                        payload={[{ name: "Cohort share", value: `${p.share.toFixed(1)}%`, color: CHART.orange }]}
                      />
                    );
                  }}
                />
                <Bar dataKey="share" name="Share" barSize={30} radius={[2, 2, 0, 0]} fill={CHART.orange}>
                  {demo.ages.map((a) => (
                    <Cell
                      key={a.bracket}
                      fill={CHART.orange}
                      fillOpacity={a.bracket === topAge.bracket ? 1 : 0.45}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 border-t border-border/60 pt-2 text-[10px] font-mono text-muted-foreground/60">
            Implicit traits inferred via aggregate ML classifiers
          </div>
        </Panel>

        <Panel
          className="xl:col-span-4 min-w-0"
          title="Interest categories"
          sub="affinity · ranked"
          icon={Tag}
        >
          <div className="space-y-2.5">
            {demo.interests.map((it, i) => (
              <div key={it.label} className="flex items-center gap-3">
                <span className="text-[11px] text-muted-foreground w-36 shrink-0 truncate">{it.label}</span>
                <div className="flex-1 h-1.5 min-w-10 rounded-sm bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-sm"
                    style={{
                      width: `${Math.max(4, (it.share / maxInterest) * 100)}%`,
                      background: CHART.green,
                      opacity: Math.max(0.5, 1 - i * 0.07),
                    }}
                  />
                </div>
                <span className="font-mono text-[11px] tnum text-foreground w-9 text-right shrink-0">
                  {it.share}%
                </span>
              </div>
            ))}
          </div>
          <div className="mt-3 border-t border-border/60 pt-2 text-[10px] font-mono text-muted-foreground/60">
            Interest affinity from topic engagement, cohort-level · multi-label, shares overlap
          </div>
        </Panel>

        <Panel
          className="xl:col-span-4 min-w-0"
          title="Activity rhythm"
          sub="IST · 24h"
          icon={Activity}
        >
          <div className="h-52 -mx-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={demo.activitySeries} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="demoActivity" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART.violet} stopOpacity={0.4} />
                    <stop offset="100%" stopColor={CHART.violet} stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  stroke={chartTheme.grid}
                  strokeDasharray={GRID.strokeDasharray}
                  vertical={GRID.vertical}
                />
                <XAxis
                  dataKey="hour"
                  interval={3}
                  tick={{ fontSize: 10, fill: chartTheme.tick, fontFamily: "var(--font-jetbrains), monospace" }}
                  axisLine={{ stroke: chartTheme.grid }}
                  tickLine={false}
                />
                <YAxis
                  width={30}
                  tickFormatter={(v: number) => `${v}%`}
                  tick={{ fontSize: 10, fill: chartTheme.tick, fontFamily: "var(--font-jetbrains), monospace" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ stroke: chartTheme.crosshair, strokeDasharray: "4 4" }}
                  content={(props) => {
                    const { active, payload } = props as {
                      active?: boolean;
                      payload?: { payload?: { hour: string; share: number } }[];
                    };
                    const p = payload?.[0]?.payload;
                    if (!active || !p) return null;
                    return (
                      <ChartTooltip
                        active
                        label={`${p.hour}:00 IST`}
                        payload={[
                          { name: "Share of daily volume", value: `${p.share.toFixed(1)}%`, color: CHART.violet },
                        ]}
                      />
                    );
                  }}
                />
                <Area
                  dataKey="share"
                  name="Share"
                  stroke={CHART.violet}
                  strokeWidth={1.5}
                  fill="url(#demoActivity)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3">
            <MetricRow
              label="Peak hour"
              value={`${peakLabel}:00 IST`}
              sub={`${demo.peakShare.toFixed(1)}% of daily volume`}
            />
            <MetricRow
              label="Evening band 18–23"
              value={`${demo.eveningShare.toFixed(1)}%`}
              sub="of daily volume"
            />
          </div>
        </Panel>
      </div>

      {/* Methodology */}
      <Panel
        title="Methodology & privacy"
        icon={FileText}
        right={<Badge tone="green" dot>k ≥ 50 enforced</Badge>}
      >
        <p className="text-xs text-muted-foreground leading-relaxed max-w-4xl">
          {DEMOGRAPHICS.methodology}
        </p>
        <div className="mt-3 border-t border-border/60 pt-2 font-mono text-[10px] text-muted-foreground/70 tracking-wide">
          NER: location, language · classifier: age bracket, interests · k≥50 enforced
        </div>
      </Panel>

      <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground/60 px-1">
        <ShieldCheck className="size-3" />
        Source: aggregated public posts (X, Telegram) · anonymised cohorts k≥50 · reweighted for{" "}
        {scopeLabel} · prototype data
      </div>
    </div>
  );
}
