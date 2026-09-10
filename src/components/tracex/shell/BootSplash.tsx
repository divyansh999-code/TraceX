"use client";

/** Boot sequence splash — covers data hydration, sets the ops-room tone. */
import { useEffect, useState } from "react";
import { TraceXMark } from "../common/TraceXLogo";
import { cn } from "@/lib/utils";

const BOOT_LINES = [
  "auth handshake … analyst@tracex // clearance L2",
  "ingest streams … X firehose nominal · TG firehose nominal",
  "correlation engine … 8/8 modules online",
  "privacy envelope … aggregated mode enforced (k ≥ 50)",
  "rendering collection grid …",
];

export function BootSplash({ onDone, duration = 1500 }: { onDone: () => void; duration?: number }) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timers = BOOT_LINES.map((_, i) =>
      setTimeout(() => setStep(i + 1), (duration / (BOOT_LINES.length + 1)) * (i + 0.4))
    );
    const done = setTimeout(onDone, duration);
    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(done);
    };
  }, [onDone, duration]);

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center gap-8 px-6">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <TraceXMark size={64} />
          <span className="absolute inset-0 overflow-hidden rounded-xl pointer-events-none">
            <span className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-primary/15 to-transparent scanline" />
          </span>
        </div>
        <div className="text-center">
          <div className="font-display text-2xl font-semibold tracking-tight text-foreground">
            Trace<span className="text-primary">X</span>
          </div>
          <div className="taxonomy text-[9px] text-muted-foreground mt-1.5">
            Social Intelligence &amp; Information Flow Analytics
          </div>
        </div>
      </div>

      {/* progress hairline */}
      <div className="w-64 h-px bg-border relative overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 bg-primary transition-all duration-300"
          style={{ width: `${(step / BOOT_LINES.length) * 100}%` }}
        />
      </div>

      <div className="font-mono text-[10px] text-muted-foreground space-y-1 h-28 w-full max-w-md">
        {BOOT_LINES.slice(0, step).map((line) => (
          <div key={line} className="flex items-center gap-2 animate-in fade-in duration-300">
            <span className="text-signal-green">›</span>
            <span className="truncate">{line}</span>
            <span className="ml-auto text-signal-green/80">OK</span>
          </div>
        ))}
      </div>
    </div>
  );
}
