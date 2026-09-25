"use client";

/**
 * ⌘K Command Palette — Palantir-style operator console quick actions:
 * jump modules, pull up narratives/claims/influencers, switch filter banks.
 */
import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/lib/app-state";
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
  RotateCcw,
  FileDown,
  Send,
  Globe,
  Languages,
  Footprints,
  FlaskConical,
  GitCompareArrows,
  CalendarSearch,
  SlidersHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Platform, RangeKey, ScreenId } from "@/lib/mock/types";
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
 *  with "transactions…"). Prefix and whole-phrase matches rank higher.
 *
 *  v0.17: values carrying the `nl-intent` marker opt OUT of token scoring.
 *  Natural-language intent items derive their value from the live query
 *  (resolved topics, filter descriptions) — cmdk re-scores mid-keystroke
 *  against the PREVIOUSLY registered value, so a newly-typed token would
 *  score 0, unmount the item before its updated value re-registers, and
 *  dead-lock the group. Opt-out is safe because those groups only mount
 *  once the query itself parses as the intent — they can never leak into
 *  unrelated searches. */
const tokenFilter: (value: string, search: string) => number = (value, search) => {
  const v = value.toLowerCase();
  if (v.startsWith("nl-intent")) return 1;
  const q = search.toLowerCase().trim();
  if (!q) return 1;
  const tokens = q.split(/\s+/).filter(Boolean);
  if (!tokens.every((t) => v.includes(t))) return 0;
  let score = 1;
  if (v.includes(q)) score += 50; // whole phrase
  if (v.startsWith(tokens[0])) score += 100; // leading token
  return score;
};

/* ---- natural-language intents (v0.16 → v0.17) ----
   "compare gaganyaan vs neet" → resolve each side to a narrative
   (exact id/label first, then substring across id/label/gloss so
   romanized fragments keep working) and arm the global A/B pair.
   v0.17 adds "goto <module>", "filter <spec>…" (platform / range /
   language, composable) and "watch <topic>" operators. */
const COMPARE_RE = /^\s*compare\s+(.+?)\s+(?:vs\.?|versus)\s+(.+?)\s*$/i;
const GOTO_RE = /^\s*(?:go\s*to|goto|open|show)\s+(.+?)\s*$/i;
const FILTER_RE = /^\s*(?:filter|set|use)\s+(.+?)\s*$/i;
const WATCH_RE = /^\s*(?:watch|star|follow)\s+(.+?)\s*$/i;

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

/** Resolve a goto target to a module — matches id, label (substring) or code. */
const gotoModule = (q: string) => {
  const s = q.trim().toLowerCase();
  if (!s) return undefined;
  return (
    MODULES.find(
      (m) =>
        m.id === s ||
        m.label.toLowerCase().includes(s) ||
        m.code === s ||
        /* friendly aliases: "bots", "misinfo", "graph", "alerts"… */
        (s.length >= 3 && m.id.includes(s.replace(/\s+/g, "")))
    ) ?? (s === "graph" ? MODULES.find((m) => m.id === "network") : undefined)
  );
};

/** Parse a filter intent into concrete filter-bank writes. Composable:
   "filter x 30d", "filter telegram", "filter hindi last 14 days". */
interface FilterIntent {
  platform?: Platform;
  range?: RangeKey;
  customDays?: number;
  language?: string;
  describe: string[];
}
const parseFilterIntent = (q: string): FilterIntent | null => {
  const s = q.trim().toLowerCase();
  if (!s) return null;
  const intent: FilterIntent = { describe: [] };

  /* platform tokens */
  if (/\b(?:x|twitter|tweets?)\b/.test(s)) {
    intent.platform = "x";
    intent.describe.push("X only");
  } else if (/\b(?:telegram|tg)\b/.test(s)) {
    intent.platform = "telegram";
    intent.describe.push("Telegram only");
  } else if (/\b(?:all|both|everything)\b/.test(s)) {
    intent.platform = "all";
    intent.describe.push("all platforms");
  }

  /* range tokens */
  const lastDays = s.match(/last\s+(\d+)\s*days?/);
  if (/\b(?:24h|today|day)\b/.test(s)) {
    intent.range = "24h";
    intent.describe.push("24h window");
  } else if (/\b(?:7d|week)\b/.test(s)) {
    intent.range = "7d";
    intent.describe.push("7d window");
  } else if (/\b(?:30d|month)\b/.test(s)) {
    intent.range = "30d";
    intent.describe.push("30d window");
  } else if (lastDays) {
    const d = Math.min(90, Math.max(3, parseInt(lastDays[1], 10)));
    intent.range = "custom";
    intent.customDays = d;
    intent.describe.push(`${d}d window`);
  }

  /* language tokens — first named language wins */
  const LANG_ALIASES: Record<string, string> = {
    hindi: "hi",
    हिन्दी: "hi",
    english: "en",
    hinglish: "hinglish",
    tamil: "ta",
    தமிழ்: "ta",
    telugu: "te",
    తెలుగు: "te",
    bengali: "bn",
    bangla: "bn",
    বাংলা: "bn",
    marathi: "mr",
    मराठी: "mr",
  };
  for (const [alias, code] of Object.entries(LANG_ALIASES)) {
    if (new RegExp(`\\b${alias}\\b`).test(s)) {
      intent.language = code;
      intent.describe.push(`${LANGUAGES.find((l) => l.code === code)?.label ?? alias} filter`);
      break;
    }
  }

  return intent.describe.length ? intent : null;
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
    setRange,
    setCustomDays,
    toggleWatchlist,
    filters,
    watchlist,
    setReportOpen,
    setMethodologyOpen,
    compareIds,
    setComparePair,
    setCompareOpen,
    setDossierDay,
  } = useApp();

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

  /* v0.17 operator intents: goto / filter / watch */
  const nlGoto = useMemo(() => {
    const m = query.match(GOTO_RE);
    if (!m) return null;
    const mod = gotoModule(m[1]);
    return mod ? { mod } : null;
  }, [query]);

  const nlFilter = useMemo(() => {
    const m = query.match(FILTER_RE);
    if (!m) return null;
    const intent = parseFilterIntent(m[1]);
    return intent ? { intent, raw: m[1].trim() } : null;
  }, [query]);

  const nlWatch = useMemo(() => {
    const m = query.match(WATCH_RE);
    if (!m) return null;
    const t = sideTopic(m[1]);
    return t ? { t } : null;
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

  return (
    <>
      {/* Palette opens via the ⌘K hotkey (and the sidebar/cheatsheet hints) —
          the hotkey listener below owns it; no visible trigger needed. */}

      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="TraceX command palette"
        description="Jump to modules, narratives, claims and filter actions"
        className="sm:max-w-xl"
        filter={tokenFilter}
      >
        <CommandInput
          placeholder="Search, or try: “goto bots” · “filter x 30d” · “compare X vs Y” · “watch neet”…"
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

          {/* Natural-language operator intents (v0.17): "goto bots",
              "filter x 30d" (composable platform/range/language) and
              "watch neet" — the same NL gesture class as "compare X vs Y" */}
          {nlGoto && (
            <>
              <CommandGroup heading="Natural language — navigation">
                <CommandItem
                  value={`goto go to open show module ${nlGoto.mod.id} ${nlGoto.mod.label} ${nlGoto.mod.code} navigation`}
                  onSelect={() => {
                    go(nlGoto.mod.id);
                    setOpen(false);
                    toast(`Jumped to ${nlGoto.mod.label}`, {
                      description: "Natural-language navigation from the command palette.",
                    });
                  }}
                >
                  <nlGoto.mod.icon className="size-3.5 text-primary" />
                  <span className="truncate max-w-64">Go to {nlGoto.mod.label}</span>
                  <CommandShortcut className="font-mono text-[10px]">{nlGoto.mod.code}</CommandShortcut>
                </CommandItem>
              </CommandGroup>
              <CommandSeparator />
            </>
          )}

          {nlFilter && (
            <>
              <CommandGroup heading="Natural language — filter bank">
                <CommandItem
                  value={`filter set use platform range language intent ${nlFilter.raw} ${nlFilter.intent.describe.join(" ")} filters bank`}
                  onSelect={() => {
                    const { intent } = nlFilter;
                    if (intent.platform) setPlatform(intent.platform);
                    if (intent.range === "custom" && intent.customDays) {
                      setCustomDays(intent.customDays);
                    } else if (intent.range) {
                      setRange(intent.range);
                    }
                    if (intent.language) toggleLanguage(intent.language);
                    setOpen(false);
                    toast("Filter bank updated", {
                      description: intent.describe.join(" · ") + " — natural-language intent applied.",
                    });
                  }}
                >
                  <SlidersHorizontal className="size-3.5 text-primary" />
                  <span className="truncate max-w-64">Apply {nlFilter.intent.describe.join(" · ")}</span>
                  <span className="text-[10px] font-mono text-muted-foreground truncate hidden sm:inline">
                    “{nlFilter.raw}”
                  </span>
                  <CommandShortcut className="font-mono text-[10px]">FILTER</CommandShortcut>
                </CommandItem>
              </CommandGroup>
              <CommandSeparator />
            </>
          )}

          {nlWatch && (
            <>
              <CommandGroup heading="Natural language — watchlist">
                <CommandItem
                  value={`watch star follow ${nlWatch.t.id} ${nlWatch.t.label} ${nlWatch.t.gloss} watchlist`}
                  onSelect={() => {
                    toggleWatchlist(nlWatch.t.id);
                    setOpen(false);
                    toast(
                      watchlist.includes(nlWatch.t.id)
                        ? `Removed from watchlist: ${nlWatch.t.label}`
                        : `Watching: ${nlWatch.t.label}`,
                      {
                        description: "Natural-language watchlist intent from the command palette.",
                      }
                    );
                  }}
                >
                  <Star className={cn("size-3.5", watchlist.includes(nlWatch.t.id) ? "fill-primary text-primary" : "text-primary")} />
                  <span className="truncate max-w-64">
                    {watchlist.includes(nlWatch.t.id) ? "Unwatch" : "Watch"} {nlWatch.t.label}
                  </span>
                  <span className="text-[10px] font-mono text-muted-foreground tnum">
                    {fmtCompact(nlWatch.t.baseVolume * 1.75)}
                  </span>
                  <CommandShortcut className="font-mono text-[10px]">
                    {watchlist.includes(nlWatch.t.id) ? "UNWATCH" : "WATCH"}
                  </CommandShortcut>
                </CommandItem>
              </CommandGroup>
              <CommandSeparator />
            </>
          )}

          {/* A/B compare + matrix (v0.15 → v0.17): appears once two or more
              narratives are pinned — 2 pins open the A/B dossier, 3–6 the
              rank matrix; pins are global state, so this works from any screen */}
          {compareIds.length >= 2 && (
            <>
              <CommandGroup heading={compareIds.length >= 3 ? "Narrative compare — matrix" : "Narrative compare — pinned pair"}>
                <CommandItem
                  value={`compare ab matrix versus rank ${compareIds.join(" ")} ${compareIds.map(compareLabel).join(" ")} ${compareIds.map(compareGloss).join(" ")} pins`}
                  onSelect={() => {
                    go("trends");
                    setCompareOpen(true);
                    setOpen(false);
                  }}
                >
                  <GitCompareArrows className="size-3.5 text-primary" />
                  <span className="truncate max-w-64">
                    {compareIds.length >= 3
                      ? `Compare ${compareIds.length} narratives (rank matrix)`
                      : `Compare ${compareLabel(compareIds[0])} vs ${compareLabel(compareIds[1])}`}
                  </span>
                  <CommandShortcut className="font-mono text-[10px]">
                    {compareIds.length >= 3 ? "MATRIX" : "A/B"}
                  </CommandShortcut>
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
          </CommandGroup>
        </CommandList>

        <div className="border-t border-border px-3 py-1.5 flex items-center gap-3 text-[10px] font-mono text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <kbd className="inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-sm border border-border bg-muted/50 text-[9px]">↑↓</kbd>
            navigate
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-sm border border-border bg-muted/50 text-[9px]">↵</kbd>
            execute
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-sm border border-border bg-muted/50 text-[9px]">esc</kbd>
            close
          </span>
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
