"use client";

/**
 * Day dossier (v0.15 spike inspector) — the popover body rendered by the
 * Overview heat strip when a day is clicked. Decomposes one calendar day:
 * volume vs baseline, platform split, sentiment mix, the narratives that
 * dominated it and the claims in play — with a hand-off into the Trend
 * Explorer for the full 30-day window.
 *
 * v0.16: every narrative row carries a ±3-day volume sparkline (risk-toned,
 * hairline marker on this day); a one-tap "A/B top 2" action pins the two
 * dominant narratives into the global compare; the footer copies a shareable
 * `#/overview/day:TS` deep-link. The same body renders inside the anchored
 * popover AND the shell-level DayDossierDialog (replay / palette / link).
 *
 * v0.17: narrative rows drill into the Trend Explorer sheet on click, and a
 * "bot suspects" section surfaces the day's highest-scoring automation with
 * a hand-off into Bot Detection.
 */
import { useMemo } from "react";
import type { Filters } from "@/lib/mock/types";
import { getDayDossier } from "@/lib/mock";
import { fmtCompact, fmtDayIST, fmtFull, fmtSigned, riskTone } from "@/lib/fmt";
import { useApp } from "@/lib/app-state";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Badge, Taxonomy, ScoreBar } from "./primitives";
import { Sparkline } from "./Sparkline";
import type { HeatDay } from "./HeatCalendar";
import { AtSign, Send, Flame, ShieldAlert, ArrowUpRight, CalendarDays, GitCompareArrows, Link2, Bot } from "lucide-react";

const STATUS_TONE: Record<string, "red" | "amber" | "cyan" | "slate"> = {
  False: "red",
  Disputed: "amber",
  Unverified: "slate",
  Verified: "cyan",
};

/* risk tone → sparkline stroke (mirrors the v0.15 share-bar colours) */
const RISK_SPARK_COLOR = (risk: number) =>
  risk >= 0.65 ? "#D9564F" : risk >= 0.4 ? "#D9A441" : "#5FA1C4";

/** Clipboard with a textarea fallback for non-secure preview contexts. */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    /* fall through to the legacy path */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

export function DayDossier({
  day,
  filters,
  onOpenTrends,
}: {
  day: HeatDay;
  filters: Filters;
  onOpenTrends: (day: HeatDay) => void;
}) {
  const { setComparePair, go, setCompareOpen, setSelectedTopicId } = useApp();
  const dossier = useMemo(() => getDayDossier(day.t, filters), [day.t, filters]);

  if (!dossier) {
    return (
      <div className="p-4 text-xs text-muted-foreground">
        No corpus telemetry retained for {day.label}.
      </div>
    );
  }

  const vsBase = dossier.vsBaseline;
  const tone = vsBase > 40 ? "text-signal-red" : vsBase > 8 ? "text-signal-amber" : vsBase < -8 ? "text-signal-cyan" : "text-muted-foreground";
  const [topA, topB] = dossier.narratives;

  const compareTop2 = () => {
    if (!topA || !topB) return;
    setComparePair(topA.id, topB.id);
    go("trends");
    setCompareOpen(true);
    toast(`A/B armed: ${topA.label} vs ${topB.label}`, {
      description: "The day's two dominant narratives, pinned into the compare console.",
    });
  };

  const openNarrative = (id: string, label: string) => {
    setSelectedTopicId(id);
    go("trends", { topicId: id });
    toast(`Drill-down: ${label}`, {
      description: `30-day narrative velocity opening in the Trend Explorer for ${fmtDayIST(dossier?.t ?? Date.now())}.`,
    });
  };

  const copyDayLink = async () => {
    const url = `${window.location.origin}${window.location.pathname}#/overview/day:${dossier.t}`;
    const ok = await copyText(url);
    if (ok) {
      toast.success("Day dossier link copied", {
        description: `${fmtDayIST(dossier.t)} — restores the console with this dossier open.`,
      });
    } else {
      toast.error("Clipboard unavailable", { description: "Browser denied clipboard access." });
    }
  };

  return (
    <div className="w-80 max-w-[calc(100vw-2rem)]">
      {/* header */}
      <div className="flex items-center gap-2 px-3.5 h-10 border-b border-border bg-muted/30">
        <CalendarDays className="size-3.5 text-primary shrink-0" strokeWidth={1.75} />
        <span className="taxonomy text-foreground truncate">Day dossier · {fmtDayIST(dossier.t)}</span>
        {day.spike && <Badge tone="red" dot className="ml-auto shrink-0">spike</Badge>}
      </div>

      <div className="px-3.5 py-3 space-y-3 max-h-[min(56vh,360px)] overflow-y-auto">
        {/* volume telemetry */}
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-lg tnum text-foreground leading-none">{fmtFull(dossier.total)}</span>
          <span className="text-[10px] text-muted-foreground">posts</span>
          <span className={cn("ml-auto font-mono text-[11px] tnum", tone)}>
            {fmtSigned(vsBase, 0)}% vs baseline
          </span>
        </div>

        {/* platform + sentiment mix */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Taxonomy className="w-16 shrink-0">Platform</Taxonomy>
            <div className="flex h-1.5 flex-1 rounded-sm overflow-hidden bg-muted" aria-hidden="true">
              <div className="bg-signal-orange" style={{ width: `${dossier.xShare * 100}%` }} />
              <div className="bg-signal-cyan" style={{ width: `${(1 - dossier.xShare) * 100}%` }} />
            </div>
            <span className="font-mono text-[10px] tnum text-muted-foreground shrink-0 w-20 text-right">
              {Math.round(dossier.xShare * 100)}/{Math.round((1 - dossier.xShare) * 100)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Taxonomy className="w-16 shrink-0">Sentiment</Taxonomy>
            <div className="flex h-1.5 flex-1 rounded-sm overflow-hidden bg-muted" aria-hidden="true">
              <div className="bg-signal-green" style={{ width: `${dossier.sentiment.positive * 100}%` }} />
              <div className="bg-signal-slate/60" style={{ width: `${dossier.sentiment.neutral * 100}%` }} />
              <div className="bg-signal-red" style={{ width: `${dossier.sentiment.negative * 100}%` }} />
            </div>
            <span className="font-mono text-[10px] tnum text-muted-foreground shrink-0 w-20 text-right">
              {Math.round(dossier.sentiment.positive * 100)}·{Math.round(dossier.sentiment.neutral * 100)}·{Math.round(dossier.sentiment.negative * 100)}
            </span>
          </div>
          <div className="flex items-center gap-3 font-mono text-[9px] text-muted-foreground/70 pl-[calc(4rem+0.5rem)]">
            <span className="inline-flex items-center gap-1"><AtSign className="size-2.5" />X / Telegram</span>
            <span>+ positive · − negative shares</span>
          </div>
        </div>

        {/* dominant narratives — v0.16: ±3-day volume context sparkline
            (risk-toned stroke, dashed hairline marks THIS day) replaces
            the static share bar; share% stays in the mono readout */}
        <div className="border-t border-border/70 pt-2.5">
          <div className="flex items-center gap-2">
            <Taxonomy>Narratives that day</Taxonomy>
            {topA && topB && (
              <button
                type="button"
                onClick={compareTop2}
                title={`Pin ${topA.label} vs ${topB.label} into the A/B compare console`}
                className="ml-auto inline-flex items-center gap-1 h-5 px-1.5 rounded-sm border border-border text-[9px] font-mono text-muted-foreground hover:text-primary hover:border-primary/50 transition-colors cursor-pointer"
              >
                <GitCompareArrows className="size-2.5" />
                A/B top 2
              </button>
            )}
          </div>
          <ul className="mt-1.5 space-y-1.5">
            {dossier.narratives.map((n) => (
              <li key={n.id} className="flex items-center gap-2">
                <Flame className={cn("size-3 shrink-0", n.spike ? "text-signal-red" : "text-muted-foreground/50")} strokeWidth={1.75} />
                <button
                  type="button"
                  onClick={() => openNarrative(n.id, n.label)}
                  title={`Drill into ${n.label} — 30-day velocity in the Trend Explorer`}
                  className="text-xs text-foreground/90 hover:text-primary text-left truncate min-w-0 flex-1 decoration-primary/40 underline-offset-2 hover:underline cursor-pointer transition-colors"
                >
                  {n.label}
                </button>
                <Sparkline
                  data={n.context}
                  markIdx={n.contextIdx}
                  color={RISK_SPARK_COLOR(n.risk)}
                  width={56}
                  height={16}
                  strokeWidth={1.25}
                  className="shrink-0 pointer-events-none"
                />
                <span
                  className="font-mono text-[10px] tnum text-muted-foreground shrink-0 w-16 text-right"
                  title="day volume · share of corpus · sparkline = ±3-day context, marker = this day"
                >
                  {fmtCompact(n.dayVolume)} · {Math.round(n.share * 100)}%
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-[9px] font-mono text-muted-foreground/60">
            click a narrative to drill · sparkline = ±3-day context
          </p>
        </div>

        {/* claims in play */}
        <div className="border-t border-border/70 pt-2.5">
          <Taxonomy>Claims in play</Taxonomy>
          {dossier.claims.length === 0 ? (
            <p className="mt-1.5 text-[11px] text-muted-foreground/70 leading-snug">
              No tracked claims first-seen or active in that day&apos;s top narratives.
            </p>
          ) : (
            <ul className="mt-1.5 space-y-1.5">
              {dossier.claims.map((c) => (
                <li key={c.id} className="flex items-start gap-2">
                  <ShieldAlert
                    className={cn(
                      "size-3 mt-0.5 shrink-0",
                      riskTone(c.risk) === "red" ? "text-signal-red" : riskTone(c.risk) === "amber" ? "text-signal-amber" : "text-signal-green"
                    )}
                    strokeWidth={1.75}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] leading-snug text-foreground/90 line-clamp-2" title={c.text}>{c.text}</p>
                    <p className="font-mono text-[9px] text-muted-foreground/70 mt-0.5 truncate">
                      {c.id} · {c.why}
                    </p>
                  </div>
                  <Badge tone={STATUS_TONE[c.status] ?? "slate"} className="shrink-0 !px-1 !py-0 !text-[9px]">
                    {c.status}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* bot suspects (v0.17) — the day's highest-scoring automation */}
        <div className="border-t border-border/70 pt-2.5">
          <div className="flex items-center gap-2">
            <Taxonomy>Bot suspects</Taxonomy>
            <button
              type="button"
              onClick={() => go("bots")}
              title="Open Bot Detection — full flagged-accounts table"
              className="ml-auto inline-flex items-center gap-1 h-5 px-1.5 rounded-sm border border-border text-[9px] font-mono text-muted-foreground hover:text-primary hover:border-primary/50 transition-colors cursor-pointer"
            >
              <Bot className="size-2.5" />
              inspect
            </button>
          </div>
          <ul className="mt-1.5 space-y-1.5">
            {dossier.bots.map((b) => (
              <li key={b.id} className="flex items-center gap-2">
                {b.platform === "x" ? (
                  <AtSign className="size-3 shrink-0 text-signal-orange/80" strokeWidth={1.75} />
                ) : (
                  <Send className="size-3 shrink-0 text-signal-cyan/80" strokeWidth={1.75} />
                )}
                <span className="font-mono text-[11px] text-foreground truncate min-w-0 flex-1" title={`${b.handle} · ${b.clusterLabel ?? "unclustered"}`}>
                  {b.handle}
                </span>
                <ScoreBar value={b.botProb} className="w-14 shrink-0" />
                <span
                  className="font-mono text-[10px] tnum text-muted-foreground shrink-0 w-14 text-right"
                  title={`bot score ${b.botProb.toFixed(2)} · ${b.posts} posts that day${b.clusterLabel ? ` · ${b.clusterLabel}` : ""}`}
                >
                  {b.botProb.toFixed(2)} · {b.posts}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* footer hand-off + shareable deep-link (v0.16) */}
      <div className="flex items-stretch border-t border-border">
        <button
          type="button"
          onClick={() => onOpenTrends(day)}
          className="flex-1 flex items-center gap-2 px-3.5 h-9 text-[11px] text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors cursor-pointer group min-w-0"
        >
          <Send className="size-3 shrink-0" strokeWidth={1.75} />
          <span className="truncate">Open 30-day window in Trend Explorer</span>
          <ArrowUpRight className="size-3 ml-auto shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </button>
        <button
          type="button"
          onClick={copyDayLink}
          aria-label="Copy shareable day dossier link"
          title="Copy a deep-link that reopens this dossier"
          className="w-9 shrink-0 flex items-center justify-center border-l border-border text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors cursor-pointer"
        >
          <Link2 className="size-3" strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
}
