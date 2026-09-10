"use client";

/**
 * TraceX application shell: sidebar spine + command bar + module canvas.
 * Boot splash gates first paint; module switching animates content.
 *
 * v0.11: shell-level mounts — global report modal (palette-accessible),
 * critical-alert audio cue listener, dynamic document title.
 */
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AppProvider, useApp } from "@/lib/app-state";
import { bindAlertCue } from "@/lib/alert-cue";
import { Sidebar } from "./shell/Sidebar";
import { TopBar } from "./shell/TopBar";
import { StatusBar } from "./shell/StatusBar";
import { BootSplash } from "./shell/BootSplash";
import { HotkeyHelp } from "./shell/HotkeyHelp";
import { GuidedTour } from "./shell/GuidedTour";
import { ReportModal } from "./modals/ReportModal";
import { MethodologyDialog } from "./modals/MethodologyDialog";
import { DayDossierDialog } from "./modals/DayDossierDialog";
import { OverviewScreen } from "./screens/OverviewScreen";
import { TrendsScreen } from "./screens/TrendsScreen";
import { SentimentScreen } from "./screens/SentimentScreen";
import { DemographicsScreen } from "./screens/DemographicsScreen";
import { NetworkScreen } from "./screens/NetworkScreen";
import { BotScreen } from "./screens/BotScreen";
import { MisinfoScreen } from "./screens/MisinfoScreen";
import { AlertsScreen } from "./screens/AlertsScreen";
import type { ScreenId } from "@/lib/mock/types";
import {
  LayoutDashboard,
  TrendingUp,
  HeartPulse,
  Users,
  Network,
  Bot,
  Radar,
  BellRing,
} from "lucide-react";
import { cn } from "@/lib/utils";

const MOBILE_NAV: { id: ScreenId; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "trends", label: "Trends", icon: TrendingUp },
  { id: "sentiment", label: "Sentiment", icon: HeartPulse },
  { id: "demographics", label: "People", icon: Users },
  { id: "network", label: "Network", icon: Network },
  { id: "bots", label: "Bots", icon: Bot },
  { id: "misinfo", label: "Misinfo", icon: Radar },
  { id: "alerts", label: "Alerts", icon: BellRing },
];

function ModuleCanvas() {
  const { screen } = useApp();
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={screen}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
        className="min-w-0"
      >
        {screen === "overview" && <OverviewScreen />}
        {screen === "trends" && <TrendsScreen />}
        {screen === "sentiment" && <SentimentScreen />}
        {screen === "demographics" && <DemographicsScreen />}
        {screen === "network" && <NetworkScreen />}
        {screen === "bots" && <BotScreen />}
        {screen === "misinfo" && <MisinfoScreen />}
        {screen === "alerts" && <AlertsScreen />}
      </motion.div>
    </AnimatePresence>
  );
}

/** Mobile module switcher (tablet/field posture). */
function MobileNav() {
  const { screen, go } = useApp();
  return (
    <nav className="md:hidden border-b border-border bg-card/60 backdrop-blur-sm overflow-x-auto" aria-label="Modules">
      <div className="flex items-center gap-1 px-3 py-2 w-max">
        {MOBILE_NAV.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => go(item.id)}
            className={cn(
              "flex items-center gap-1.5 px-2.5 h-7 rounded-md text-[11px] whitespace-nowrap transition-colors cursor-pointer",
              screen === item.id
                ? "bg-secondary text-foreground border border-border font-medium"
                : "text-muted-foreground border border-transparent hover:text-foreground"
            )}
          >
            <item.icon className="size-3.5" strokeWidth={1.75} />
            {item.label}
          </button>
        ))}
      </div>
    </nav>
  );
}

/** Global hotkeys: 1–8 switch modules (muted while the guided tour runs). */
function ModuleHotkeys() {
  const { go } = useApp();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      /* the guided tour owns keyboard focus while it walks the console */
      if (document.body.classList.contains("tour-active")) return;
      const idx = parseInt(e.key, 10);
      if (idx >= 1 && idx <= 8) {
        go(MOBILE_NAV[idx - 1].id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);
  return null;
}

/** Critical-alert audio cue — reacts to live-feed dispatches (see lib/alert-cue). */
function AlertCueListener() {
  useEffect(() => bindAlertCue(), []);
  return null;
}

/** Dynamic tab title — "Module · TraceX" telemetry breadcrumb, suffixed with
 *  the live unread count (shared alert bus) so background tabs flag triage. */
const TITLE_LABEL: Record<ScreenId, string> = {
  overview: "Mission Control",
  trends: "Trend Explorer",
  sentiment: "Sentiment & Emotion",
  demographics: "Demographics",
  network: "Interaction Graph",
  bots: "Bot Detection",
  misinfo: "Misinformation Radar",
  alerts: "Alerts & Reports",
};
function DocumentTitle() {
  const { screen, alertUnread } = useApp();
  useEffect(() => {
    document.title =
      alertUnread > 0
        ? `(${alertUnread}) ${TITLE_LABEL[screen]} · TraceX`
        : `${TITLE_LABEL[screen]} · TraceX`;
  }, [screen, alertUnread]);
  return null;
}

function Console() {
  const { reportOpen, setReportOpen } = useApp();
  return (
    <div className="flex min-h-screen min-w-0 tracex-root">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        <TopBar />
        <MobileNav />
        <main className="flex-1 px-4 py-5 min-w-0 w-full">
          <ModuleHotkeys />
          <AlertCueListener />
          <DocumentTitle />
          <HotkeyHelp />
          <GuidedTour />
          <ModuleCanvas />
        </main>
        <StatusBar />
      </div>
      {/* global intelligence report — openable from any screen via ⌘K */}
      <ReportModal open={reportOpen} onOpenChange={setReportOpen} />
      {/* methodology & provenance briefing — palette / cheatsheet reachable */}
      <MethodologyDialog />
      {/* summoned day dossier — replay ⏎ / palette / shareable #/overview/day:TS */}
      <DayDossierDialog />
    </div>
  );
}

export function TraceXApp() {
  const [booted, setBooted] = useState(false);
  return (
    <AppProvider>
      {booted ? <Console /> : <BootSplash onDone={() => setBooted(true)} />}
    </AppProvider>
  );
}
