"use client";

/** Recharts helpers: daylight-tuned axes + the console-styled tooltip. */
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/** Signal palette — keyed by role, tuned for white surfaces.
 *  (Key names are historical; hues follow the Twilight palette.) */
export const CHART = {
  orange: "#6B5FA4", // Scampi — primary series / volume / X platform
  green: "#5C9A7E", // sage — organic / positive / Telegram
  amber: "#B5823A", // honey — warnings / spike flags
  red: "#C4576B", // raspberry — bots / negative / high-risk
  cyan: "#8787CE", // Faraway Sky — baselines / secondary
  violet: "#9995E8", // Portage — tertiary accents
  slate: "#8B87A3", // purple-gray — neutral series
} as const;

/** Daylight console theme — grids, ticks and crosshairs on white. */
export function useChartTheme() {
  return {
    grid: "rgba(229, 225, 240, 0.9)",
    tick: "#6E6889",
    zero: "#D6D1E6",
    crosshair: "#B4AECB",
  };
}

export const AXIS = {
  tick: { fontSize: 10, fontFamily: "var(--font-spline), monospace", fill: "#6E6889" },
  axisLine: { stroke: "#E5E1F0" as string },
  tickLine: false as const,
};

interface TooltipEntry {
  name?: string | number;
  value?: number | string | (string | number)[];
  color?: string;
  dataKey?: string | number;
  payload?: Record<string, unknown>;
}

export function ChartTooltip({
  active,
  payload,
  label,
  unit,
  labelExtra,
  format,
  className,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string | number;
  unit?: string;
  labelExtra?: React.ReactNode;
  format?: (entry: TooltipEntry) => string;
  className?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div
      className={cn(
        "bg-popover border border-border rounded-md px-3 py-2 shadow-lg min-w-40",
        className
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-border pb-1.5 mb-1.5">
        <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
          {label}
        </span>
        {labelExtra}
      </div>
      <div className="space-y-1">
        {payload.map((entry, i) => (
          <div key={i} className="flex items-center gap-2 text-[11px]">
            <span
              className="size-2 rounded-[2px] shrink-0"
              style={{ background: (entry.color as string) ?? "#8787CE" }}
            />
            <span className="text-muted-foreground truncate max-w-32">{entry.name}</span>
            <span className="ml-auto font-mono tnum text-foreground whitespace-nowrap">
              {format ? format(entry) : typeof entry.value === "number" ? entry.value.toLocaleString("en-IN") : entry.value}
              {unit && <span className="text-muted-foreground ml-0.5">{unit}</span>}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Shared cartesian grid props. */
export const GRID = {
  strokeDasharray: "3 3",
  vertical: false,
} as const;

/* ------------------------------------------------------------------ */
/* Time axes — every chart gets real, readable timestamps             */
/* ------------------------------------------------------------------ */

/** Measures an element's content-box width (ResizeObserver; SSR-safe). */
export function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.getBoundingClientRect().width);
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) setWidth(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/** Bucket-aligned, width-aware time ticks for numeric `t` axes.
 *
 *  Why this exists: recharts' auto "nice" ticks on a numeric epoch axis
 *  land *between* data buckets, so a `series.find(p => p.t === tick)`
 *  formatter silently produced blank labels — charts rendered with no
 *  timestamps at all. This hook pins the ticks to actual bucket epochs
 *  (evenly indexed over the series) and scales the tick count to the
 *  measured chart width and the rendered label width, so axes stay dense
 *  on wide panels and never collide on narrow ones.
 *
 *  Usage: `const [ref, timeTicks] = useTimeTicks(series);` → attach `ref`
 *  to the chart's wrapper div, spread `ticks` + `tickFormatter` onto <XAxis>.
 */
export function useTimeTicks<T extends HTMLElement = HTMLDivElement>(
  series: readonly { t: number; label: string }[],
  opts?: { min?: number; max?: number; gapPx?: number; charPx?: number; fallback?: number }
) {
  const { min = 3, max = 6, gapPx = 20, charPx = 6, fallback = 5 } = opts ?? {};
  const [ref, width] = useElementWidth<T>();

  const axis = useMemo(() => {
    const n = series.length;
    if (n === 0) return { ticks: [] as number[], tickFormatter: (_t: number) => "" };
    // widest bucket label drives the per-tick footprint (mono, ~charPx per glyph)
    const labelPx = Math.max(4, ...series.map((p) => p.label.length)) * charPx + gapPx;
    const fit = width > 0 ? Math.floor(width / labelPx) : fallback;
    const count = Math.max(2, Math.min(max, fit, n));
    const ticks: number[] = [];
    for (let i = 0; i < count; i++) {
      const idx = Math.round((i * (n - 1)) / (count - 1));
      const t = series[idx].t;
      if (!ticks.includes(t)) ticks.push(t);
    }
    const byT = new Map(series.map((p) => [p.t, p.label]));
    return { ticks, tickFormatter: (t: number) => byT.get(t) ?? "" };
  }, [series, width, min, max, gapPx, charPx, fallback]);

  return [ref, axis] as const;
}

/** Epoch of the hovered bucket from a recharts tooltip render call.
 *  Recharts passes `payload` as an ARRAY of series entries (each carrying the
 *  data point under `.payload`), plus the axis value under `label` — older
 *  code read `payload.t` directly, which is always undefined on an array,
 *  silently blanking every tooltip header. */
export function tooltipEpoch(props: unknown): number | undefined {
  const p = props as { label?: string | number; payload?: { payload?: { t?: unknown } }[] };
  const fromEntry = p.payload?.[0]?.payload?.t;
  if (typeof fromEntry === "number") return fromEntry;
  if (typeof p.label === "number") return p.label;
  return undefined;
}

/** Full data point behind a recharts tooltip render call (first series
 *  entry) — for per-bucket flags like `spike` that live on the row itself. */
export function tooltipPoint<T = Record<string, unknown>>(props: unknown): T | undefined {
  const p = props as { payload?: { payload?: T }[] };
  return p.payload?.[0]?.payload;
}

/** Thin axis for dense panels. */
export const thinAxis = (orientation: "left" | "right" = "left") => ({
  ...AXIS,
  orientation,
});
