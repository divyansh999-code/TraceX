"use client";

/**
 * Day dossier dialog (v0.16) — the globally-summoneable variant of the
 * heat-strip spike inspector. Where clicking a calendar cell opens the
 * anchored popover, this centered dialog renders the SAME DayDossier body
 * for the three "summoned" entry points:
 *  - the temporal replay (⏎ / the dossier button on the scrubber),
 *  - the ⌘K palette ("day dossier — latest spike"),
 *  - a shareable `#/overview/day:TS` deep-link (restored on load / Back).
 * Mounted once at the shell level, so it works from any screen; the hash
 * write in app-state mirrors the open day for sharing + history.
 */
import { useMemo } from "react";
import { useApp } from "@/lib/app-state";
import { getVolumeSeries } from "@/lib/mock";
import { fmtFull } from "@/lib/fmt";
import { toast } from "sonner";
import { DayDossier } from "../common/DayDossier";
import type { HeatDay } from "../common/HeatCalendar";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

export function DayDossierDialog() {
  const { dossierDay, setDossierDay, filters, setRange, go, screen } = useApp();

  /* resolve the calendar day for the summoned timestamp — always from the
     30d series (the dossier is a 30d artefact regardless of active range).
     The mock corpus anchors its buckets to Date.now() at module load, so a
     deep-link saved in an earlier session drifts by the elapsed time —
     exact-match would miss. Closest-bucket matching keeps the link stable
     (drift is seconds, bucket granularity a full day). */
  const day = useMemo<HeatDay | null>(() => {
    if (dossierDay == null) return null;
    const series = getVolumeSeries({ ...filters, range: "30d" });
    const p = series.reduce(
      (best, w) => (best == null || Math.abs(w.t - dossierDay) < Math.abs(best.t - dossierDay) ? w : best),
      undefined as (typeof series)[number] | undefined
    );
    return p ? { t: p.t, total: p.total, spike: p.spike, label: p.label } : null;
  }, [dossierDay, filters]);

  return (
    <Dialog open={dossierDay != null} onOpenChange={(o) => !o && setDossierDay(null)}>
      <DialogContent
        className="w-auto max-w-96 p-0 rounded-md gap-0 overflow-visible [&>button]:hidden"
        aria-describedby={undefined}
      >
        {/* DayDossier brings its own header + scroll body + footer; the
            default close affordance is hidden in favour of Esc / outside,
            matching the anchored popover exactly */}
        <DialogTitle className="sr-only">Day dossier</DialogTitle>
        <DialogDescription className="sr-only">
          Corpus decomposition for the selected calendar day.
        </DialogDescription>
        {day ? (
          <DayDossier
            day={day}
            filters={filters}
            onOpenTrends={(d) => {
              setDossierDay(null);
              setRange("30d");
              go("trends");
              toast(`Corpus view: ${d.label}`, {
                description: `${fmtFull(d.total)} posts on that day — 30-day window loaded in Trend Explorer.`,
              });
            }}
          />
        ) : (
          <div className="w-80 p-4 text-xs text-muted-foreground">
            No calendar day in the current 30-day window matches that link{screen !== "overview" ? " — the console was left on another module" : ""}.
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
