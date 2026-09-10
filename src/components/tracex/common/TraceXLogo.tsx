"use client";

/** TraceX wordmark + brain-circuit logo mark. */
import { cn } from "@/lib/utils";

export function TraceXMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={cn("shrink-0", className)}
      aria-label="TraceX logo"
      role="img"
    >
      <rect width="64" height="64" rx="12" className="fill-background" />
      <rect x="0.5" y="0.5" width="63" height="63" rx="11.5" fill="none" className="stroke-border" />
      {/* left hemisphere — content / X */}
      <g stroke="#E8823A" strokeWidth="1.6" opacity="0.85">
        <line x1="18" y1="22" x2="24" y2="16" />
        <line x1="18" y1="22" x2="22" y2="32" />
        <line x1="22" y1="32" x2="16" y2="40" />
        <line x1="24" y1="16" x2="20" y2="10" />
      </g>
      <g fill="#E8823A">
        <circle cx="18" cy="22" r="3.4" />
        <circle cx="24" cy="16" r="2.6" />
        <circle cx="20" cy="10" r="2" />
        <circle cx="22" cy="32" r="3" />
        <circle cx="16" cy="40" r="2.4" />
      </g>
      {/* right hemisphere — network / data */}
      <g stroke="#3EAF7C" strokeWidth="1.6" opacity="0.85">
        <line x1="44" y1="24" x2="38" y2="17" />
        <line x1="44" y1="24" x2="46" y2="34" />
        <line x1="46" y1="34" x2="50" y2="42" />
        <line x1="38" y1="17" x2="34" y2="11" />
        <line x1="44" y1="24" x2="50" y2="18" />
      </g>
      <g fill="#3EAF7C">
        <circle cx="44" cy="24" r="3.4" />
        <circle cx="38" cy="17" r="2.6" />
        <circle cx="34" cy="11" r="2" />
        <circle cx="46" cy="34" r="3" />
        <circle cx="50" cy="42" r="2.4" />
        <circle cx="50" cy="18" r="2" />
      </g>
      {/* bridge */}
      <g stroke="#5FA1C4" strokeWidth="1.6" opacity="0.9">
        <line x1="22" y1="32" x2="46" y2="34" strokeDasharray="3 4" />
        <line x1="24" y1="16" x2="38" y2="17" />
      </g>
      <circle cx="33" cy="30" r="2.2" className="fill-foreground" />
    </svg>
  );
}

export function TraceXLogo({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5 min-w-0", className)}>
      <TraceXMark size={compact ? 26 : 30} />
      {!compact && (
        <div className="leading-none min-w-0">
          <div className="font-display font-semibold text-[17px] tracking-tight text-foreground">
            Trace<span className="text-primary">X</span>
          </div>
          <div className="taxonomy text-[8px] text-muted-foreground mt-1 truncate">
            Social Intelligence Console
          </div>
        </div>
      )}
    </div>
  );
}
