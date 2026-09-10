"use client";

/**
 * ⌘K Command Palette — Palantir-style operator console quick actions:
 * jump modules, pull up narratives/claims/influencers, switch filter banks.
 */
import { useEffect, useState } from "react";
import { useApp } from "@/lib/app-state";
import { useTheme } from "next-themes";
import { TOPICS, getClaims, getInfluencers, LANGUAGES, NOW } from "@/lib/mock";
import { fmtCompact, relTime } from "@/lib/fmt";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import {
  LayoutDashboard,
  TrendingUp,
  HeartPulse,
  Users,
  Network,
  Bot,
  Radar,
  BellRing,
  Star,
  Flame,
  ShieldAlert,
  AtSign,
  Moon,
  SunMedium,
  RotateCcw,
  FileDown,
  Send,
  Globe,
  Languages,
  CornerDownLeft,
} from "lucide-react";
import { toast } from "sonner";
import type { ScreenId } from "@/lib/mock/types";

const MODULES: { id: ScreenId; code: string; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview", code: "01", label: "Overview — Intelligence Fusion", icon: LayoutDashboard },
  { id: "trends", code: "02", label: "Trend Explorer", icon: TrendingUp },
  { id: "sentiment", code: "03", label: "Sentiment & Emotion", icon: HeartPulse },
  { id: "demographics", code: "04", label: "Demographics", icon: Users },
  { id: "network", code: "05", label: "Network & Influence", icon: Network },
  { id: "bots", code: "06", label: "Bot Detection", icon: Bot },
  { id: "misinfo", code: "07", label: "Misinformation Radar", icon: Radar },
  { id: "alerts", code: "08", label: "Alerts & Reports", icon: BellRing },
];

const PLATFORM_META = {
  all: { label: "Filter: all platforms", icon: Globe },
  x: { label: "Filter: X only", icon: AtSign },
  telegram: { label: "Filter: Telegram only", icon: Send },
} as const;

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const { go, setSelectedTopicId, setPlatform, resetFilters, toggleLanguage, filters, watchlist } = useApp();
  const { resolvedTheme, setTheme } = useTheme();

  const claims = getClaims({ ...filters, query: "" });
  const influencers = getInfluencers(filters, 6);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const openNarrative = (id: string) => {
    setSelectedTopicId(id);
    go("trends", { topicId: id });
    setOpen(false);
  };

  return (
    <>
      {/* Trigger hint — lives in the top bar visual language */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden lg:inline-flex items-center gap-2 h-7 px-2.5 rounded-md border border-border bg-muted/40 text-[11px] text-muted-foreground hover:text-foreground hover:border-muted-foreground/40 transition-colors cursor-pointer"
        title="Open command palette"
      >
        <CornerDownLeft className="size-3" />
        <span className="font-mono">⌘K</span>
      </button>

      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="TraceX command palette"
        description="Jump to modules, narratives, claims and filter actions"
        className="sm:max-w-xl"
      >
        <CommandInput placeholder="Type a module, narrative, claim, handle or action…" />
        <CommandList className="max-h-[420px]">
          <CommandEmpty>No telemetry matches that query.</CommandEmpty>

          <CommandGroup heading="Modules">
            {MODULES.map((m) => (
              <CommandItem
                key={m.id}
                value={`${m.code} ${m.label}`}
                onSelect={() => {
                  go(m.id);
                  setOpen(false);
                }}
              >
                <m.icon className="size-3.5 text-muted-foreground" />
                <span>{m.label}</span>
                <CommandShortcut className="font-mono text-[10px]">{m.code}</CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Narratives">
            {TOPICS.map((t) => (
              <CommandItem key={t.id} value={`${t.id} ${t.label} ${t.gloss} ${t.category}`} onSelect={() => openNarrative(t.id)}>
                <Flame
                  className={
                    t.velocity === "surging"
                      ? "size-3.5 text-signal-orange"
                      : t.velocity === "rising"
                        ? "size-3.5 text-signal-green"
                        : "size-3.5 text-muted-foreground"
                  }
                />
                <span className="truncate max-w-56">{t.label}</span>
                <span className="text-[10px] text-muted-foreground truncate hidden sm:inline">{t.gloss}</span>
                {watchlist.includes(t.id) && <Star className="size-3 fill-primary text-primary shrink-0" />}
                <CommandShortcut className="font-mono text-[10px] tnum">
                  {fmtCompact(t.baseVolume * 1.75)}
                </CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Claims — misinformation radar">
            {claims.slice(0, 8).map((c) => (
              <CommandItem
                key={c.id}
                value={`${c.text} ${c.translation ?? ""} ${c.status} ${c.id}`}
                onSelect={() => {
                  go("misinfo", { claimId: c.id });
                  setOpen(false);
                  toast(`Dossier ${c.id} opened`, { description: c.text.slice(0, 90) + "…" });
                }}
              >
                <ShieldAlert
                  className={
                    c.risk >= 0.75
                      ? "size-3.5 text-signal-red"
                      : c.risk >= 0.45
                        ? "size-3.5 text-signal-amber"
                        : "size-3.5 text-signal-green"
                  }
                />
                <span className="truncate max-w-72">{c.text}</span>
                <CommandShortcut className="font-mono text-[10px]">
                  {c.id} · {c.status}
                </CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Influencers — network graph">
            {influencers.map((inf) => (
              <CommandItem
                key={inf.nodeId}
                value={`${inf.handle} ${inf.nodeId} ${inf.communityLabel}`}
                onSelect={() => {
                  go("network");
                  setOpen(false);
                }}
              >
                <AtSign className="size-3.5 text-muted-foreground" />
                <span className="font-mono text-xs truncate">{inf.handle}</span>
                <span className="text-[10px] text-muted-foreground truncate hidden sm:inline">
                  {inf.communityLabel}
                </span>
                <CommandShortcut className="font-mono text-[10px] tnum">
                  PR {inf.pageRank.toFixed(3)}
                </CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Filter bank &amp; actions">
            {(Object.keys(PLATFORM_META) as (keyof typeof PLATFORM_META)[]).map((p) => {
              const meta = PLATFORM_META[p];
              return (
                <CommandItem
                  key={p}
                  value={`platform ${p}`}
                  onSelect={() => {
                    setPlatform(p);
                    setOpen(false);
                    toast(`Filter bank set: ${meta.label}`);
                  }}
                >
                  <meta.icon className="size-3.5 text-muted-foreground" />
                  <span>{meta.label}</span>
                  {filters.platform === p && <CommandShortcut>active</CommandShortcut>}
                </CommandItem>
              );
            })}
            <CommandItem
              value="language hinglish toggle"
              onSelect={() => {
                toggleLanguage("hinglish");
                setOpen(false);
              }}
            >
              <Languages className="size-3.5 text-muted-foreground" />
              <span>Toggle Hinglish language filter</span>
              {filters.languages.includes("hinglish") && <CommandShortcut>active</CommandShortcut>}
            </CommandItem>
            {LANGUAGES.filter((l) => l.code !== "hinglish").slice(0, 2).map((l) => (
              <CommandItem
                key={l.code}
                value={`language ${l.label} toggle`}
                onSelect={() => {
                  toggleLanguage(l.code);
                  setOpen(false);
                }}
              >
                <Languages className="size-3.5 text-muted-foreground" />
                <span>Toggle {l.label} ({l.native}) filter</span>
                {filters.languages.includes(l.code) && <CommandShortcut>active</CommandShortcut>}
              </CommandItem>
            ))}
            <CommandItem
              value="reset filters clear"
              onSelect={() => {
                resetFilters();
                setOpen(false);
                toast("Filter bank reset");
              }}
            >
              <RotateCcw className="size-3.5 text-muted-foreground" />
              <span>Reset entire filter bank</span>
            </CommandItem>
            <CommandItem
              value="generate report export"
              onSelect={() => {
                go("alerts");
                setOpen(false);
                toast("Report module open — use Generate report", { description: "Alerts & Reports → Analyst reports" });
              }}
            >
              <FileDown className="size-3.5 text-muted-foreground" />
              <span>Generate intelligence report</span>
            </CommandItem>
            <CommandItem
              value="toggle theme dark light"
              onSelect={() => {
                setTheme(resolvedTheme === "light" ? "dark" : "light");
                setOpen(false);
              }}
            >
              {resolvedTheme === "light" ? (
                <Moon className="size-3.5 text-muted-foreground" />
              ) : (
                <SunMedium className="size-3.5 text-muted-foreground" />
              )}
              <span>Toggle console illumination</span>
            </CommandItem>
          </CommandGroup>
        </CommandList>

        <div className="border-t border-border px-3 py-1.5 flex items-center gap-3 text-[10px] font-mono text-muted-foreground">
          <span>↑↓ navigate</span>
          <span>↵ execute</span>
          <span>esc close</span>
          <span className="ml-auto flex items-center gap-1">
            <Star className="size-2.5 text-primary" />
            {watchlist.length} watched
          </span>
          <span className="flex items-center gap-1">
            <Radar className="size-2.5 text-signal-green" />
            live {relTime(NOW)} ago
          </span>
        </div>
      </CommandDialog>
    </>
  );
}
