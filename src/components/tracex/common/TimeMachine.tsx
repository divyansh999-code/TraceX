"use client";

/**
 * Time machine — temporal replay scrubber (v0.13).
 *
 * Lets an analyst "rewind the corpus": the playhead slices every Overview
 * artefact (chart, KPIs, trending table, heat strip) to an as-of position,
 * while a dimmed ghost line previews the still-upcoming window. Play runs
 * an automated ~14s sweep across the active range — a strong live-demo
 * gesture ("watch the last 30 days unfold").
 *
 * Purely presentational: playback timing lives in the host screen (one
 * interval, setState only inside the tick callback — lint-clean).
 */
import { useMemo } from "react";
import { Play, Pause, SkipBack, History } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtCompact } from "@/lib/fmt";

export interface TimeMachinePoint {
  t: number;
  label: string;
  total: number;
  spike: boolean;
}

export function TimeMachine({
  points,
  cursor,
  onCursor,
  playing,
  onPlaying,
}: {
  points: TimeMachinePoint[];
  /** null = live (full window). Otherwise index into points. */
  cursor: number | null;
  onCursor: (i: number | null) => void;
  playing: boolean;
  onPlaying: (p: boolean) => void;
}) {
  const max = Math.max(0, points.length - 1);
  const isLive = cursor == null;
  const pos = isLive ? max : Math.min(cursor, max);
  const pct = max > 0 ? (pos / max) * 100 : 100;

  const totals = useMemo(() => points.reduce((a, p) => a + p.total, 0) || 1, [points]);
  const cum = useMemo(() => points.slice(0, pos + 1).reduce((a, p) => a + p.total, 0), [points, pos]);
  const share = Math.round((cum / totals) * 100);
  const here = points[pos];
  const spikes = useMemo(() => points.map((p, i) => (p.spike ? i : -1)).filter((i) => i >= 0), [points]);

  const atEnd = !isLive && pos >= max;

  const onPlayClick = () => {
    if (playing) {
      onPlaying(false);
      return;
    }
    /* pressing play from live/end restarts the sweep from day zero */
    if (isLive || atEnd) onCursor(0);
    onPlaying(true);
  };

  const onSeek = (v: number) => {
    const i = Math.max(0, Math.min(max, v));
    onCursor(i >= max ? null : i);
    onPlaying(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 select-none" data-tour-ignore>
      {/* transport controls */}
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={onPlayClick}
          aria-label={playing ? "Pause temporal replay" : atEnd || isLive ? "Replay window from start" : "Play temporal replay"}
          title={playing ? "Pause" : isLive || atEnd ? "Replay from window start" : "Play"}
          className={cn(
            "size-7 rounded-md border flex items-center justify-center transition-colors cursor-pointer",
            playing
              ? "border-primary/60 text-primary bg-primary/10"
              : "border-border text-muted-foreground hover:text-primary hover:border-primary/50"
          )}
        >
          {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5 translate-x-px" />}
        </button>
        <button
          type="button"
          onClick={() => {
            onCursor(0);
            onPlaying(false);
          }}
          aria-label="Rewind to window start"
          title="Rewind to start"
          disabled={isLive || pos === 0}
          className="size-7 rounded-md border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-muted-foreground/40 transition-colors cursor-pointer disabled:opacity-35 disabled:cursor-default"
        >
          <SkipBack className="size-3.5" />
        </button>
      </div>

      {/* scrub track — layered: base + fill + spike ticks + thumb, with an
          invisible native range on top for pointer drag + keyboard a11y */}
      <div
        className="relative flex-1 min-w-40 h-6 flex items-center has-[:focus-visible]:outline-1 has-[:focus-visible]:outline-ring rounded"
        title="Temporal playhead — drag or use arrow keys · amber ticks mark spike days"
      >
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1 rounded-[2px] bg-border overflow-visible" />
        <div
          className="absolute left-0 top-1/2 -translate-y-1/2 h-1 rounded-[2px] bg-primary/55 transition-[width] duration-150"
          style={{ width: `${pct}%` }}
        />
        {spikes.map((i) => (
          <span
            key={i}
            aria-hidden="true"
            className="absolute top-1/2 -translate-y-1/2 size-1 rounded-[1px] bg-signal-amber/90"
            style={{ left: `calc(${max > 0 ? (i / max) * 100 : 0}% - 2px)` }}
          />
        ))}
        {pos < max && (
          <span
            aria-hidden="true"
            className="absolute top-1/2 -translate-y-1/2 right-0 size-1 rounded-[1px] bg-signal-green pulse-dot"
            title="live edge"
          />
        )}
        {/* playhead thumb */}
        <span
          aria-hidden="true"
          className={cn(
            "absolute top-1/2 -translate-y-1/2 -translate-x-1/2 size-3.5 rounded-[4px] border bg-card pointer-events-none transition-[left] duration-150 z-10",
            playing
              ? "border-primary text-primary tm-thumb-live"
              : isLive
                ? "border-muted-foreground/70"
                : "border-primary"
          )}
          style={{ left: `${pct}%` }}
        />
        <input
          type="range"
          min={0}
          max={max}
          step={1}
          value={pos}
          onChange={(e) => onSeek(parseInt(e.target.value, 10))}
          aria-label="Temporal playback position"
          aria-valuetext={isLive ? "Live — full window" : `As of ${here?.label ?? ""}`}
          className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize"
        />
      </div>

      {/* live toggle */}
      <button
        type="button"
        onClick={() => {
          onCursor(null);
          onPlaying(false);
        }}
        aria-pressed={isLive}
        title={isLive ? "Viewing the live window" : "Return to the live window"}
        className={cn(
          "inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border font-mono text-[10px] uppercase tracking-wider transition-colors cursor-pointer shrink-0",
          isLive
            ? "border-signal-green/50 text-signal-green bg-signal-green/10"
            : "border-border text-muted-foreground hover:text-signal-green hover:border-signal-green/50"
        )}
      >
        <History className="size-3" />
        {isLive ? "live" : "go live"}
      </button>

      {/* readout */}
      <div className="font-mono text-[10px] tnum text-muted-foreground/80 whitespace-nowrap shrink-0 tabular-nums">
        {isLive ? (
          <>
            <span className="text-foreground">LIVE</span> · full window · {points.length} pts
          </>
        ) : (
          <>
            <span className="text-primary">{here?.label ?? "—"}</span> · step {pos + 1}/{points.length} ·{" "}
            {fmtCompact(cum)} cum · {share}% vol
          </>
        )}
      </div>
    </div>
  );
}
