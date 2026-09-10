"use client";

/** Slim bottom status strip — sticks to viewport bottom via mt-auto. */
import { ShieldCheck } from "lucide-react";
import { useNow } from "../common/Skeletons";
import { HintStrip } from "../common/Kbd";
import { fmtClockIST } from "@/lib/fmt";

export function StatusBar() {
  const now = useNow(1000);
  return (
    <footer className="mt-auto shrink-0 h-8 border-t border-border bg-card/60 backdrop-blur-sm flex items-center px-4 gap-4 overflow-x-auto">
      <span className="font-mono text-[10px] text-muted-foreground whitespace-nowrap">
        TRACEX <span className="text-primary">v0.10.0</span> · SIH-26152 PROTOTYPE
      </span>
      <span className="hidden md:inline-flex items-center gap-1.5 font-mono text-[10px] text-signal-green whitespace-nowrap">
        <ShieldCheck className="size-3" />
        AGGREGATED · ANONYMIZED · k≥50
      </span>
      <HintStrip className="hidden sm:inline-flex shrink-0" />
      <span className="ml-auto font-mono text-[10px] text-muted-foreground whitespace-nowrap hidden lg:inline">
        8/8 MODULES NOMINAL · INGEST 1.2k/min
      </span>
      <span className="font-mono text-[10px] tnum text-muted-foreground whitespace-nowrap">
        {now ? fmtClockIST(now) : "--:--:--"} IST
      </span>
    </footer>
  );
}
