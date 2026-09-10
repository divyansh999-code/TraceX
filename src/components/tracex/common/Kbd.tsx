"use client";

/**
 * Keyboard affordance primitives — key caps + shortcut rows + hint strip.
 * Used by the hotkey help dialog and the status bar hint.
 */
import { cn } from "@/lib/utils";
import { Fragment } from "react";

export interface Hotkey {
  keys: string[];
  label: string;
  /** Optional full gesture text, e.g. "⌘/Ctrl + K" for copy fallback. */
  held?: string;
}

/** A single key cap. */
export function KbdKey({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        "inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-sm",
        "font-mono text-[10px] font-semibold text-foreground",
        "bg-muted border border-border border-b-2 shadow-[inset_0_-1px_0_var(--border)]",
        "select-none pointer-events-none",
        className
      )}
    >
      {children}
    </kbd>
  );
}

/** A shortcut row: key caps + description. */
export function Kbd({ hotkey }: { hotkey: Hotkey }) {
  return (
    <div className="flex items-center gap-2.5 py-0.5">
      <span className="flex items-center gap-1 shrink-0 min-w-16">
        {hotkey.keys.map((k, i) => (
          <Fragment key={i}>
            {i > 0 && <span className="text-[10px] text-muted-foreground/60">+</span>}
            <KbdKey>{k}</KbdKey>
          </Fragment>
        ))}
      </span>
      <span className="text-xs text-muted-foreground min-w-0">{hotkey.label}</span>
    </div>
  );
}

/** Compact hint chips row for the status bar. */
export function HintStrip({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5 font-mono text-[10px] text-muted-foreground/70", className)}>
      <span className="inline-flex items-center gap-1">
        <KbdKey className="min-w-4 h-4 px-1 text-[9px]">⌘K</KbdKey>
        palette
      </span>
      <span className="inline-flex items-center gap-1">
        <KbdKey className="min-w-4 h-4 px-1 text-[9px]">1–8</KbdKey>
        modules
      </span>
      <span className="hidden md:inline-flex items-center gap-1">
        <KbdKey className="min-w-4 h-4 px-1 text-[9px]">?</KbdKey>
        shortcuts
      </span>
    </span>
  );
}
