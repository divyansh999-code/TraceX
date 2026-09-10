"use client";

/** Standard screen masthead — serif display title + module kicker. */
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function ScreenHeader({
  kicker,
  title,
  description,
  right,
  className,
}: {
  kicker: string;
  title: string;
  description?: string;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-3", className)}>
      <div className="min-w-0">
        <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-primary">{kicker}</div>
        <h1 className="font-display text-[22px] md:text-2xl font-semibold tracking-tight text-foreground mt-1">
          {title}
        </h1>
        {description && (
          <p className="text-xs text-muted-foreground mt-1 max-w-2xl leading-relaxed">{description}</p>
        )}
      </div>
      {right && <div className="flex items-center gap-2 shrink-0">{right}</div>}
    </div>
  );
}
