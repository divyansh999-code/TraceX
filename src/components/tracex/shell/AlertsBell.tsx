"use client";

/**
 * Live alert bell for the top command bar.
 * Consumes the SHARED live-alert bus (app-state): the shell-level feed
 * singleton publishes arrivals there, so the bell badge, the Overview feed
 * and the tab-title unread count render one stream. Read-state is likewise
 * global — opening the bell or the triage console clears the same badge.
 */
import { useApp } from "@/lib/app-state";
import { NOW, type AlertType } from "@/lib/mock";
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

export function AlertsBell() {
  const { go, alertsFeed: feed, alertUnread: unread, markAlertsRead } = useApp();
  const now = useNow(30_000);

  const jump = (screen: ScreenId | undefined) => {
    if (screen) go(screen);
  };

  return (
    <Popover
      onOpenChange={(o) => {
        if (o) markAlertsRead(feed.map((a) => a.id));
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
              key={unread}
              className={cn(
                "bell-pop absolute -top-1 -right-1 min-w-3.5 h-3.5 px-0.5 rounded-[3px] flex items-center justify-center",
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
              onClick={() => jump(a.linkScreen)}
              className={cn(
                "w-full text-left px-3 py-2 border-b border-border/50 last:border-0 transition-colors feed-arrival",
                a.linkScreen ? "hover:bg-accent cursor-pointer" : "cursor-default"
              )}
              title={a.linkScreen ? `Open ${a.linkScreen} module — ${a.detail}` : a.detail}
            >
              <div className="flex items-center gap-1.5">
                <SeverityDot severity={a.severity} />
                <span className="text-[11px] font-medium text-foreground truncate flex-1 min-w-0">
                  {a.title}
                </span>
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
            onClick={() => markAlertsRead(feed.map((a) => a.id))}
            className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <CheckCheck className="size-3" /> Mark all read
          </button>
          <button
            type="button"
            onClick={() => {
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
