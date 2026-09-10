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
}: {
  days: HeatDay[];
  onSelect?: (day: HeatDay) => void;
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
        <div className="flex flex-wrap gap-[3px] min-w-0">
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
                "relative size-3.5 rounded-[3px] cursor-pointer transition-transform",
                "hover:scale-125 focus-visible:outline-1 focus-visible:outline-ring",
                d.spike && "ring-1 ring-signal-red/80"
              )}
              style={{ backgroundColor: intensity(d.total) }}
            >
              {d.spike && (
                <span className="absolute -top-0.5 -right-0.5 size-1.5 rounded-[2px] bg-signal-red" />
              )}
              {hover === i && (
                <span
                  className="absolute -top-0.5 -right-0.5 size-1.5 rounded-[2px] bg-foreground"
                  aria-hidden="true"
                />
              )}
            </button>
          ))}
        </div>
        <div className="ml-auto hidden sm:flex items-center gap-1.5 shrink-0">
          <span className="font-mono text-[9px] text-muted-foreground/60 tnum">low</span>
          {[12, 35, 60, 85].map((p) => (
            <span
              key={p}
              className="size-3 rounded-[3px]"
              style={{ backgroundColor: `color-mix(in srgb, var(--signal-cyan) ${p}%, transparent)` }}
            />
          ))}
          <span className="font-mono text-[9px] text-muted-foreground/60 tnum">high</span>
          <span className="ml-2 inline-flex items-center gap-1">
            <span className="size-3 rounded-[3px] ring-1 ring-signal-red/80 bg-signal-cyan/30" />
            <span className="font-mono text-[9px] text-muted-foreground/60">spike</span>
          </span>
        </div>
      </div>
      <div className="flex items-center gap-3 font-mono text-[9px] tnum text-muted-foreground/70">
        <span>{days[0]?.label ?? "−30d"}</span>
        {hoverDay ? (
          <span className="text-foreground normal-case">
            <span className="text-muted-foreground">{fmtDateIST(hoverDay.t)} ·</span>{" "}
            {fmtFull(hoverDay.total)} posts
            {hoverDay.spike && <span className="text-signal-red"> · SPIKE</span>}
          </span>
        ) : (
          <span>
            avg {fmtFull(avg)}/day · {spikes} anomaly{spikes === 1 ? "" : "es"} flagged vs baseline
          </span>
        )}
        <span className="ml-auto">{days[days.length - 1]?.label ?? "today"}</span>
      </div>
    </div>
  );
}
