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
import { IntegrityScreen } from "./screens/integrity/IntegrityScreen";
import { AlertsScreen } from "./screens/AlertsScreen";
import type { ScreenId } from "@/lib/mock/types";

/** Hotkey order — module keys 1–7 (mirrors the sidebar rail order). */
const HOTKEY_ORDER: ScreenId[] = [
  "overview",
  "trends",
  "sentiment",
  "demographics",
  "network",
  "integrity",
  "alerts",
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
        {screen === "integrity" && <IntegrityScreen />}
        {screen === "alerts" && <AlertsScreen />}
      </motion.div>
    </AnimatePresence>
  );
}

/** Global hotkeys: 1–7 switch modules (muted while the guided tour runs). */
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
      if (idx >= 1 && idx <= HOTKEY_ORDER.length) {
        go(HOTKEY_ORDER[idx - 1]);
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
  integrity: "Information Integrity",
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
  /* the sidebar drawer rides below md — one navigation surface everywhere */
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  return (
    <div className="flex min-h-screen min-w-0 tracex-root">
      <Sidebar mobileOpen={mobileNavOpen} onMobileOpenChange={setMobileNavOpen} />
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        <TopBar onOpenMobileNav={() => setMobileNavOpen(true)} />
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
