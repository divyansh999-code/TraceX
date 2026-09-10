"use client";

/** KPI telemetry card — label, mono readout, delta, sparkline, footnote. */
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Delta } from "./primitives";
import { Sparkline } from "./Sparkline";

export function KpiCard({
  label,
  value,
  unit,
  icon: Icon,
  delta,
  invertDelta,
  deltaSuffix,
  spark,
  sparkColor = "#5FA1C4",
  footnote,
  tone = "neutral",
  className,
}: {
  label: string;
  value: string;
  unit?: string;
  icon?: LucideIcon;
  delta?: number;
  invertDelta?: boolean;
  deltaSuffix?: string;
  spark?: number[];
  sparkColor?: string;
  footnote?: React.ReactNode;
  tone?: "neutral" | "green" | "red" | "amber" | "orange" | "cyan";
  className?: string;
}) {
  const toneBar =
    tone === "red"
      ? "bg-signal-red"
      : tone === "green"
        ? "bg-signal-green"
        : tone === "amber"
          ? "bg-signal-amber"
          : tone === "orange"
            ? "bg-primary"
            : tone === "cyan"
              ? "bg-signal-cyan"
              : "bg-signal-slate/60";
  const toneText =
    tone === "red"
      ? "text-signal-red"
      : tone === "green"
        ? "text-signal-green"
        : tone === "amber"
          ? "text-signal-amber"
          : tone === "orange"
            ? "text-primary"
            : tone === "cyan"
              ? "text-signal-cyan"
              : "text-foreground";

  return (
    <div
      className={cn(
        "relative bg-card border border-border rounded-lg p-4 min-w-0 overflow-hidden",
        "transition-all duration-150 hover:border-muted-foreground/40 hover:bg-accent/50",
        className
      )}
    >
      <span className={cn("absolute left-0 top-4 bottom-4 w-[3px] rounded-r-sm", toneBar)} />
      <div className="flex items-start justify-between gap-2">
        <span className="taxonomy text-muted-foreground pt-0.5">{label}</span>
        {Icon && <Icon className={cn("size-4 shrink-0", toneText)} strokeWidth={1.75} />}
      </div>
      <div className="mt-2.5 flex items-baseline gap-2 min-w-0">
        <span className={cn("font-mono text-[26px] leading-none tnum font-medium tracking-tight", toneText)}>
          {value}
        </span>
        {unit && <span className="font-mono text-xs text-muted-foreground">{unit}</span>}
        {delta !== undefined && (
          <Delta value={delta} invert={invertDelta} suffix={deltaSuffix ?? "%"} className="ml-auto" />
        )}
      </div>
      {spark && spark.length > 1 && (
        <div className="mt-3">
          <Sparkline data={spark} color={sparkColor} width={220} height={30} />
        </div>
      )}
      {footnote && (
        <div className="mt-2.5 text-[10px] font-mono text-muted-foreground/80 flex items-center gap-2 flex-wrap">
          {footnote}
        </div>
      )}
    </div>
  );
}
