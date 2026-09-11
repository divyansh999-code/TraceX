"use client";

/** Recharts helpers: daylight-tuned axes + the console-styled tooltip. */
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

/** Thin axis for dense panels. */
export const thinAxis = (orientation: "left" | "right" = "left") => ({
  ...AXIS,
  orientation,
});
