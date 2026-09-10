"use client";

/** Recharts helpers: theme-aware axes + the console-styled tooltip. */
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

/** Static signal palette — legible on both dark & light surfaces. */
export const CHART = {
  orange: "#E8823A",
  green: "#3EAF7C",
  amber: "#D9A441",
  red: "#D9564F",
  cyan: "#5FA1C4",
  violet: "#A78BFA",
  slate: "#94A3B8",
} as const;

export function useChartTheme() {
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme !== "light";
  return {
    grid: dark ? "rgba(35, 40, 56, 0.8)" : "rgba(213, 215, 221, 0.9)",
    tick: dark ? "#8B92A5" : "#5A6070",
    zero: dark ? "#3A4054" : "#B8BAC2",
    crosshair: dark ? "#3E465D" : "#9EA1AA",
  };
}

export const AXIS = {
  tick: { fontSize: 10, fontFamily: "var(--font-jetbrains), monospace", fill: "#8B92A5" },
  axisLine: { stroke: "#232838" as string },
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
              style={{ background: (entry.color as string) ?? "#5FA1C4" }}
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
