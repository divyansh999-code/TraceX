"use client";

/**
 * INFORMATION INTEGRITY — MODULE 06.
 * The merged Bot Detection + Misinformation Radar console: one module,
 * two operating views behind a segmented switcher.
 *  · bots view  — behavioural scoring, flagged watchlist, cluster forensics
 *  · claims view — claim extraction, fact-check cross-reference, spread maps
 * The active view is global state (integrityView) so deep-links, the ⌘K
 * palette and alert hand-offs can land on the right half directly:
 * `#/integrity/view:bots` · `#/integrity/view:claims/claim:CLM-004`.
 */
import { useMemo } from "react";
import { useApp } from "@/lib/app-state";
import { getBots, getClaims } from "@/lib/mock";
import { fmtFull, riskTone } from "@/lib/fmt";
import { cn } from "@/lib/utils";
import { Badge } from "../../common/primitives";
import { ScreenHeader } from "../../common/ScreenHeader";
import { BotsView } from "./BotsView";
import { ClaimsView } from "./ClaimsView";
import type { IntegrityView } from "@/lib/mock/types";
import { Bot, Radar } from "lucide-react";

const WINDOW_LABEL: Record<string, string> = {
  "24h": "last 24 hours",
  "7d": "last 7 days",
  "30d": "last 30 days",
  custom: "custom window",
};

export function IntegrityScreen() {
  const { filters, integrityView, setIntegrityView } = useApp();

  /* switcher chips + shared header badges — one cheap pass over the
     same mock getters the views consume (deterministic, filter-scoped) */
  const botStats = useMemo(() => getBots(filters).stats, [filters]);
  const claimStats = useMemo(() => {
    const claims = getClaims(filters);
    const total = claims.length;
    const avgRisk = total ? claims.reduce((a, c) => a + c.risk, 0) / total : 0;
    return { total, avgRisk };
  }, [filters]);

  const platformLabel =
    filters.platform === "all" ? "X + Telegram" : filters.platform === "x" ? "X only" : "Telegram only";
  const windowLabel = WINDOW_LABEL[filters.range] ?? "window";

  const views: {
    id: IntegrityView;
    label: string;
    icon: typeof Bot;
    count: string;
    countTone: string;
    hint: string;
  }[] = [
    {
      id: "bots",
      label: "Bot Detection",
      icon: Bot,
      count: fmtFull(botStats.flaggedAccounts),
      countTone: "text-signal-red bg-signal-red/10 border-signal-red/30",
      hint: "5,000-account rotating sample · 4 behavioural signals",
    },
    {
      id: "claims",
      label: "Misinformation Radar",
      icon: Radar,
      count: String(claimStats.total),
      countTone: "text-signal-amber bg-signal-amber/10 border-signal-amber/30",
      hint: "fact-check cross-referenced · cross-platform spread",
    },
  ];
  const activeView = views.find((v) => v.id === integrityView) ?? views[0];

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <ScreenHeader
        kicker="MODULE 06 // INFORMATION INTEGRITY"
        title="Information Integrity"
        description={`Automation and deception in one operating view — behavioural bot scoring, coordinated cluster forensics and claim-level misinformation tracking across X and Telegram — ${windowLabel}.`}
        right={
          <div className="flex items-center gap-2">
            <Badge tone="cyan" dot>
              {platformLabel}
            </Badge>
            {integrityView === "claims" ? (
              <Badge tone={riskTone(claimStats.avgRisk)} dot>
                avg risk {claimStats.total ? claimStats.avgRisk.toFixed(2) : "—"}
              </Badge>
            ) : (
              <>
                <Badge tone="red" dot>
                  {fmtFull(botStats.flaggedAccounts)} flagged
                </Badge>
                <Badge tone="amber" dot>
                  {(botStats.botShare * 100).toFixed(1)}% bot share
                </Badge>
              </>
            )}
          </div>
        }
      />

      {/* View switcher — one module, two lenses. Counts are live so the
          switcher doubles as a triage summary of each half. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-1">
        <div
          role="tablist"
          aria-label="Integrity views"
          className="inline-flex items-center gap-0.5 rounded-lg border border-border bg-card p-0.5"
        >
          {views.map((v) => {
            const active = integrityView === v.id;
            return (
              <button
                key={v.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setIntegrityView(v.id)}
                title={`Switch to the ${v.label} view`}
                className={cn(
                  "h-8 px-3 rounded-md text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap",
                  "transition-colors duration-100 cursor-pointer",
                  active
                    ? "bg-secondary text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <v.icon className={cn("size-3.5", active ? "text-primary" : "text-muted-foreground")} />
                <span>{v.label}</span>
                <span
                  className={cn(
                    "font-mono text-[9px] tnum leading-4 rounded-sm border px-1",
                    v.countTone,
                    active ? "opacity-100" : "opacity-70"
                  )}
                >
                  {v.count}
                </span>
              </button>
            );
          })}
        </div>
        <span className="hidden sm:inline font-mono text-[10px] text-muted-foreground/70 truncate">
          {activeView.hint}
        </span>
      </div>

      {/* Active half — keyed so a switch replays the re-query flash */}
      <div key={integrityView} className="space-y-4 animate-in fade-in duration-200 min-w-0">
        {integrityView === "claims" ? <ClaimsView /> : <BotsView />}
      </div>
    </div>
  );
}
