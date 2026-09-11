"use client";

/**
 * Narrative compare console (v0.14 → v0.17) —
 * 2 pins: side-by-side A/B dossier: overlaid velocity chart, metric-vs-metric
 * table with lead indicators, sentiment/platform/risk breakdowns and
 * drill-down hand-off. Selected from the Trend Explorer keyword table.
 *
 * v0.17 matrix mode: 3–6 pins render a rank-tinted metric matrix — every
 * headline metric becomes a column, every narrative a row, cells tinted by
 * relative rank (green leads → red trails), plus a multi-line velocity
 * overlay and a composite "leads" verdict. Rows drill into the sheet and
 * can be unpinned in place.
 */
import { useMemo } from "react";
import type { Filters, Topic } from "@/lib/mock/types";
import { getTopicSeries } from "@/lib/mock";
import { fmtCompact, fmtNet, sentimentTone } from "@/lib/fmt";
import { cn } from "@/lib/utils";
import { Badge, ScoreBar, Taxonomy, Legend } from "../common/primitives";
import { CHART, ChartTooltip, GRID, useChartTheme } from "../common/ChartBits";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { GitCompareArrows, TrendingUp, ArrowUpRight, Award, X, LayoutGrid } from "lucide-react";

const VELOCITY_TONE: Record<Topic["velocity"], "green" | "orange" | "slate" | "red"> = {
  surging: "orange",
  rising: "green",
  steady: "slate",
  declining: "red",
};

const VELOCITY_RANK: Record<Topic["velocity"], number> = {
  surging: 4,
  rising: 3,
  steady: 2,
  declining: 1,
};

/** centred "lead" cell: which narrative wins the metric */
function Lead({ a, b, invert = false, suffix }: { a: number; b: number; invert?: boolean; suffix?: string }) {
  const hi = invert ? Math.min(a, b) : Math.max(a, b);
  const winner: "a" | "b" | null = a === b ? null : hi === a ? "a" : "b";
  return (
    <span className="font-mono text-[10px] tnum text-muted-foreground whitespace-nowrap">
      {winner ? (
        <>
          <span className={winner === "a" ? "text-signal-orange" : "text-signal-cyan"}>
            {winner.toUpperCase()} leads
          </span>
          {suffix && <span className="ml-1 text-muted-foreground/60">{suffix}</span>}
        </>
      ) : (
        "level"
      )}
    </span>
  );
}

function SentimentMixBar({ t }: { t: Topic }) {
  const total = t.sentiment.positive + t.sentiment.neutral + t.sentiment.negative || 1;
  return (
    <div className="flex h-1.5 w-20 rounded-sm overflow-hidden bg-muted" title={`+${Math.round((t.sentiment.positive / total) * 100)}% · ${Math.round((t.sentiment.neutral / total) * 100)}% · −${Math.round((t.sentiment.negative / total) * 100)}%`}>
      <div className="bg-signal-green" style={{ width: `${(t.sentiment.positive / total) * 100}%` }} />
      <div className="bg-signal-slate/60" style={{ width: `${(t.sentiment.neutral / total) * 100}%` }} />
      <div className="bg-signal-red" style={{ width: `${(t.sentiment.negative / total) * 100}%` }} />
    </div>
  );
}

function NetSentiment({ t }: { t: Topic }) {
  const net = t.sentiment.positive - t.sentiment.negative;
  const tone = sentimentTone(net);
  return (
    <span
      className={cn(
        "font-mono text-xs tnum",
        tone === "green" ? "text-signal-green" : tone === "red" ? "text-signal-red" : "text-signal-amber"
      )}
    >
      {fmtNet(net)}
    </span>
  );
}

/* ---------------- v0.17 matrix mode (3–6 pins) ---------------- */

/** Headline metric columns — the same six the A/B verdict uses. */
interface MetricRow {
  topic: Topic;
  volume: number;
  change: number;
  net: number;
  xShare: number;
  velocity: number; // rank number
  risk: number;
}

type MetricKey = "volume" | "change" | "net" | "xShare" | "velocity" | "risk";

/** merged velocity-overlay row (one line per narrative: s0, s1, …). */
interface VelocityRow {
  t: number;
  label: string;
  [seriesKey: string]: number | string | null;
}

const MATRIX_COLORS = [CHART.orange, CHART.cyan, CHART.green, CHART.amber, CHART.violet, CHART.red];

/** Cell tint by rank position: 1st green, last red (N > 2), middle neutral. */
const rankTint = (rank: number, n: number) => {
  if (rank === 1) return "bg-signal-green/10 text-signal-green";
  if (rank === n && n > 2) return "bg-signal-red/10 text-signal-red";
  return "text-foreground";
};

/** Dense matrix cell — value + rank chip (matrix layout, 3+ narratives). */
function MatrixCell({
  rank,
  n,
  children,
  mono = true,
}: {
  rank: number;
  n: number;
  children: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <td className="px-3 py-2 text-right">
      <span
        className={cn(
          "inline-flex items-center justify-end gap-1.5 h-6 px-1.5 rounded-sm tabular-nums",
          mono && "font-mono text-[11px]",
          rankTint(rank, n)
        )}
      >
        {children}
        <span
          className={cn(
            "text-[8px] text-muted-foreground/70",
            rank === 1 && "text-signal-green/80",
            rank === n && n > 2 && "text-signal-red/80"
          )}
          title={`rank ${rank} of ${n}`}
        >
          {rank === 1 ? "▲" : rank === n && n > 2 ? "▼" : "·"}
        </span>
      </span>
    </td>
  );
}

function MatrixView({
  topics,
  filters,
  onDrill,
  onUnpin,
}: {
  topics: Topic[];
  filters: Filters;
  onDrill: (id: string) => void;
  onUnpin: (id: string) => void;
}) {
  const chartTheme = useChartTheme();

  const rows: MetricRow[] = useMemo(
    () =>
      topics.map((topic) => ({
        topic,
        volume: getTopicSeries(topic, filters).reduce((a, p) => a + p.total, 0),
        change: topic.change24h,
        net: topic.sentiment.positive - topic.sentiment.negative,
        xShare: topic.xShare,
        velocity: VELOCITY_RANK[topic.velocity],
        risk: topic.risk,
      })),
    [topics, filters]
  );

  /** rank per metric (1 = best; risk inverted — lower is better) */
  const ranks = useMemo(() => {
    const col = (key: MetricKey, invert = false) => {
      const sorted = [...rows].sort((a, b) => (invert ? a[key] - b[key] : b[key] - a[key]));
      return new Map(sorted.map((r, i) => [r.topic.id, i + 1]));
    };
    return {
      volume: col("volume"),
      change: col("change"),
      net: col("net"),
      xShare: col("xShare"),
      velocity: col("velocity"),
      risk: col("risk", true),
    };
  }, [rows]);

  const leads = useMemo(
    () =>
      rows.map((r) => {
        let wins = 0;
        for (const m of [ranks.volume, ranks.change, ranks.net, ranks.xShare, ranks.velocity, ranks.risk]) {
          if (m.get(r.topic.id) === 1) wins += 1;
        }
        return { id: r.topic.id, wins };
      }),
    [rows, ranks]
  );
  const winsOf = (id: string) => leads.find((l) => l.id === id)?.wins ?? 0;

  const maxWins = Math.max(...leads.map((l) => l.wins), 0);
  const leaders = leads.filter((l) => l.wins === maxWins && maxWins > 0);
  const sortedRows = useMemo(
    () =>
      [...rows].sort(
        (a, b) =>
          (leads.find((l) => l.id === b.topic.id)?.wins ?? 0) -
          (leads.find((l) => l.id === a.topic.id)?.wins ?? 0)
      ),
    [rows, leads]
  );

  const riskiest = useMemo(
    () => (rows.length ? [...rows].sort((a, b) => b.risk - a.risk)[0] : null),
    [rows]
  );
  const minRisk = useMemo(() => (rows.length ? Math.min(...rows.map((r) => r.risk)) : 0), [rows]);

  /* overlaid velocity — one line per narrative, shared bucket grid */
  const velocityData = useMemo<VelocityRow[]>(() => {
    if (!topics.length) return [];
    const series = topics.map((t) => getTopicSeries(t, filters));
    const n = Math.min(...series.map((s) => s.length));
    return series[0].slice(0, n).map((p, i) => {
      const row: VelocityRow = { t: p.t, label: p.label };
      topics.forEach((_, k) => {
        row[`s${k}`] = series[k][i]?.total ?? null;
      });
      return row;
    });
  }, [topics, filters]);

  const n = rows.length;
  const leaderLabel = leaders.length === 1 ? leaders[0].id : null;
  const leaderTopic = leaderLabel ? topics.find((t) => t.id === leaderLabel) : null;

  return (
    <div className="max-h-[70vh] overflow-y-auto p-4 space-y-4">
      {/* composite verdict */}
      <div className="flex items-start gap-3 border border-primary/25 bg-primary/5 rounded-md px-3.5 py-2.5">
        <Award className="size-4 text-primary shrink-0 mt-0.5" strokeWidth={1.75} />
        <p className="text-xs leading-relaxed text-foreground/90 min-w-0">
          <span className="taxonomy text-primary mr-1.5">Verdict</span>
          {leaderTopic ? (
            <>
              <span className="font-medium text-foreground">{leaderTopic.label}</span> leads{" "}
              <span className="font-semibold">
                {maxWins} of 6 headline metrics
              </span>{" "}
              across {n} narratives
            </>
          ) : (
            <>
              split field — no single narrative leads more than {maxWins || 0} of 6 metrics across {n} narratives
            </>
          )}
          {riskiest && riskiest.risk - minRisk >= 0.12 && (
            <>
              {" · "}
              <span className="text-signal-amber">
                caution: {riskiest.topic.label} carries materially higher risk
              </span>
            </>
          )}
          <span className="text-muted-foreground/70"> — auto-derived from the rank cells below</span>
        </p>
      </div>

      {/* multi-line velocity overlay */}
      <div className="border border-border rounded-md p-3">
        <div className="flex items-center gap-2 mb-1">
          <Taxonomy>Velocity overlay · {n} narratives</Taxonomy>
          <div className="ml-auto flex flex-wrap gap-x-3 gap-y-1">
            {topics.map((t, i) => (
              <span key={t.id} className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                <span className="size-1.5 rounded-[1px] shrink-0" style={{ background: MATRIX_COLORS[i % MATRIX_COLORS.length] }} />
                <span className="truncate max-w-40">{t.label}</span>
              </span>
            ))}
          </div>
        </div>
        <div className="h-52 -mx-1">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={velocityData} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={chartTheme.grid} strokeDasharray={GRID.strokeDasharray} vertical={GRID.vertical} />
              <XAxis
                dataKey="t"
                type="number"
                domain={["dataMin", "dataMax"]}
                tickFormatter={(t: number) => velocityData.find((p) => p.t === t)?.label ?? ""}
                minTickGap={40}
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
                    label={(props as { payload?: { label?: string } }).payload?.label ?? ""}
                  />
                )}
              />
              {topics.map((t, i) => (
                <Line
                  key={t.id}
                  type="monotone"
                  dataKey={`s${i}`}
                  name={t.label}
                  stroke={MATRIX_COLORS[i % MATRIX_COLORS.length]}
                  strokeWidth={1.5}
                  dot={false}
                />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* rank-tinted metric matrix */}
      <div className="border border-border rounded-md overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-border bg-popover/60">
              <th className="taxonomy text-muted-foreground/70 font-semibold px-4 py-2">Narrative</th>
              <th className="taxonomy text-muted-foreground/70 font-semibold px-3 py-2 text-right">Volume</th>
              <th className="taxonomy text-muted-foreground/70 font-semibold px-3 py-2 text-right">24h Δ</th>
              <th className="taxonomy text-muted-foreground/70 font-semibold px-3 py-2 text-right">Net sent.</th>
              <th className="taxonomy text-muted-foreground/70 font-semibold px-3 py-2 text-right">X share</th>
              <th className="taxonomy text-muted-foreground/70 font-semibold px-3 py-2 text-right">Velocity</th>
              <th className="taxonomy text-muted-foreground/70 font-semibold px-3 py-2 text-right">Risk ↓</th>
              <th className="taxonomy text-primary/80 font-semibold px-3 py-2 text-right">Leads</th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((r) => (
              <tr
                key={r.topic.id}
                className="border-b border-border/50 last:border-0 hover:bg-accent/40 transition-colors group cursor-pointer"
                onClick={() => onDrill(r.topic.id)}
                title={`Drill into ${r.topic.label} — opens the narrative sheet`}
              >
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2 min-w-0 max-w-56">
                    <span
                      className="size-2 rounded-[2px] shrink-0"
                      style={{ background: MATRIX_COLORS[topics.findIndex((t) => t.id === r.topic.id) % MATRIX_COLORS.length] }}
                    />
                    <span className="text-xs text-foreground/90 truncate">{r.topic.label}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onUnpin(r.topic.id);
                      }}
                      className="ml-auto size-4 inline-flex items-center justify-center rounded-sm text-muted-foreground/40 hover:text-signal-red cursor-pointer opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                      aria-label={`Unpin ${r.topic.label} from the compare matrix`}
                      title="Unpin this narrative"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                </td>
                <MatrixCell rank={ranks.volume.get(r.topic.id) ?? n} n={n}>
                  {fmtCompact(r.volume)}
                </MatrixCell>
                <MatrixCell rank={ranks.change.get(r.topic.id) ?? n} n={n}>
                  <span className={r.change >= 0 ? "" : ""}>
                    {r.change >= 0 ? "+" : ""}
                    {r.change.toFixed(1)}%
                  </span>
                </MatrixCell>
                <MatrixCell rank={ranks.net.get(r.topic.id) ?? n} n={n}>
                  {fmtNet(r.net)}
                </MatrixCell>
                <MatrixCell rank={ranks.xShare.get(r.topic.id) ?? n} n={n}>
                  {Math.round(r.xShare * 100)}%
                </MatrixCell>
                <td className="px-3 py-2 text-right">
                  <Badge tone={VELOCITY_TONE[r.topic.velocity]}>{r.topic.velocity}</Badge>
                </td>
                <td className="px-3 py-2">
                  <div className="flex justify-end">
                    <ScoreBar value={r.risk} showValue className="w-24" />
                  </div>
                </td>
                <td className="px-3 py-2 text-right">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 font-mono text-xs tnum",
                      winsOf(r.topic.id) === maxWins && maxWins > 0
                        ? "text-signal-green"
                        : winsOf(r.topic.id) === 0
                          ? "text-muted-foreground/60"
                          : "text-foreground"
                    )}
                  >
                    {winsOf(r.topic.id)}
                    <span className="text-[9px] text-muted-foreground/60">/6</span>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="px-4 py-2 border-t border-border/60 text-[10px] font-mono text-muted-foreground/70 flex items-center gap-2 flex-wrap">
          <LayoutGrid className="size-3 shrink-0" />
          cells tinted by rank — green leads, red trails · risk ranked low-to-high (lower = safer) ·
          click a row to drill · hover to unpin
        </p>
      </div>

      {/* emerging flags strip */}
      <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground px-1">
        <TrendingUp className="size-3" />
        {rows.filter((r) => r.topic.emerging).length > 0 ? (
          rows
            .filter((r) => r.topic.emerging)
            .map((r) => (
              <Badge key={r.topic.id} tone="orange">
                {r.topic.label} emerging
              </Badge>
            ))
        ) : (
          <span>no narrative in the field is flagged emerging this window</span>
        )}
        <span className="ml-auto">aggregate · anonymised cohorts</span>
      </div>

      <div className="flex justify-end gap-2">
        {leaderTopic && (
          <Button variant="outline" size="sm" onClick={() => onDrill(leaderTopic.id)}>
            Drill down leader <ArrowUpRight className="size-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

/* ---------------- 2-pin A/B view (v0.14/v0.15, unchanged) ---------------- */

function AbView({
  topics,
  filters,
  onDrill,
}: {
  topics: [Topic, Topic];
  filters: Filters;
  onDrill: (id: string) => void;
}) {
  const chartTheme = useChartTheme();

  const seriesPair = useMemo(() => {
    const [a, b] = topics;
    const sa = getTopicSeries(a, filters);
    const sb = getTopicSeries(b, filters);
    const n = Math.min(sa.length, sb.length);
    const data = sa.slice(0, n).map((p, i) => ({
      t: p.t,
      label: p.label,
      a: sa[i]?.total ?? null,
      b: sb[i]?.total ?? null,
    }));
    const volA = sa.reduce((x, p) => x + p.total, 0);
    const volB = sb.reduce((x, p) => x + p.total, 0);
    return { data, volA, volB };
  }, [topics, filters]);

  /* ---- verdict (v0.15): auto-computed winner sentence from the lead cells ---- */
  const verdict = useMemo(() => {
    if (!seriesPair) return null;
    const [a, b] = topics;
    const netA = a.sentiment.positive - a.sentiment.negative;
    const netB = b.sentiment.positive - b.sentiment.negative;
    const metrics: { a: number; b: number; invert?: boolean }[] = [
      { a: seriesPair.volA, b: seriesPair.volB },
      { a: a.change24h, b: b.change24h },
      { a: netA, b: netB },
      { a: a.xShare, b: b.xShare },
      { a: VELOCITY_RANK[a.velocity], b: VELOCITY_RANK[b.velocity] },
      { a: a.risk, b: b.risk, invert: true },
    ];
    const wins = metrics.map((m) => {
      if (m.a === m.b) return null;
      const hi = m.invert ? Math.min(m.a, m.b) : Math.max(m.a, m.b);
      return hi === m.a ? "a" : "b";
    });
    const winsA = wins.filter((w) => w === "a").length;
    const winsB = wins.filter((w) => w === "b").length;
    return {
      winsA,
      winsB,
      riskGap: Math.abs(a.risk - b.risk),
      riskier: a.risk > b.risk ? a : b,
      winnerLabel: winsA === winsB ? null : winsA > winsB ? a.label : b.label,
      winnerIsA: winsA > winsB,
    };
  }, [topics, seriesPair]);

  const [a, b] = topics;

  return (
    <div className="max-h-[70vh] overflow-y-auto p-4 space-y-4">
      {/* auto-computed verdict banner (v0.15) */}
      {verdict && (
        <div className="flex items-start gap-3 border border-primary/25 bg-primary/5 rounded-md px-3.5 py-2.5">
          <Award className="size-4 text-primary shrink-0 mt-0.5" strokeWidth={1.75} />
          <p className="text-xs leading-relaxed text-foreground/90 min-w-0">
            <span className="taxonomy text-primary mr-1.5">Verdict</span>
            {verdict.winsA === verdict.winsB ? (
              <>
                split decision — <span className="text-signal-orange font-medium">A</span> and{" "}
                <span className="text-signal-cyan font-medium">B</span> each take {verdict.winsA} of 6
                headline metrics
              </>
            ) : (
              <>
                <span
                  className={cn(
                    "font-medium",
                    verdict.winnerIsA ? "text-signal-orange" : "text-signal-cyan"
                  )}
                >
                  {verdict.winnerLabel}
                </span>{" "}
                leads{" "}
                <span className="font-semibold text-foreground">
                  {verdict.winsA === 6 || verdict.winsB === 6
                    ? "all 6 headline metrics"
                    : `${Math.max(verdict.winsA, verdict.winsB)} of 6 headline metrics (${Math.min(verdict.winsA, verdict.winsB)} to the other)`}
                </span>
              </>
            )}
            {verdict.riskGap >= 0.12 && (
              <>
                {" · "}
                <span className="text-signal-amber">caution: {verdict.riskier.label} carries materially higher risk</span>
              </>
            )}
            <span className="text-muted-foreground/70"> — auto-derived from the lead cells below</span>
          </p>
        </div>
      )}

      {/* identity strip */}
      <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-center bg-popover border border-border rounded-md p-3">
        <div className="min-w-0">
          <div className="text-sm font-medium text-foreground truncate flex items-center gap-2">
            <span className="size-2 rounded-[2px] bg-signal-orange shrink-0" />
            A · {a.label}
          </div>
          <div className="text-[10px] text-muted-foreground truncate mt-0.5">{a.gloss}</div>
        </div>
        <span className="font-mono text-[10px] text-muted-foreground/60 uppercase tracking-wider shrink-0">
          vs
        </span>
        <div className="min-w-0 text-right">
          <div className="text-sm font-medium text-foreground truncate flex items-center gap-2 justify-end">
            {b.label} · B
            <span className="size-2 rounded-[2px] bg-signal-cyan shrink-0" />
          </div>
          <div className="text-[10px] text-muted-foreground truncate mt-0.5">{b.gloss}</div>
        </div>
      </div>

      {/* overlaid velocity chart */}
      <div className="border border-border rounded-md p-3">
        <div className="flex items-center gap-2 mb-1">
          <Taxonomy>Velocity overlay</Taxonomy>
          <div className="ml-auto">
            <Legend items={[{ label: `A · ${a.label}`, color: CHART.orange }, { label: `B · ${b.label}`, color: CHART.cyan }]} />
          </div>
        </div>
        <div className="h-52 -mx-1">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={seriesPair.data} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={chartTheme.grid} strokeDasharray={GRID.strokeDasharray} vertical={GRID.vertical} />
              <XAxis
                dataKey="t"
                type="number"
                domain={["dataMin", "dataMax"]}
                tickFormatter={(t: number) => seriesPair.data.find((p) => p.t === t)?.label ?? ""}
                minTickGap={40}
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
                    label={(props as { payload?: { label?: string } }).payload?.label ?? ""}
                  />
                )}
              />
              <Line type="monotone" dataKey="a" name={`A · ${a.label}`} stroke={CHART.orange} strokeWidth={1.75} dot={false} />
              <Line type="monotone" dataKey="b" name={`B · ${b.label}`} stroke={CHART.cyan} strokeWidth={1.75} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* metric comparison table */}
      <div className="border border-border rounded-md overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-border bg-popover/60">
              <th className="taxonomy text-muted-foreground/70 font-semibold px-4 py-2">Metric</th>
              <th className="taxonomy text-signal-orange/80 font-semibold px-4 py-2 text-right">A</th>
              <th className="taxonomy text-muted-foreground/50 font-semibold px-3 py-2 text-center">Lead</th>
              <th className="taxonomy text-signal-cyan/80 font-semibold px-4 py-2 text-right">B</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border/50">
              <td className="px-4 py-2.5 text-xs text-muted-foreground">Window volume</td>
              <td className="px-4 py-2.5 text-right font-mono text-xs tnum text-foreground">{fmtCompact(seriesPair.volA)}</td>
              <td className="px-3 py-2.5 text-center"><Lead a={seriesPair.volA} b={seriesPair.volB} /></td>
              <td className="px-4 py-2.5 text-right font-mono text-xs tnum text-foreground">{fmtCompact(seriesPair.volB)}</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="px-4 py-2.5 text-xs text-muted-foreground">24h change</td>
              <td className="px-4 py-2.5 text-right font-mono text-xs tnum">
                <span className={a.change24h >= 0 ? "text-signal-green" : "text-signal-red"}>
                  {a.change24h >= 0 ? "+" : ""}{a.change24h.toFixed(1)}%
                </span>
              </td>
              <td className="px-3 py-2.5 text-center"><Lead a={a.change24h} b={b.change24h} /></td>
              <td className="px-4 py-2.5 text-right font-mono text-xs tnum">
                <span className={b.change24h >= 0 ? "text-signal-green" : "text-signal-red"}>
                  {b.change24h >= 0 ? "+" : ""}{b.change24h.toFixed(1)}%
                </span>
              </td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="px-4 py-2.5 text-xs text-muted-foreground">Net sentiment</td>
              <td className="px-4 py-2.5 text-right"><NetSentiment t={a} /></td>
              <td className="px-3 py-2.5 text-center">
                <Lead a={a.sentiment.positive - a.sentiment.negative} b={b.sentiment.positive - b.sentiment.negative} />
              </td>
              <td className="px-4 py-2.5 text-right"><NetSentiment t={b} /></td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="px-4 py-2.5 text-xs text-muted-foreground">Sentiment mix</td>
              <td className="px-4 py-2.5 flex justify-end"><SentimentMixBar t={a} /></td>
              <td className="px-3 py-2.5 text-center text-[10px] font-mono text-muted-foreground/70">pos · neu · neg</td>
              <td className="px-4 py-2.5 flex justify-end"><SentimentMixBar t={b} /></td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="px-4 py-2.5 text-xs text-muted-foreground">X share</td>
              <td className="px-4 py-2.5 text-right font-mono text-xs tnum text-foreground">{Math.round(a.xShare * 100)}%</td>
              <td className="px-3 py-2.5 text-center"><Lead a={a.xShare} b={b.xShare} suffix="X-leaning" /></td>
              <td className="px-4 py-2.5 text-right font-mono text-xs tnum text-foreground">{Math.round(b.xShare * 100)}%</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="px-4 py-2.5 text-xs text-muted-foreground">Velocity</td>
              <td className="px-4 py-2.5 flex justify-end"><Badge tone={VELOCITY_TONE[a.velocity]}>{a.velocity}</Badge></td>
              <td className="px-3 py-2.5 text-center"><Lead a={VELOCITY_RANK[a.velocity]} b={VELOCITY_RANK[b.velocity]} /></td>
              <td className="px-4 py-2.5 flex justify-end"><Badge tone={VELOCITY_TONE[b.velocity]}>{b.velocity}</Badge></td>
            </tr>
            <tr>
              <td className="px-4 py-2.5 text-xs text-muted-foreground">Risk score</td>
              <td className="px-4 py-2.5 flex justify-end"><ScoreBar value={a.risk} showValue className="w-24" /></td>
              <td className="px-3 py-2.5 text-center"><Lead a={a.risk} b={b.risk} invert suffix="lower = safer" /></td>
              <td className="px-4 py-2.5 flex justify-end"><ScoreBar value={b.risk} showValue className="w-24" /></td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* emerging flags */}
      <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground px-1">
        <TrendingUp className="size-3" />
        {a.emerging && <Badge tone="orange">A emerging</Badge>}
        {b.emerging && <Badge tone="cyan">B emerging</Badge>}
        {!a.emerging && !b.emerging && <span>neither narrative is flagged emerging this window</span>}
        <span className="ml-auto">aggregate · anonymised cohorts</span>
      </div>
    </div>
  );
}

export function CompareDialog({
  open,
  onOpenChange,
  topics,
  filters,
  onDrill,
  onUnpin,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** Pinned narratives — 2 renders the A/B dossier, 3–6 the rank matrix. */
  topics: Topic[] | null;
  filters: Filters;
  onDrill: (id: string) => void;
  onUnpin?: (id: string) => void;
}) {
  const matrix = !!topics && topics.length >= 3;
  const pair = !matrix && topics && topics.length === 2 ? ([topics[0], topics[1]] as [Topic, Topic]) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border shrink-0">
          <DialogTitle className="font-display text-lg tracking-tight flex items-center gap-2">
            <GitCompareArrows className="size-4 text-primary" />
            {matrix ? `Narrative matrix · ${topics?.length} pinned` : "Narrative A/B"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {matrix
              ? "Rank-tinted headline metrics across every pinned narrative — green leads, red trails; rows drill into the sheet."
              : "Side-by-side telemetry — velocity, sentiment, platform split, risk and bot correlation."}
          </DialogDescription>
        </DialogHeader>

        {pair ? (
          <AbView topics={pair} filters={filters} onDrill={onDrill} />
        ) : matrix && topics ? (
          <MatrixView
            topics={topics}
            filters={filters}
            onDrill={onDrill}
            onUnpin={onUnpin ?? (() => {})}
          />
        ) : (
          <div className="p-8 text-center text-xs text-muted-foreground">
            Pin two narratives for an A/B dossier, or three to six for the rank matrix.
          </div>
        )}

        <div className="px-5 py-4 border-t border-border shrink-0 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {pair && (
            <>
              <Button variant="outline" onClick={() => onDrill(pair[0].id)}>
                Drill down A <ArrowUpRight className="size-3.5" />
              </Button>
              <Button onClick={() => onDrill(pair[1].id)}>
                Drill down B <ArrowUpRight className="size-3.5" />
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
