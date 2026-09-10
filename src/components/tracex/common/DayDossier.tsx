"use client";

/**
 * Day dossier (v0.15 spike inspector) — the popover body rendered by the
 * Overview heat strip when a day is clicked. Decomposes one calendar day:
 * volume vs baseline, platform split, sentiment mix, the narratives that
 * dominated it and the claims in play — with a hand-off into the Trend
 * Explorer for the full 30-day window.
 */
import { useMemo } from "react";
import type { Filters } from "@/lib/mock/types";
import { getDayDossier } from "@/lib/mock";
import { fmtCompact, fmtDayIST, fmtFull, fmtSigned, riskTone } from "@/lib/fmt";
import { cn } from "@/lib/utils";
import { Badge, Taxonomy } from "./primitives";
import type { HeatDay } from "./HeatCalendar";
import { AtSign, Send, Flame, ShieldAlert, ArrowUpRight, CalendarDays } from "lucide-react";

const STATUS_TONE: Record<string, "red" | "amber" | "cyan" | "slate"> = {
  False: "red",
  Disputed: "amber",
  Unverified: "slate",
  Verified: "cyan",
};

export function DayDossier({
  day,
  filters,
  onOpenTrends,
}: {
  day: HeatDay;
  filters: Filters;
  onOpenTrends: (day: HeatDay) => void;
}) {
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

        {/* dominant narratives */}
        <div className="border-t border-border/70 pt-2.5">
          <Taxonomy>Narratives that day</Taxonomy>
          <ul className="mt-1.5 space-y-1.5">
            {dossier.narratives.map((n) => (
              <li key={n.id} className="flex items-center gap-2">
                <Flame className={cn("size-3 shrink-0", n.spike ? "text-signal-red" : "text-muted-foreground/50")} strokeWidth={1.75} />
                <span className="text-xs text-foreground truncate min-w-0 flex-1" title={n.label}>{n.label}</span>
                <div className="h-1 w-14 rounded-sm bg-muted overflow-hidden shrink-0" aria-hidden="true">
                  <div
                    className={cn("h-full rounded-sm", n.risk >= 0.65 ? "bg-signal-red" : n.risk >= 0.4 ? "bg-signal-amber" : "bg-signal-cyan")}
                    style={{ width: `${Math.max(4, n.share * 100)}%` }}
                  />
                </div>
                <span className="font-mono text-[10px] tnum text-muted-foreground shrink-0 w-16 text-right" title="day volume · share of corpus">
                  {fmtCompact(n.dayVolume)} · {Math.round(n.share * 100)}%
                </span>
              </li>
            ))}
          </ul>
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
      </div>

      {/* footer hand-off */}
      <button
        type="button"
        onClick={() => onOpenTrends(day)}
        className="w-full flex items-center gap-2 px-3.5 h-9 border-t border-border text-[11px] text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors cursor-pointer group"
      >
        <Send className="size-3 shrink-0" strokeWidth={1.75} />
        <span>Open 30-day window in Trend Explorer</span>
        <ArrowUpRight className="size-3 ml-auto shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </button>
    </div>
  );
}
