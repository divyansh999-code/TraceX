"use client";

/**
 * 30-day corpus intensity calendar — GitHub-style density strip in the
 * console telemetry language. Cell opacity = daily volume vs the window max;
 * spike days carry a red ring.
 *
 * Two click behaviours (v0.15):
 *  - `renderDayDossier` provided → clicking a day opens the day-dossier
 *    popover anchored to that cell (spike inspector);
 *  - otherwise → `onSelect` (pivot the console to the 30-day trend window).
 *
 * Keyboard: ←/→ walk days, Home/End jump to window edges, Enter/Space select
 * (Enter opens the dossier when the inspector is armed). Roving tabindex —
 * exactly one cell sits in the page tab order. Cells also carry a native
 * title tooltip so compact sheet strips stay readable.
 */
import { useMemo, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { fmtFull, fmtDayIST } from "@/lib/fmt";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";

export interface HeatDay {
  t: number;
  total: number;
  spike: boolean;
  label: string;
}

export function HeatCalendar({
  days,
  onSelect,
  compact = false,
  activeT,
  renderDayDossier,
}: {
  days: HeatDay[];
  onSelect?: (day: HeatDay) => void;
  /** Sheet-friendly mode: smaller cells, no legend — fits a 420px drill-down. */
  compact?: boolean;
  /** Temporal replay (v0.13): days after this epoch are still-to-come —
   *  rendered dimmed so the strip tracks the time-machine playhead. */
  activeT?: number;
  /** Spike inspector (v0.15): when provided, clicking a day opens this
   *  dossier popover anchored to the clicked cell instead of onSelect. */
  renderDayDossier?: (day: HeatDay) => ReactNode;
}) {
  const [hover, setHover] = useState<number | null>(null);
  /* inspector state — index + anchor ELEMENT of the day whose dossier popover
     is open. The element comes from the click event into STATE (never read
     from a ref during render — lint-clean); the ref-like wrapper handed to
     Radix is built inline only when an element exists, matching its
     non-null virtualRef contract. */
  const [inspectIdx, setInspectIdx] = useState<number | null>(null);
  const [inspectEl, setInspectEl] = useState<HTMLElement | null>(null);
  /* roving tabindex cursor — starts on the most recent day; the visible
     cursor ring only appears once the strip is keyboard-touched, so an
     untouched calendar doesn't look like it has a rendering artifact */
  const [cursor, setCursor] = useState(days.length - 1);
  const [touched, setTouched] = useState(false);
  const cellRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const max = useMemo(() => Math.max(1, ...days.map((d) => d.total)), [days]);
  const avg = useMemo(() => (days.length ? days.reduce((a, d) => a + d.total, 0) / days.length : 0), [days]);
  const spikes = days.filter((d) => d.spike).length;

  const intensity = (total: number) => {
    const p = Math.max(6, Math.round((total / max) * 92));
    return `color-mix(in srgb, var(--signal-cyan) ${p}%, transparent)`;
  };

  const hoverDay = hover != null ? days[hover] : null;
  const inspectDay = inspectIdx != null ? days[inspectIdx] : null;
  /* clicks on other heat cells re-target the popover instead of dismissing */
  const keepPopoverOnCell = (e: { preventDefault: () => void; target: EventTarget | null }) => {
    const el = e.target as HTMLElement | null;
    if (el?.closest("[data-heat-cell]")) e.preventDefault();
  };

  const onCellKey = (e: React.KeyboardEvent, i: number) => {
    let next: number | null = null;
    if (e.key === "ArrowRight" && i < days.length - 1) next = i + 1;
    else if (e.key === "ArrowLeft" && i > 0) next = i - 1;
    else if (e.key === "Home" && i !== 0) next = 0;
    else if (e.key === "End" && i !== days.length - 1) next = days.length - 1;
    if (next == null) return;
    e.preventDefault();
    setTouched(true);
    setCursor(next);
    setHover(next);
    cellRefs.current[next]?.focus();
  };

  const onCellClick = (d: HeatDay, i: number, el: HTMLElement | null) => {
    if (renderDayDossier) {
      setInspectIdx(i);
      setInspectEl(el);
      setHover(i);
    } else {
      onSelect?.(d);
    }
  };

  return (
    <div className="space-y-2.5">
      {/* one popover for the whole strip — virtually anchored to the clicked cell */}
      <Popover
        open={inspectDay != null && !!renderDayDossier}
        onOpenChange={(o) => {
          if (!o) setInspectIdx(null);
        }}
      >
        <PopoverAnchor virtualRef={inspectEl ? { current: inspectEl } : undefined} />
        <PopoverContent
          align="center"
          sideOffset={8}
          collisionPadding={12}
          className="w-auto max-w-96 p-0 rounded-md"
          onInteractOutside={keepPopoverOnCell}
          onFocusOutside={keepPopoverOnCell}
        >
          {inspectDay && renderDayDossier?.(inspectDay)}
        </PopoverContent>
      </Popover>
      <div className="flex items-center gap-2">
        <div className={cn("flex min-w-0", compact ? "gap-[3px] flex-wrap" : "flex-wrap gap-[3px]")}>
          {days.map((d, i) => (
            <button
              key={d.t}
              ref={(el) => {
                cellRefs.current[i] = el;
              }}
              type="button"
              data-heat-cell=""
              onClick={(e) => onCellClick(d, i, e.currentTarget)}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              onKeyDown={(e) => onCellKey(e, i)}
              tabIndex={i === cursor ? 0 : -1}
              aria-label={`${d.label} — ${fmtFull(d.total)} posts${d.spike ? ", anomalous spike" : ""}`}
              title={`${fmtDayIST(d.t)} · ${fmtFull(d.total)} posts${d.spike ? " · SPIKE" : ""}${renderDayDossier ? " — click for day dossier" : ""}`}
              className={cn(
                "relative rounded-[3px] cursor-pointer transition-transform",
                compact ? "size-2.5" : "size-3.5",
                activeT != null && d.t > activeT && "opacity-25 saturate-50",
                "hover:scale-125 focus-visible:outline-1 focus-visible:outline-ring",
                d.spike && "ring-1 ring-signal-red/80",
                touched && i === cursor && (compact
                  ? "outline-1 outline-signal-cyan/70"
                  : "scale-110 outline-1 outline-offset-1 outline-signal-cyan/60")
              )}
              style={{ backgroundColor: intensity(d.total) }}
            >
              {d.spike && (
                <span className={cn(
                  "absolute rounded-[2px] bg-signal-red",
                  compact ? "-top-0.5 -right-0.5 size-1" : "-top-0.5 -right-0.5 size-1.5"
                )} />
              )}
              {hover === i && (
                <span
                  className={cn(
                    "absolute rounded-[2px] bg-foreground",
                    compact ? "-top-0.5 -right-0.5 size-1" : "-top-0.5 -right-0.5 size-1.5"
                  )}
                  aria-hidden="true"
                />
              )}
            </button>
          ))}
        </div>
        <div className={cn("ml-auto shrink-0", compact ? "hidden" : "hidden sm:flex items-center gap-1.5")}>
          <span className="font-mono text-[9px] text-muted-foreground/60 tnum">low</span>
          {[12, 35, 60, 85].map((p) => (
            <span
              key={p}
              className={cn("rounded-[3px]", compact ? "size-2.5" : "size-3")}
              style={{ backgroundColor: `color-mix(in srgb, var(--signal-cyan) ${p}%, transparent)` }}
            />
          ))}
          <span className="font-mono text-[9px] text-muted-foreground/60 tnum">high</span>
          <span className="ml-2 inline-flex items-center gap-1">
            <span className={cn("rounded-[3px] ring-1 ring-signal-red/80 bg-signal-cyan/30", compact ? "size-2.5" : "size-3")} />
            <span className="font-mono text-[9px] text-muted-foreground/60">spike</span>
          </span>
        </div>
      </div>
      <div className="flex items-center gap-3 font-mono text-[9px] tnum text-muted-foreground/70">
        <span className="shrink-0">{days[0]?.label ?? "−30d"}</span>
        {hoverDay ? (
          <span className="text-foreground normal-case min-w-0 truncate">
            <span className="text-muted-foreground">{fmtDayIST(hoverDay.t)} ·</span>{" "}
            {fmtFull(hoverDay.total)} posts
            {hoverDay.spike && <span className="text-signal-red"> · SPIKE</span>}
          </span>
        ) : (
          <span className="min-w-0 truncate">
            avg {fmtFull(avg)}/day · {spikes === 1 ? "1 anomaly" : `${spikes} anomalies`} flagged vs baseline
          </span>
        )}
        <span className={cn("ml-auto shrink-0", compact ? "hidden" : "hidden sm:inline")} aria-hidden="true">
          {renderDayDossier ? "←/→ walk · click = dossier" : "←/→ walk days"}
        </span>
        <span className="shrink-0">{days[days.length - 1]?.label ?? "today"}</span>
      </div>
    </div>
  );
}
