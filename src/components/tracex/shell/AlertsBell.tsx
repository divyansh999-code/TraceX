"use client";

/**
 * Live alert bell for the top command bar.
 * Unread badge tracks unacknowledged critical/high alerts; the popover
 * feed jumps straight to the implicated module.
 */
import { useMemo, useState } from "react";
import { useApp } from "@/lib/app-state";
import { getAlerts, NOW, type AlertType, type IntelligenceAlert } from "@/lib/mock";
import { relTime } from "@/lib/fmt";
import { cn } from "@/lib/utils";
import { SeverityDot, Badge, Taxonomy, type Tone } from "../common/primitives";
import { useNow } from "../common/Skeletons";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Bell, CheckCheck, ArrowRight } from "lucide-react";
import type { ScreenId } from "@/lib/mock/types";

const TYPE_META: Record<AlertType, { label: string; tone: Tone }> = {
  spike: { label: "spike", tone: "orange" },
  "bot-cluster": { label: "bot", tone: "red" },
  misinformation: { label: "misinfo", tone: "amber" },
  "sentiment-shift": { label: "sentiment", tone: "cyan" },
};

/** Alerts that warrant an unread badge — critical/high and still New. */
function isHot(a: IntelligenceAlert): boolean {
  return a.status === "New" && (a.severity === "critical" || a.severity === "high");
}

export function AlertsBell() {
  const { go } = useApp();
  const [open, setOpen] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(() => new Set());
  const now = useNow(30_000);

  const alerts = useMemo(() => getAlerts(), []);
  const feed = useMemo(() => [...alerts].sort((a, b) => b.t - a.t).slice(0, 10), [alerts]);
  const unread = feed.filter((a) => isHot(a) && !readIds.has(a.id)).length;

  const markAllRead = () => setReadIds(new Set(feed.map((a) => a.id)));

  const jump = (a: IntelligenceAlert) => {
    setOpen(false);
    if (a.linkScreen) go(a.linkScreen);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) markAllRead();
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Alerts — ${unread} unread`}
          title="Live alert feed"
          className="relative size-7 rounded-md border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-muted-foreground/40 transition-colors cursor-pointer"
        >
          <Bell className="size-3.5" />
          {unread > 0 && (
            <span
              className={cn(
                "absolute -top-1 -right-1 min-w-3.5 h-3.5 px-0.5 rounded-[3px] flex items-center justify-center",
                "bg-signal-red text-white font-mono text-[8px] font-bold tnum leading-none",
                "shadow-[0_0_0_2px_var(--background)]"
              )}
            >
              {unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[340px] p-0">
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border">
          <Bell className="size-3.5 text-primary" />
          <Taxonomy>Live alert feed</Taxonomy>
          <span className="ml-auto font-mono text-[10px] tnum text-muted-foreground">
            {feed.length} recent
          </span>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {feed.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => jump(a)}
              className={cn(
                "w-full text-left px-3 py-2 border-b border-border/50 last:border-0 transition-colors",
                a.linkScreen ? "hover:bg-accent cursor-pointer" : "cursor-default"
              )}
              title={a.linkScreen ? `Open ${a.linkScreen} module` : a.title}
            >
              <div className="flex items-center gap-1.5">
                <SeverityDot severity={a.severity} />
                <span className="text-[11px] font-medium text-foreground truncate flex-1 min-w-0">
                  {a.title}
                </span>
                {isHot(a) && !readIds.has(a.id) && a.status === "New" && (
                  <span className="size-1.5 rounded-[2px] bg-signal-red shrink-0" aria-label="unread" />
                )}
                <span className="font-mono text-[9px] tnum text-muted-foreground/70 shrink-0">
                  {relTime(a.t, now ? now.getTime() : NOW)} ago
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-1">
                <Badge tone={TYPE_META[a.type].tone}>{TYPE_META[a.type].label}</Badge>
                <span className="font-mono text-[9px] tnum text-muted-foreground/60 truncate">{a.id}</span>
              </div>
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between px-3 py-2 border-t border-border">
          <button
            type="button"
            onClick={markAllRead}
            className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <CheckCheck className="size-3" /> Mark all read
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              go("alerts" as ScreenId);
            }}
            className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-primary hover:text-primary/80 transition-colors cursor-pointer"
          >
            Triage console <ArrowRight className="size-3" />
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
