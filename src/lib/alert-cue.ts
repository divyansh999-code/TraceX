"use client";

/**
 * Critical-alert audio cue — SOC-style telemetry chirp.
 *
 * A tiny module singleton (no context/provider needed):
 * - `AlertCueToggle`  → volume button for the top command bar; state is
 *   persisted to localStorage and gates all playback.
 * - `dispatchAlertCue(severity)` → call sites (live feed) fire this when a
 *   high/critical alert lands; a window listener mounted at shell level
 *   plays the cue when enabled.
 * - WebAudio oscillator two-tone chirp (~160ms, quiet) — no audio assets,
 *   no autoplay issues: the toggle click provides the user gesture that
 *   unlocks the AudioContext.
 */

const AUDIO_KEY = "tracex.audio.v1";
const CUE_EVENT = "tracex:alert-cue";

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  return ctx;
}

export function isAudioEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(AUDIO_KEY) === "on";
  } catch {
    return false;
  }
}

export function setAudioEnabled(on: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(AUDIO_KEY, on ? "on" : "off");
  } catch {
    /* best-effort */
  }
  if (on) {
    /* the toggle click is the user gesture — unlock audio now */
    const c = getCtx();
    if (c && c.state === "suspended") void c.resume();
  }
}

/** Two-tone descending chirp, quiet and short — instrument beep, not a siren. */
export function playCriticalCue(): void {
  if (!isAudioEnabled()) return;
  const c = getCtx();
  if (!c || c.state !== "running") return;
  const t0 = c.currentTime;
  const notes: Array<[number, number]> = [
    [880, 0],
    [660, 0.09],
  ];
  for (const [freq, offset] of notes) {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t0 + offset);
    gain.gain.exponentialRampToValueAtTime(0.07, t0 + offset + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + offset + 0.085);
    osc.connect(gain).connect(c.destination);
    osc.start(t0 + offset);
    osc.stop(t0 + offset + 0.1);
  }
}

/** Fire the cue event — call when a high/critical alert lands in a live feed. */
export function dispatchAlertCue(severity: string): void {
  if (typeof window === "undefined") return;
  if (severity !== "high" && severity !== "critical") return;
  window.dispatchEvent(new CustomEvent(CUE_EVENT, { detail: { severity } }));
}

/** Shell-level listener hook: binds the cue event to the audio engine. */
export function bindAlertCue(): () => void {
  if (typeof window === "undefined") return () => {};
  const onCue = () => playCriticalCue();
  window.addEventListener(CUE_EVENT, onCue);
  return () => window.removeEventListener(CUE_EVENT, onCue);
}
