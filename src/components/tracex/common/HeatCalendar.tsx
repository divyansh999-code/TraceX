"use client";

/**
 * 30-day corpus intensity calendar — GitHub-style density strip in the
 * console telemetry language. Cell opacity = daily volume vs the window max;
 * spike days carry a red ring. Clicking a day pivots the console to the
 * 30-day trend window.
 */
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { fmtFull, fmtDateIST } from "@/lib/fmt";

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
}: {
  days: HeatDay[];
  onSelect?: (day: HeatDay) => void;
  /** Sheet-friendly mode: smaller cells, no legend — fits a 420px drill-down. */
  compact?: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = useMemo(() => Math.max(1, ...days.map((d) => d.total)), [days]);
  const avg = useMemo(() => (days.length ? days.reduce((a, d) => a + d.total, 0) / days.length : 0), [days]);
  const spikes = days.filter((d) => d.spike).length;

  const intensity = (total: number) => {
    const p = Math.max(6, Math.round((total / max) * 92));
    return `color-mix(in srgb, var(--signal-cyan) ${p}%, transparent)`;
  };

  const hoverDay = hover != null ? days[hover] : null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className={cn("flex min-w-0", compact ? "gap-[3px] flex-wrap" : "flex-wrap gap-[3px]")}>
          {days.map((d, i) => (
            <button
              key={d.t}
              type="button"
              onClick={() => onSelect?.(d)}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              aria-label={`${d.label} — ${fmtFull(d.total)} posts${d.spike ? ", anomalous spike" : ""}`}
              className={cn(
                "relative rounded-[3px] cursor-pointer transition-transform",
                compact ? "size-2.5" : "size-3.5",
                "hover:scale-125 focus-visible:outline-1 focus-visible:outline-ring",
                d.spike && "ring-1 ring-signal-red/80"
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
            <span className="text-muted-foreground">{fmtDateIST(hoverDay.t)} ·</span>{" "}
            {fmtFull(hoverDay.total)} posts
            {hoverDay.spike && <span className="text-signal-red"> · SPIKE</span>}
          </span>
        ) : (
          <span className="min-w-0 truncate">
            avg {fmtFull(avg)}/day · {spikes} anomaly{spikes === 1 ? "" : "es"} flagged vs baseline
          </span>
        )}
        <span className="ml-auto shrink-0">{days[days.length - 1]?.label ?? "today"}</span>
      </div>
    </div>
  );
}
