"use client";

/**
 * Keyboard shortcut cheatsheet — press "?" anywhere (outside inputs).
 * Trigger button surfaces in the status bar for discoverability.
 */
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Kbd, type Hotkey } from "../common/Kbd";
import { useApp } from "@/lib/app-state";
import { startGuidedTour } from "./GuidedTour";
import { Footprints, FlaskConical } from "lucide-react";

const SHORTCUTS: { group: string; items: Hotkey[] }[] = [
  {
    group: "Console",
    items: [
      { keys: ["⌘", "K"], label: "Command palette — modules, narratives, claims, filters", held: "⌘/Ctrl + K" },
      { keys: ["?"], label: "This shortcut cheatsheet" },
      { keys: ["Esc"], label: "Close dialogs, sheets and the palette" },
    ],
  },
  {
    group: "Module switching",
    items: [
      { keys: ["1"], label: "01 · Overview — Intelligence Fusion" },
      { keys: ["2"], label: "02 · Trend Explorer" },
      { keys: ["3"], label: "03 · Sentiment & Emotion" },
      { keys: ["4"], label: "04 · Demographics" },
      { keys: ["5"], label: "05 · Network & Influence" },
      { keys: ["6"], label: "06 · Information Integrity — bots + misinformation" },
      { keys: ["7"], label: "07 · Alerts & Reports" },
    ],
  },
  {
    group: "Analyst gestures",
    items: [
      { keys: ["★"], label: "Star a narrative in the trends table to pin it to the watchlist" },
      { keys: ["↵"], label: "Execute the highlighted palette entry" },
      { keys: ["↑", "↓"], label: "Move through palette results" },
      { keys: ["←", "→"], label: "Browser Back / Forward — walk console history" },
      { keys: ["←", "→"], label: "Walk heat-calendar days once a cell is focused (Home/End jump to window edges)" },
      { keys: ["Tab"], label: "Focus the heat calendar, then Enter to open the day dossier (Overview) or pivot trends" },
      { keys: ["A/B"], label: "Pin 2–6 narratives in the trends table, then compare — 2 opens the A/B dossier, 3+ the rank matrix" },
      { keys: ["▶"], label: "Overview temporal replay — scrub 30 days of corpus, KPIs and trends rewind with it" },
      { keys: ["⏎"], label: "While scrubbing — summon the day dossier for the playhead's calendar day" },
      { keys: ["⌘K"], label: "Type “compare <narrative> vs <narrative>” in the palette to arm the A/B pair" },
      { keys: ["⌘K"], label: "Natural-language operators: “goto <module>”, “filter x 30d”, “watch <narrative>”" },
    ],
  },
];

export function HotkeyHelp() {
  const [open, setOpen] = useState(false);
  const { setMethodologyOpen } = useApp();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if (e.key === "?" || (e.key === "/" && e.shiftKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-mono text-sm tracking-tight">Console shortcuts</DialogTitle>
          <DialogDescription className="text-xs">
            Operator ergonomics — the whole console is reachable without the mouse.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          {SHORTCUTS.map((section) => (
            <div key={section.group}>
              <div className="taxonomy text-muted-foreground/70 mb-1.5">{section.group}</div>
              <div className="space-y-1">
                {section.items.map((h) => (
                  <Kbd key={h.label} hotkey={h} />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* relaunchers — tour + methodology briefing */}
        <div className="border-t border-border pt-3 mt-1 flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-[11px] gap-1.5"
            onClick={() => {
              setOpen(false);
              startGuidedTour();
            }}
          >
            <Footprints className="size-3" /> Replay guided tour
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-[11px] gap-1.5"
            onClick={() => {
              setOpen(false);
              setMethodologyOpen(true);
            }}
          >
            <FlaskConical className="size-3" /> Methodology
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
