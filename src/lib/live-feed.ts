/**
 * Live alert feed singleton (v0.12).
 *
 * One interval, started at the shell level, generates "arriving" alerts
 * (SOC template traffic). Each arrival:
 *   1. fires the critical-alert audio cue (lib/alert-cue) — so the chirp
 *      now sounds on EVERY screen, not just the Overview feed, and
 *   2. is broadcast to subscribers (AppProvider keeps them in global state
 *      for the bell badge, the tab-title unread count and the Overview feed).
 *
 * Duplicate `startLiveFeed()` calls are safe — the first call owns the timer.
 */

import type { IntelligenceAlert } from "./mock/types";
import { dispatchAlertCue } from "./alert-cue";

const EVENT = "tracex:live-alert";

type Listener = (alert: IntelligenceAlert) => void;
const listeners = new Set<Listener>();

let timer: ReturnType<typeof setInterval> | null = null;
let seq = 0;

const TEMPLATES: Omit<IntelligenceAlert, "id" | "t">[] = [
  {
    type: "spike",
    severity: "medium",
    title: "Velocity anomaly detected",
    detail: "Hourly z-score 3.2 on monitored keyword set; evaluating correlation.",
    status: "New",
    linkScreen: "trends",
  },
  {
    type: "bot-cluster",
    severity: "high",
    title: "Amplification burst — TX-88 fringe",
    detail: "19 sibling accounts posted within 6s; escalation queued.",
    status: "New",
    linkScreen: "bots",
  },
  {
    type: "misinformation",
    severity: "medium",
    title: "Claim re-emergence flagged",
    detail: "Disputed claim text re-matched at 0.92 similarity.",
    status: "New",
    linkScreen: "misinfo",
  },
  {
    type: "sentiment-shift",
    severity: "low",
    title: "Sentiment drift observed",
    detail: "Anxiety share rising 0.8%/h on civic keyword cluster.",
    status: "New",
    linkScreen: "sentiment",
  },
  {
    type: "spike",
    severity: "critical",
    title: "Coordinated spike detected",
    detail: "Cross-platform burst 4.1× baseline inside a 20-minute window.",
    status: "New",
    linkScreen: "overview",
  },
];

/** Start the singleton feed timer (idempotent). Returns a stop function. */
export function startLiveFeed(): () => void {
  if (timer) return () => stopLiveFeed();
  /* 22s cadence — deliberate SOC-ish pacing for a demo: visible, not noisy */
  timer = setInterval(() => {
    seq += 1;
    const t = TEMPLATES[(seq - 1) % TEMPLATES.length];
    const alert: IntelligenceAlert = {
      ...t,
      id: `ALR-L${9000 + seq}`,
      t: Date.now(),
    };
    /* audio cue fires from the singleton — every screen, not just Overview */
    dispatchAlertCue(alert.severity);
    for (const l of listeners) l(alert);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(EVENT, { detail: alert }));
    }
  }, 22_000);
  return () => stopLiveFeed();
}

function stopLiveFeed(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

/** Subscribe to arrivals. Returns an unsubscribe function. */
export function subscribeLiveAlerts(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
