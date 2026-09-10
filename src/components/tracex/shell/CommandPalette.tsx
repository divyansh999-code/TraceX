"use client";

/**
 * ⌘K Command Palette — Palantir-style operator console quick actions:
 * jump modules, pull up narratives/claims/influencers, switch filter banks.
 */
import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/lib/app-state";
import { useTheme } from "next-themes";
import { TOPICS, getClaims, getInfluencers, getVolumeSeries, LANGUAGES, NOW } from "@/lib/mock";
import { fmtCompact, fmtDayIST, relTime } from "@/lib/fmt";
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
  Bookmark,
  Footprints,
  FlaskConical,
  GitCompareArrows,
  CalendarSearch,
} from "lucide-react";
import { toast } from "sonner";
import type { ScreenId } from "@/lib/mock/types";
import { startGuidedTour } from "./GuidedTour";

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

/* bare ids + glosses keep romanized search working for the compare entry */
const compareLabel = (id: string) => TOPICS.find((t) => t.id === id)?.label ?? id;
const compareGloss = (id: string) => TOPICS.find((t) => t.id === id)?.gloss ?? "";

const PLATFORM_META = {
  all: { label: "Filter: all platforms", icon: Globe },
  x: { label: "Filter: X only", icon: AtSign },
  telegram: { label: "Filter: Telegram only", icon: Send },
} as const;

/** Strict token-based palette filter (v0.13): every whitespace-separated
 *  query token must occur as a substring of the item value — no more
 *  loose fuzzy matches (searching "tour" used to highlight a narrative
 *  with "transactions…"). Prefix and whole-phrase matches rank higher. */
const tokenFilter: (value: string, search: string) => number = (value, search) => {
  const v = value.toLowerCase();
  const q = search.toLowerCase().trim();
  if (!q) return 1;
  const tokens = q.split(/\s+/).filter(Boolean);
  if (!tokens.every((t) => v.includes(t))) return 0;
  let score = 1;
  if (v.includes(q)) score += 50; // whole phrase
  if (v.startsWith(tokens[0])) score += 100; // leading token
  return score;
};

/* ---- natural-language compare intent (v0.16) ----
   "compare gaganyaan vs neet" → resolve each side to a narrative
   (exact id/label first, then substring across id/label/gloss so
   romanized fragments keep working) and arm the global A/B pair. */
const COMPARE_RE = /^\s*compare\s+(.+?)\s+(?:vs\.?|versus)\s+(.+?)\s*$/i;

const sideTopic = (q: string) => {
  const s = q.trim().toLowerCase();
  if (!s) return undefined;
  return (
    TOPICS.find((t) => t.id.toLowerCase() === s || t.label.toLowerCase() === s) ??
    TOPICS.find(
      (t) =>
        t.id.toLowerCase().includes(s) ||
        t.label.toLowerCase().includes(s) ||
        t.gloss.toLowerCase().includes(s)
    )
  );
};

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  /* live query feed (v0.16) — cmdk's onValueChange drives the
     natural-language compare intent below */
  const [query, setQuery] = useState("");
  const {
    go,
    setSelectedTopicId,
    setPlatform,
    resetFilters,
    toggleLanguage,
    filters,
    watchlist,
    setReportOpen,
    setMethodologyOpen,
    savedViews,
    applyView,
    isViewActive,
    compareIds,
    setComparePair,
    setCompareOpen,
    setDossierDay,
  } = useApp();
  const { resolvedTheme, setTheme } = useTheme();

  const claims = getClaims({ ...filters, query: "" });
  const influencers = getInfluencers(filters, 6);

  /* latest 30d spike day (falls back to the most recent day when the
     window is quiet) — the palette's day-dossier summon target */
  const dossierTarget = useMemo(() => {
    const days = getVolumeSeries({ ...filters, range: "30d" });
    const spike = [...days].reverse().find((d) => d.spike);
    return spike ?? days[days.length - 1];
  }, [filters]);

  const nlCompare = useMemo(() => {
    const m = query.match(COMPARE_RE);
    if (!m) return null;
    const a = sideTopic(m[1]);
    const b = sideTopic(m[2]);
    if (!a || !b || a.id === b.id) return null;
    return { a, b };
  }, [query]);

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

  const applySavedView = (id: string, name: string) => {
    applyView(id);
    setOpen(false);
    toast(`View “${name}” applied`, { description: "Filter bank restored from saved view." });
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
        filter={tokenFilter}
      >
        <CommandInput
          placeholder="Type a module, narrative, claim, handle — or “compare X vs Y”…"
          onValueChange={setQuery}
        />
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

          {/* Natural-language compare (v0.16): "compare gaganyaan vs neet"
              resolves both sides and arms the global A/B pair — the item's
              value embeds the resolved ids/labels/glosses so the strict
              token filter keeps it ranked at the top */}
          {nlCompare && (
            <>
              <CommandGroup heading="Narrative A/B — natural language">
                <CommandItem
                  value={`compare ${nlCompare.a.id} vs ${nlCompare.b.id} ${nlCompare.a.label} ${nlCompare.b.label} ${nlCompare.a.gloss} ${nlCompare.b.gloss} versus ab pins`}
                  onSelect={() => {
                    setComparePair(nlCompare.a.id, nlCompare.b.id);
                    go("trends");
                    setCompareOpen(true);
                    setOpen(false);
                    toast(`A/B armed: ${nlCompare.a.label} vs ${nlCompare.b.label}`, {
                      description: "Pinned from the command palette — compare console opening.",
                    });
                  }}
                >
                  <GitCompareArrows className="size-3.5 text-primary" />
                  <span className="truncate max-w-64">
                    Compare {nlCompare.a.label} vs {nlCompare.b.label}
                  </span>
                  <CommandShortcut className="font-mono text-[10px]">A/B</CommandShortcut>
                </CommandItem>
              </CommandGroup>
              <CommandSeparator />
            </>
          )}

          {/* A/B compare (v0.15): appears once two narratives are pinned —
              pins are global state, so this works from any screen */}
          {compareIds.length === 2 && (
            <>
              <CommandGroup heading="Narrative A/B — pinned pair">
                <CommandItem
                  value={`compare ab versus ${compareIds.join(" ")} ${compareLabel(compareIds[0])} ${compareLabel(compareIds[1])} ${compareGloss(compareIds[0])} ${compareGloss(compareIds[1])} pins`}
                  onSelect={() => {
                    go("trends");
                    setCompareOpen(true);
                    setOpen(false);
                  }}
                >
                  <GitCompareArrows className="size-3.5 text-primary" />
                  <span className="truncate max-w-64">
                    Compare {compareLabel(compareIds[0])} vs {compareLabel(compareIds[1])}
                  </span>
                  <CommandShortcut className="font-mono text-[10px]">A/B</CommandShortcut>
                </CommandItem>
              </CommandGroup>
              <CommandSeparator />
            </>
          )}

          {/* Day-level intelligence (v0.16): summon the decomposed day
              dossier for the window's latest spike — same dialog the
              temporal replay and the shareable day links open */}
          {dossierTarget && (
            <>
              <CommandGroup heading="Day-level intelligence">
                <CommandItem
                  value={`day dossier ${dossierTarget.spike ? "spike" : "calendar"} heat inspect decompose anomaly ${dossierTarget.label}`}
                  onSelect={() => {
                    go("overview");
                    setDossierDay(dossierTarget.t);
                    setOpen(false);
                  }}
                >
                  <CalendarSearch className="size-3.5 text-primary" />
                  <span>Day dossier — {dossierTarget.spike ? "latest spike day" : "latest day"}</span>
                  <span className="text-[10px] font-mono text-muted-foreground truncate hidden sm:inline">
                    {fmtDayIST(dossierTarget.t)}
                  </span>
                  <CommandShortcut className="font-mono text-[10px]">
                    {dossierTarget.spike ? "SPIKE" : "30D"}
                  </CommandShortcut>
                </CommandItem>
              </CommandGroup>
              <CommandSeparator />
            </>
          )}

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

          {savedViews.length > 0 && (
            <>
              <CommandGroup heading="Saved views — filter-bank presets">
                {savedViews.map((v) => (
                  <CommandItem
                    key={v.id}
                    value={`view ${v.name} ${v.filters.platform} ${v.filters.range}${v.screen ? ` ${v.screen}` : ""}`}
                    onSelect={() => applySavedView(v.id, v.name)}
                  >
                    <Bookmark className={isViewActive(v) ? "size-3.5 fill-primary text-primary" : "size-3.5 text-muted-foreground"} />
                    <span className="truncate max-w-48">{v.name}</span>
                    <span className="text-[10px] font-mono text-muted-foreground truncate hidden sm:inline">
                      {v.filters.platform.toUpperCase()} ·{" "}
                      {v.filters.range === "custom" ? `${v.filters.customDays}D` : v.filters.range.toUpperCase()}
                      {v.screen ? ` · ${v.screen}` : ""}
                    </span>
                    {isViewActive(v) && <CommandShortcut>active</CommandShortcut>}
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
            </>
          )}

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
                setReportOpen(true);
                setOpen(false);
              }}
            >
              <FileDown className="size-3.5 text-muted-foreground" />
              <span>Generate intelligence report</span>
            </CommandItem>
            <CommandItem
              value="tour replay guided walkthrough onboarding start"
              onSelect={() => {
                setOpen(false);
                startGuidedTour();
              }}
            >
              <Footprints className="size-3.5 text-muted-foreground" />
              <span>Replay the guided console tour</span>
            </CommandItem>
            <CommandItem
              value="methodology data provenance privacy scoring how it works"
              onSelect={() => {
                setMethodologyOpen(true);
                setOpen(false);
              }}
            >
              <FlaskConical className="size-3.5 text-muted-foreground" />
              <span>Methodology &amp; data provenance</span>
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
