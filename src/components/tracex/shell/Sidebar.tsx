"use client";

/**
 * Persistent left navigation spine — flexible across every viewport:
 *  · lg−xl desktops: the familiar full rail (w-60) or a user-collapsed
 *    icon rail (w-[60px]), toggle persisted per browser;
 *  · below md: the same spine rides in a slide-over drawer summoned from
 *    the top bar's menu button (single navigation surface everywhere).
 * Visual design and hierarchy are unchanged — only the flexibility moved.
 */
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useApp } from "@/lib/app-state";
import { TraceXLogo, TraceXMark } from "../common/TraceXLogo";
import { Sparkline } from "../common/Sparkline";
import { CHART } from "../common/ChartBits";
import { getAlerts, getTopicById, getTopicSeries } from "@/lib/mock";
import { fmtCompact } from "@/lib/fmt";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
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
  Star,
  Command,
  PanelLeftClose,
  PanelLeftOpen,
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

const COLLAPSE_KEY = "tracex.sidebar.collapsed";

interface BodyProps {
  collapsed: boolean;
  /** drawer mode — items close the sheet on navigate */
  sheet?: boolean;
  onNavigate?: () => void;
  onToggleCollapse?: () => void;
}

function SidebarBody({ collapsed, sheet = false, onNavigate, onToggleCollapse }: BodyProps) {
  const { screen, go, filters, watchlist } = useApp();
  const newAlerts = getAlerts().filter((a) => a.status === "New").length;

  const nav = (id: ScreenId, opts?: { topicId?: string }) => {
    go(id, opts);
    if (sheet) onNavigate?.();
  };

  return (
    <>
      {/* Brand */}
      <div
        className={cn(
          "h-14 flex items-center border-b border-sidebar-border shrink-0",
          collapsed && !sheet ? "justify-center px-0" : "px-4"
        )}
      >
        {collapsed && !sheet ? <TraceXMark size={28} /> : <TraceXLogo />}
      </div>

      {/* Navigation */}
      <nav
        className="flex-1 overflow-y-auto py-3 px-2"
        aria-label="Console modules"
        data-tour="module-rail"
      >
        {!collapsed || sheet ? <div className="taxonomy text-muted-foreground/60 px-2 pb-2">Modules</div> : null}
        <ul className="space-y-0.5">
          {NAV.map((item) => {
            const active = screen === item.id;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => nav(item.id)}
                  aria-current={active ? "page" : undefined}
                  title={item.label}
                  className={cn(
                    "relative w-full flex items-center gap-2.5 h-9 rounded-md text-[13px]",
                    "transition-colors duration-100 cursor-pointer text-left",
                    collapsed && !sheet ? "justify-center px-0" : "px-2.5",
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
                  {(!collapsed || sheet) && (
                    <>
                      <span className="font-mono text-[9px] text-muted-foreground/60 tabular-nums">{item.code}</span>
                      <span className="truncate">{item.label}</span>
                    </>
                  )}
                  {item.id === "alerts" && newAlerts > 0 && (
                    <span
                      className={cn(
                        "font-mono text-[10px] tnum text-signal-red bg-signal-red/10 border border-signal-red/30 rounded-sm px-1.5 py-0.5",
                        collapsed && !sheet
                          ? "absolute top-1 right-1.5 px-1 py-0 text-[9px]"
                          : "ml-auto"
                      )}
                    >
                      {newAlerts}
                    </span>
                  )}
                  {item.id === "misinfo" && (
                    <span
                      className={cn(
                        "font-mono text-[10px] tnum text-signal-amber bg-signal-amber/10 border border-signal-amber/30 rounded-sm px-1.5 py-0.5",
                        collapsed && !sheet ? "hidden" : "ml-auto"
                      )}
                    >
                      2
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Watchlist — starred narratives (full rail / drawer only) */}
      {(!collapsed || sheet) && watchlist.length > 0 && (
        <div className="border-t border-sidebar-border py-3 px-2 shrink-0" data-tour="watchlist">
          <div className="taxonomy text-muted-foreground/60 px-2 pb-2 flex items-center gap-1.5">
            <Star className="size-2.5 text-primary" />
            Watchlist
            <span className="ml-auto font-mono text-[9px] tnum">{watchlist.length}</span>
          </div>
          <ul className="space-y-0.5">
            {watchlist.slice(0, 5).map((id) => {
              const topic = getTopicById(id);
              if (!topic) return null;
              const spark = getTopicSeries(topic, filters).map((p) => p.total);
              return (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => nav("trends", { topicId: id })}
                    className="w-full flex items-center gap-2 px-2.5 h-9 rounded-md text-[11px] text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/60 transition-colors cursor-pointer group"
                    title={topic.gloss}
                  >
                    <span
                      className={cn(
                        "size-1.5 rounded-[2px] shrink-0",
                        topic.risk >= 0.55
                          ? "bg-signal-red"
                          : topic.risk >= 0.35
                            ? "bg-signal-amber"
                            : "bg-signal-green"
                      )}
                    />
                    <span className="truncate max-w-24">{topic.label}</span>
                    <Sparkline
                      data={spark}
                      color={topic.risk >= 0.55 ? CHART.red : CHART.cyan}
                      width={44}
                      height={14}
                      area={false}
                      className="ml-auto opacity-70 group-hover:opacity-100"
                    />
                    <span className="font-mono text-[9px] tnum text-muted-foreground/70 w-8 text-right">
                      {fmtCompact(topic.baseVolume * 1.75)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Hotkeys hint */}
      {!collapsed && !sheet && (
        <div className="border-t border-sidebar-border px-4 py-2.5 shrink-0 hidden lg:flex items-center gap-2 text-[9px] font-mono text-muted-foreground/50">
          <Command className="size-2.5" />
          <span>K palette</span>
          <span className="mx-1 text-border">·</span>
          <span>1–8 modules</span>
        </div>
      )}

      {/* Pipeline status (full rail / drawer only) */}
      {(!collapsed || sheet) && (
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
      )}

      {/* Analyst */}
      <div
        className={cn(
          "border-t border-sidebar-border p-3 flex items-center gap-2.5 shrink-0",
          collapsed && !sheet ? "justify-center p-2" : ""
        )}
      >
        <span
          className={cn(
            "size-8 rounded-md bg-muted border border-border flex items-center justify-center font-mono text-[11px] text-primary font-semibold",
            collapsed && !sheet ? "shrink-0" : ""
          )}
          title="A. Sharma — Analyst · L2"
        >
          AS
        </span>
        {(!collapsed || sheet) && (
          <div className="min-w-0 leading-tight">
            <div className="text-xs font-medium text-foreground truncate">A. Sharma</div>
            <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">
              Analyst · L2
            </div>
          </div>
        )}
      </div>

      {/* Rail-width toggle (desktop spine only) */}
      {!sheet && onToggleCollapse && (
        <div className="border-t border-sidebar-border shrink-0">
          <button
            type="button"
            onClick={onToggleCollapse}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-pressed={collapsed}
            className={cn(
              "w-full h-9 flex items-center gap-2.5 text-[10px] font-mono text-muted-foreground/60",
              "hover:text-foreground hover:bg-sidebar-accent/40 transition-colors cursor-pointer",
              collapsed ? "justify-center px-0" : "px-4"
            )}
          >
            {collapsed ? (
              <PanelLeftOpen className="size-3.5" />
            ) : (
              <>
                <PanelLeftClose className="size-3.5" />
                <span>Collapse</span>
              </>
            )}
          </button>
        </div>
      )}
    </>
  );
}

export function Sidebar({
  mobileOpen,
  onMobileOpenChange,
}: {
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
}) {
  const [collapsed, setCollapsed] = useState(
    () => typeof window !== "undefined" && window.localStorage.getItem(COLLAPSE_KEY) === "1"
  );

  const toggleCollapsed = () =>
    setCollapsed((c) => {
      const next = !c;
      try {
        window.localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        /* private mode — best effort */
      }
      return next;
    });

  return (
    <>
      {/* Desktop spine — full rail ↔ icon rail, width eases between states */}
      <aside
        className={cn(
          "hidden md:flex shrink-0 flex-col bg-sidebar border-r border-sidebar-border sticky top-0 h-screen",
          "transition-[width] duration-200 ease-out",
          collapsed ? "w-[60px]" : "w-60"
        )}
      >
        <SidebarBody collapsed={collapsed} onToggleCollapse={toggleCollapsed} />
      </aside>

      {/* Mobile drawer — the same spine, summoned from the top-bar menu button */}
      <Sheet open={mobileOpen} onOpenChange={onMobileOpenChange}>
        <SheetContent
          side="left"
          className="w-72 p-0 gap-0 bg-sidebar border-r border-sidebar-border shadow-xl"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Console navigation</SheetTitle>
            <SheetDescription>Modules, watchlist and pipeline status</SheetDescription>
          </SheetHeader>
          <div className="flex flex-col min-h-0 h-full overflow-y-auto">
            <SidebarBody collapsed={false} sheet onNavigate={() => onMobileOpenChange(false)} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
