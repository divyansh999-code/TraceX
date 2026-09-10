/** Telemetry-grade number formatting. */

export function fmtCompact(n: number): string {
  if (!isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${(n / 1e9).toFixed(abs >= 1e10 ? 0 : 1)}B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(abs >= 1e7 ? 0 : 1)}M`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(abs >= 1e4 ? 0 : 1)}k`;
  return `${Math.round(n)}`;
}

export function fmtFull(n: number): string {
  return Math.round(n).toLocaleString("en-IN");
}

export function fmtPct(n: number, digits = 0): string {
  return `${n > 0 ? "" : ""}${n.toFixed(digits)}%`;
}

export function fmtSigned(n: number, digits = 0): string {
  const s = n > 0 ? "+" : n < 0 ? "−" : "";
  return `${s}${Math.abs(n).toFixed(digits)}`;
}

export function fmtScore(n: number): string {
  return n.toFixed(2);
}

export function fmtNet(n: number): string {
  return `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toFixed(2)}`;
}

/** IST clock string, e.g. 14:32:07 */
export function fmtClockIST(d: Date = new Date()): string {
  return d.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "Asia/Kolkata",
  });
}

export function fmtDateIST(t: number): string {
  return new Date(t).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Kolkata",
  });
}

/** Compact relative time, e.g. "22m", "3.4h", "2d" */
export function relTime(t: number, now: number = Date.now()): string {
  const diff = Math.max(0, now - t);
  const m = diff / 60_000;
  if (m < 1) return "now";
  if (m < 60) return `${Math.floor(m)}m`;
  const h = m / 60;
  if (h < 48) return `${h < 10 ? h.toFixed(1) : Math.floor(h)}h`;
  return `${Math.floor(h / 24)}d`;
}

export function riskTone(risk: number): "green" | "amber" | "red" {
  if (risk >= 0.75) return "red";
  if (risk >= 0.45) return "amber";
  return "green";
}

export function sentimentTone(net: number): "green" | "amber" | "red" {
  if (net >= 0.15) return "green";
  if (net <= -0.15) return "red";
  return "amber";
}
