"use client";

/** Persistent left navigation spine. */
import { cn } from "@/lib/utils";
import { useApp } from "@/lib/app-state";
import { TraceXLogo } from "../common/TraceXLogo";
import { getAlerts } from "@/lib/mock";
import {
  LayoutDashboard,
  TrendingUp,
  HeartPulse,
  Users,
  Network,
  Bot,
  Radar,
  BellRing,
  ShieldCheck,
  Activity,
} from "lucide-react";
import type { ScreenId } from "@/lib/mock/types";

const NAV: {
  id: ScreenId;
  code: string;
  label: string;
  icon: typeof LayoutDashboard;
}[] = [
  { id: "overview", code: "01", label: "Overview", icon: LayoutDashboard },
  { id: "trends", code: "02", label: "Trend Explorer", icon: TrendingUp },
  { id: "sentiment", code: "03", label: "Sentiment & Emotion", icon: HeartPulse },
  { id: "demographics", code: "04", label: "Demographics", icon: Users },
  { id: "network", code: "05", label: "Network & Influence", icon: Network },
  { id: "bots", code: "06", label: "Bot Detection", icon: Bot },
  { id: "misinfo", code: "07", label: "Misinformation Radar", icon: Radar },
  { id: "alerts", code: "08", label: "Alerts & Reports", icon: BellRing },
];

export function Sidebar() {
  const { screen, go } = useApp();
  const newAlerts = getAlerts().filter((a) => a.status === "New").length;

  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col bg-sidebar border-r border-sidebar-border sticky top-0 h-screen">
      {/* Brand */}
      <div className="h-14 flex items-center px-4 border-b border-sidebar-border shrink-0">
        <TraceXLogo />
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2" aria-label="Console modules">
        <div className="taxonomy text-muted-foreground/60 px-2 pb-2">Modules</div>
        <ul className="space-y-0.5">
          {NAV.map((item) => {
            const active = screen === item.id;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => go(item.id)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative w-full flex items-center gap-2.5 px-2.5 h-9 rounded-md text-[13px]",
                    "transition-colors duration-100 cursor-pointer text-left",
                    active
                      ? "bg-sidebar-accent text-foreground font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/60"
                  )}
                >
                  {active && (
                    <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-primary" />
                  )}
                  <item.icon
                    className={cn("size-4 shrink-0", active ? "text-primary" : "text-muted-foreground")}
                    strokeWidth={1.75}
                  />
                  <span className="font-mono text-[9px] text-muted-foreground/60 tabular-nums">{item.code}</span>
                  <span className="truncate">{item.label}</span>
                  {item.id === "alerts" && newAlerts > 0 && (
                    <span className="ml-auto font-mono text-[10px] tnum text-signal-red bg-signal-red/10 border border-signal-red/30 rounded-sm px-1.5 py-0.5">
                      {newAlerts}
                    </span>
                  )}
                  {item.id === "misinfo" && (
                    <span className="ml-auto font-mono text-[10px] tnum text-signal-amber bg-signal-amber/10 border border-signal-amber/30 rounded-sm px-1.5 py-0.5">
                      2
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Pipeline status */}
      <div className="border-t border-sidebar-border p-3 space-y-2.5 shrink-0">
        <div className="taxonomy text-muted-foreground/60">Pipeline status</div>
        <div className="space-y-1.5 font-mono text-[10px] text-muted-foreground">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-[2px] bg-signal-green" />
              X stream
            </span>
            <span className="tnum">214ms</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-[2px] bg-signal-green" />
              TG stream
            </span>
            <span className="tnum">188ms</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Activity className="size-2.5 text-signal-cyan" />
              Queue
            </span>
            <span className="tnum">1.2k/min</span>
          </div>
          <div className="flex items-center justify-between text-muted-foreground/70">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="size-2.5" />
              Privacy mode
            </span>
            <span>k≥50</span>
          </div>
        </div>
      </div>

      {/* Analyst */}
      <div className="border-t border-sidebar-border p-3 flex items-center gap-2.5 shrink-0">
        <span className="size-8 rounded-md bg-muted border border-border flex items-center justify-center font-mono text-[11px] text-primary font-semibold">
          AS
        </span>
        <div className="min-w-0 leading-tight">
          <div className="text-xs font-medium text-foreground truncate">A. Sharma</div>
          <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">
            Analyst · L2
          </div>
        </div>
      </div>
    </aside>
  );
}
