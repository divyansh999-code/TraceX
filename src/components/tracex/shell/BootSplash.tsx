"use client";

/** Boot sequence splash — covers data hydration, sets the studio tone. */
import { useEffect, useState } from "react";
import { TraceXMark } from "../common/TraceXLogo";

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
    <div className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center gap-9 px-6">
      {/* dawn wash — mauve from the north-east, peach from the south-west */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(900px 440px at 82% -8%, rgba(153, 149, 232, 0.16), transparent 60%)," +
            "radial-gradient(760px 400px at -6% 106%, rgba(253, 181, 165, 0.14), transparent 55%)",
        }}
      />

      <div className="relative flex flex-col items-center gap-5">
        <div className="relative">
          <div className="bg-white rounded-2xl border border-border p-4 shadow-[0_12px_36px_-12px_rgba(46,42,69,0.25)]">
            <TraceXMark size={56} />
          </div>
          <span className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none">
            <span className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-primary/15 to-transparent scanline" />
          </span>
        </div>
        <div className="text-center">
          <div className="font-display text-[26px] font-semibold tracking-tight text-foreground">
            Trace<span className="dusk-text font-bold">X</span>
          </div>
          <div className="taxonomy text-[9px] text-muted-foreground mt-2">
            Social Intelligence &amp; Information Flow Analytics
          </div>
        </div>
      </div>

      {/* progress hairline — the dusk gradient fills as modules come online */}
      <div className="w-64 h-[3px] rounded-full bg-border/60 relative overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 rounded-full dusk-gradient transition-all duration-300"
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
