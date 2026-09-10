"use client";

/**
 * TraceX primitive vocabulary — panels, badges, score bars, chips.
 * Follows the Signal Intelligence Console spec: hairline borders,
 * flat tonal stacking, 6px container radius, 4px badge radius.
 */
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import type { ReactNode } from "react";

/* ---------------- Panel ---------------- */

export function Panel({
  title,
  sub,
  icon: Icon,
  right,
  children,
  className,
  bodyClassName,
  dense,
  scroll,
}: {
  title?: ReactNode;
  sub?: ReactNode;
  icon?: LucideIcon;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  dense?: boolean;
  scroll?: boolean;
}) {
  return (
    <section
      className={cn(
        "bg-card border border-border rounded-lg flex flex-col min-w-0",
        "transition-colors duration-150",
        className
      )}
    >
      {(title || right) && (
        <header className="flex items-center gap-2.5 px-4 h-10 border-b border-border shrink-0">
          {Icon && <Icon className="size-3.5 text-muted-foreground shrink-0" strokeWidth={1.75} />}
          <div className="flex items-baseline gap-2 min-w-0">
            <h2 className="taxonomy text-muted-foreground truncate">{title}</h2>
            {sub && (
              <span className="text-[10px] font-mono text-muted-foreground/70 truncate hidden sm:inline">
                {sub}
              </span>
            )}
          </div>
          {right && <div className="ml-auto flex items-center gap-2 shrink-0">{right}</div>}
        </header>
      )}
      <div
        className={cn(
          dense ? "p-2" : "p-4",
          scroll && "max-h-96 overflow-y-auto",
          "min-w-0 flex-1",
          bodyClassName
        )}
      >
        {children}
      </div>
    </section>
  );
}

/* ---------------- Taxonomy label ---------------- */

export function Taxonomy({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("taxonomy text-muted-foreground", className)}>{children}</span>;
}

/* ---------------- Mono tag (IDs, hashes, telemetry) ---------------- */

export function MonoTag({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "font-mono text-[10px] text-muted-foreground bg-muted border border-border rounded-sm px-1.5 py-0.5",
        "whitespace-nowrap inline-flex items-center",
        className
      )}
    >
      {children}
    </span>
  );
}

/* ---------------- Status badges ---------------- */

export type Tone = "green" | "amber" | "red" | "cyan" | "orange" | "violet" | "slate" | "neutral";

const TONE_CLASS: Record<Tone, string> = {
  green: "text-signal-green border-signal-green/30 bg-signal-green/10",
  amber: "text-signal-amber border-signal-amber/30 bg-signal-amber/10",
  red: "text-signal-red border-signal-red/30 bg-signal-red/10",
  cyan: "text-signal-cyan border-signal-cyan/30 bg-signal-cyan/10",
  orange: "text-signal-orange border-signal-orange/30 bg-signal-orange/10",
  violet: "text-signal-violet border-signal-violet/30 bg-signal-violet/10",
  slate: "text-signal-slate border-signal-slate/30 bg-signal-slate/10",
  neutral: "text-muted-foreground border-border bg-muted",
};

export function Badge({
  tone = "neutral",
  children,
  className,
  dot,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm border px-1.5 py-0.5",
        "text-[10px] font-semibold uppercase tracking-[0.05em] whitespace-nowrap",
        TONE_CLASS[tone],
        className
      )}
    >
      {dot && <span className="size-1.5 rounded-[2px] bg-current opacity-80" />}
      {children}
    </span>
  );
}

export function SeverityDot({ severity }: { severity: "critical" | "high" | "medium" | "low" }) {
  const color =
    severity === "critical"
      ? "bg-signal-red"
      : severity === "high"
        ? "bg-signal-orange"
        : severity === "medium"
          ? "bg-signal-amber"
          : "bg-signal-slate";
  return (
    <span className="relative flex size-2 shrink-0">
      <span className={cn("absolute inset-0 rounded-[2px]", color)} />
      {severity === "critical" && (
        <span className={cn("absolute inset-0 rounded-[2px] animate-ping", color, "opacity-60")} />
      )}
    </span>
  );
}

/* ---------------- Delta indicator ---------------- */

export function Delta({
  value,
  invert = false,
  suffix = "%",
  className,
  digits = 0,
}: {
  value: number;
  invert?: boolean;
  suffix?: string;
  className?: string;
  digits?: number;
}) {
  const up = value > 0.05;
  const down = value < -0.05;
  const good = invert ? down : up;
  const Icon = up ? TrendingUp : down ? TrendingDown : Minus;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-mono text-[11px] tnum whitespace-nowrap",
        !up && !down ? "text-muted-foreground" : good ? "text-signal-green" : "text-signal-red",
        className
      )}
    >
      <Icon className="size-3" strokeWidth={2} />
      {up ? "+" : down ? "−" : ""}
      {Math.abs(value).toFixed(digits)}
      {suffix}
    </span>
  );
}

/* ---------------- Score bar (0–1 risk/bot/influence) ---------------- */

export function ScoreBar({
  value,
  className,
  height = "h-1.5",
  showValue = false,
  label,
}: {
  value: number; // 0..1
  className?: string;
  height?: string;
  showValue?: boolean;
  label?: string;
}) {
  const v = Math.min(1, Math.max(0, value));
  const color = v >= 0.75 ? "bg-signal-red" : v >= 0.45 ? "bg-signal-amber" : "bg-signal-green";
  return (
    <div className={cn("flex items-center gap-2 min-w-0", className)}>
      <div className={cn("flex-1 min-w-10 overflow-hidden rounded-sm bg-muted", height)}>
        <div
          className={cn("h-full rounded-sm transition-all duration-500", color)}
          style={{ width: `${Math.max(3, v * 100)}%` }}
        />
      </div>
      {showValue && (
        <span className="font-mono text-[11px] tnum text-muted-foreground shrink-0">
          {v.toFixed(2)}
        </span>
      )}
      {label && <span className="sr-only">{label}</span>}
    </div>
  );
}

/* ---------------- Legend ---------------- */

export function Legend({
  items,
  className,
}: {
  items: { label: string; color: string; dashed?: boolean }[];
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-1.5", className)}>
      {items.map((it) => (
        <span key={it.label} className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
          {it.dashed ? (
            <span
              className="inline-block h-0 w-3.5 border-t border-dashed"
              style={{ borderColor: it.color }}
            />
          ) : (
            <span className="size-2 rounded-[2px]" style={{ background: it.color }} />
          )}
          {it.label}
        </span>
      ))}
    </div>
  );
}

/* ---------------- Live dot ---------------- */

export function LiveDot({ label = "LIVE", className }: { label?: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span className="relative flex size-1.5">
        <span className="absolute inset-0 rounded-full bg-signal-green" />
        <span className="absolute inset-0 rounded-full bg-signal-green pulse-dot" />
      </span>
      <span className="taxonomy text-signal-green">{label}</span>
    </span>
  );
}

/* ---------------- Filter chip ---------------- */

export function Chip({
  active,
  children,
  onClick,
  className,
  title,
}: {
  active?: boolean;
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        "rounded-sm border px-2 py-1 text-[11px] font-medium whitespace-nowrap",
        "transition-colors duration-100 cursor-pointer select-none",
        active
          ? "bg-primary/15 border-primary/40 text-primary"
          : "bg-muted/40 border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground/40",
        className
      )}
    >
      {children}
    </button>
  );
}

/* ---------------- Metric row (label / value / sub) ---------------- */

export function MetricRow({
  label,
  value,
  sub,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-baseline justify-between gap-3 py-1.5 border-b border-border/60 last:border-0", className)}>
      <span className="text-xs text-muted-foreground truncate">{label}</span>
      <span className="font-mono text-xs tnum text-foreground shrink-0">{value}</span>
      {sub && <span className="text-[10px] font-mono text-muted-foreground/70 shrink-0">{sub}</span>}
    </div>
  );
}
