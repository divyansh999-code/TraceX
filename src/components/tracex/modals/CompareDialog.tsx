"use client";

/**
 * Narrative A/B compare (v0.14) — side-by-side dossier for two narratives:
 * overlaid velocity chart, metric-vs-metric table with lead indicators,
 * sentiment/platform/risk breakdowns and drill-down hand-off. Selected
 * from the Trend Explorer keyword table (two compare pins).
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
  DialogFooter,
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
import { GitCompareArrows, TrendingUp, ArrowUpRight, Award } from "lucide-react";

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

export function CompareDialog({
  open,
  onOpenChange,
  topics,
  filters,
  onDrill,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  topics: [Topic, Topic] | null;
  filters: Filters;
  onDrill: (id: string) => void;
}) {
  const chartTheme = useChartTheme();

  const seriesPair = useMemo(() => {
    if (!topics) return null;
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
    if (!topics || !seriesPair) return null;
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
    const riskGap = Math.abs(a.risk - b.risk);
    return {
      winsA,
      winsB,
      riskGap,
      riskier: a.risk > b.risk ? a : b,
      winnerLabel: winsA === winsB ? null : winsA > winsB ? a.label : b.label,
      winnerIsA: winsA > winsB,
    };
  }, [topics, seriesPair]);

  const [a, b] = topics ?? [null, null];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border shrink-0">
          <DialogTitle className="font-display text-lg tracking-tight flex items-center gap-2">
            <GitCompareArrows className="size-4 text-primary" />
            Narrative A/B
          </DialogTitle>
          <DialogDescription className="text-xs">
            Side-by-side telemetry — velocity, sentiment, platform split, risk and bot correlation.
          </DialogDescription>
        </DialogHeader>

        {!a || !b || !seriesPair ? (
          <div className="p-8 text-center text-xs text-muted-foreground">
            Select two narratives in the keyword table to compare them.
          </div>
        ) : (
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
        )}

        <DialogFooter className="px-5 py-4 border-t border-border shrink-0">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {a && (
            <Button variant="outline" onClick={() => onDrill(a.id)}>
              Drill down A <ArrowUpRight className="size-3.5" />
            </Button>
          )}
          {b && (
            <Button onClick={() => onDrill(b.id)}>
              Drill down B <ArrowUpRight className="size-3.5" />
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
