"use client";

/**
 * Global console state: filter bank + navigation bus.
 * Every screen reads filters from here; the shell writes to it.
 *
 * v0.10 additions:
 * - Session persistence to localStorage (watchlist + filters + position).
 * - URL hash deep-links: `#/trends`, `#/trends/kisan-andolan`,
 *   `#/misinfo/claim:CLM-004` — shareable, survives refresh.
 * - `selectedClaimId` so the command palette can open a claim dossier.
 *
 * v0.11 additions:
 * - History-aware navigation: go() pushes history entries, so browser
 *   Back/Forward moves between console screens (popstate listener restores
 *   state from the hash instead of leaving the app).
 * - `reportOpen` — the intelligence report modal is now global state, so the
 *   ⌘K palette (and any screen) can open it directly.
 *
 * v0.12 additions:
 * - Saved views: named filter-bank presets, persisted + palette-reachable.
 * - Analyst annotations: per-claim notebook entries, persisted.
 * - Live alert bus: a shell-level feed singleton pushes fresh alerts here,
 *   so the bell badge, the document title and the Overview feed share one
 *   source and the critical-audio cue fires on every screen.
 *
 * v0.13 additions:
 * - `methodologyOpen` — the provenance briefing dialog, global like the
 *   report modal (palette / cheatsheet / status bar can open it).
 *
 * v0.14 additions:
 * - Briefing archive: generated reports persist (localStorage) and can
 *   be reopened from the Alerts module — the report workflow is now a
 *   loop rather than a one-shot modal.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import type { Filters, IntelligenceAlert, Platform, RangeKey, ScreenId } from "./mock/types";
import { getAlerts } from "./mock";
import { subscribeLiveAlerts, startLiveFeed } from "./live-feed";

interface SavedView {
  id: string;
  name: string;
  filters: Filters;
  screen?: ScreenId;
  savedAt: number;
}

interface ClaimNote {
  text: string;
  updatedAt: number;
}

/** An archived intelligence briefing (v0.14). Icon keys map back to
 *  lucide icons in the archive renderer — snapshots stay JSON-safe. */
export interface ArchivedReport {
  id: string;
  docId: string;
  createdAt: number;
  windowLabel: string;
  platformLabel: string;
  postsTracked: number;
  netSentiment: number;
  botShare: number;
  findings: { iconKey: "trend" | "claim" | "bot" | "sentiment"; label: string; value: string; tone: string }[];
}

interface AppState {
  filters: Filters;
  setPlatform: (p: Platform) => void;
  setRange: (r: RangeKey) => void;
  setCustomDays: (d: number) => void;
  toggleLanguage: (code: string) => void;
  clearLanguages: () => void;
  setQuery: (q: string) => void;
  resetFilters: () => void;

  screen: ScreenId;
  go: (screen: ScreenId, opts?: { topicId?: string; claimId?: string }) => void;
  selectedTopicId: string | null;
  setSelectedTopicId: (id: string | null) => void;
  selectedClaimId: string | null;
  setSelectedClaimId: (id: string | null) => void;

  /** Global intelligence-report modal (mounted at shell level). */
  reportOpen: boolean;
  setReportOpen: (open: boolean) => void;

  /** Global methodology / provenance briefing (mounted at shell level). */
  methodologyOpen: boolean;
  setMethodologyOpen: (open: boolean) => void;

  /** Briefing archive — generated reports, persisted (v0.14). */
  reports: ArchivedReport[];
  archiveReport: (report: Omit<ArchivedReport, "id" | "createdAt">) => string;
  deleteReport: (id: string) => void;

  /** Starred narratives — persisted across sessions. */
  watchlist: string[];
  toggleWatchlist: (topicId: string) => void;
  isWatched: (topicId: string) => boolean;

  /** Saved filter-bank presets — persisted across sessions. */
  savedViews: SavedView[];
  saveView: (name: string, screen?: ScreenId) => string;
  applyView: (id: string) => void;
  deleteView: (id: string) => void;
  isViewActive: (view: SavedView) => boolean;

  /** Narrative A/B compare pins (v0.15, lifted from TrendsScreen local
   *  state so the ⌘K palette can reach them) — max two, persisted. */
  compareIds: string[];
  toggleComparePin: (topicId: string) => "pinned" | "unpinned" | "full";
  clearCompare: () => void;
  /** The A/B compare dialog (global, like the report modal). */
  compareOpen: boolean;
  setCompareOpen: (open: boolean) => void;

  /** Analyst notebook — per-claim notes, persisted across sessions. */
  claimNotes: Record<string, ClaimNote>;
  setClaimNote: (claimId: string, text: string) => void;

  /** Live alert bus — merged base + arriving alerts, shared by the bell,
   *  the Overview feed and the document-title unread count. */
  alertsFeed: IntelligenceAlert[];
  alertUnread: number;
  markAlertsRead: (ids: string[]) => void;

  /** Bumped whenever filters change — screens use it as skeleton key. */
  refreshKey: number;
}

const AppContext = createContext<AppState | null>(null);

const DEFAULT_FILTERS: Filters = {
  platform: "all",
  range: "7d",
  customDays: 14,
  languages: [],
  query: "",
};

const DEFAULT_WATCHLIST = ["kisan-andolan", "isro-mission"];

const SCREEN_IDS: ScreenId[] = [
  "overview",
  "trends",
  "sentiment",
  "demographics",
  "network",
  "bots",
  "misinfo",
  "alerts",
];

const STORE_KEY = "tracex.console.v1";

/* ---------------- persistence helpers ---------------- */

interface PersistedSnapshot {
  filters: Filters;
  watchlist: string[];
  savedViews?: SavedView[];
  claimNotes?: Record<string, ClaimNote>;
  reports?: ArchivedReport[];
  compareIds?: string[];
}

const VALID_SCREENS = new Set<string>(SCREEN_IDS);

function loadPersisted(): PersistedSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<PersistedSnapshot>;
    const filters = { ...DEFAULT_FILTERS, ...(data.filters ?? {}) };
    // validate enums so a corrupt store can't poison the console
    if (!["all", "x", "telegram"].includes(filters.platform)) filters.platform = "all";
    if (!["24h", "7d", "30d", "custom"].includes(filters.range)) filters.range = "7d";
    if (!Number.isFinite(filters.customDays)) filters.customDays = 14;
    if (!Array.isArray(filters.languages)) filters.languages = [];
    if (typeof filters.query !== "string") filters.query = "";
    const watchlist = Array.isArray(data.watchlist)
      ? data.watchlist.filter((w): w is string => typeof w === "string")
      : DEFAULT_WATCHLIST;
    const savedViews = Array.isArray(data.savedViews)
      ? data.savedViews.filter(
          (v): v is SavedView =>
            !!v &&
            typeof v.id === "string" &&
            typeof v.name === "string" &&
            !!v.filters &&
            typeof v.filters === "object"
        )
      : [];
    const claimNotes: Record<string, ClaimNote> = {};
    if (data.claimNotes && typeof data.claimNotes === "object") {
      for (const [k, v] of Object.entries(data.claimNotes)) {
        if (typeof k === "string" && v && typeof (v as ClaimNote).text === "string") {
          claimNotes[k] = {
            text: (v as ClaimNote).text.slice(0, 2_000),
            updatedAt: Number.isFinite((v as ClaimNote).updatedAt) ? (v as ClaimNote).updatedAt : Date.now(),
          };
        }
      }
    }
    const reports = Array.isArray(data.reports)
      ? data.reports.filter(
          (r): r is ArchivedReport =>
            !!r &&
            typeof r.id === "string" &&
            typeof r.docId === "string" &&
            Number.isFinite(r.createdAt) &&
            Array.isArray(r.findings) &&
            r.findings.every((f) => f && typeof f.label === "string" && typeof f.value === "string")
        )
      : [];
    const compareIds = Array.isArray(data.compareIds)
      ? data.compareIds.filter((c): c is string => typeof c === "string").slice(0, 2)
      : [];
    return { filters, watchlist, savedViews, claimNotes, reports, compareIds };
  } catch {
    return null;
  }
}

interface HashTarget {
  screen: ScreenId;
  topicId?: string;
  claimId?: string;
}

function parseHash(): HashTarget | null {
  if (typeof window === "undefined") return null;
  const h = window.location.hash;
  if (!h.startsWith("#/")) return null;
  const parts = h.slice(2).split("/").filter(Boolean);
  const screen = SCREEN_IDS.find((s) => s === parts[0]);
  if (!screen) return null;
  const rest = parts.slice(1);
  const claimPart = rest.find((p) => p.startsWith("claim:"));
  const topicPart = rest.find((p) => !p.startsWith("claim:"));
  return {
    screen,
    topicId: topicPart || undefined,
    claimId: claimPart ? claimPart.slice("claim:".length) : undefined,
  };
}

/** Resolve initial state once, client-side (the boot splash gates first paint
 *  so restored state never fights SSR HTML). */
const INITIAL = (() => {
  if (typeof window === "undefined") {
    return {
      filters: DEFAULT_FILTERS,
      watchlist: DEFAULT_WATCHLIST,
      savedViews: [] as SavedView[],
      claimNotes: {} as Record<string, ClaimNote>,
      reports: [] as ArchivedReport[],
      compareIds: [] as string[],
      screen: "overview" as ScreenId,
      topicId: null as string | null,
      claimId: null as string | null,
    };
  }
  const persisted = loadPersisted();
  const hash = parseHash();
  return {
    filters: persisted?.filters ?? DEFAULT_FILTERS,
    watchlist: persisted?.watchlist ?? DEFAULT_WATCHLIST,
    savedViews: persisted?.savedViews ?? [],
    claimNotes: persisted?.claimNotes ?? {},
    reports: persisted?.reports ?? [],
    compareIds: persisted?.compareIds ?? [],
    screen: hash?.screen ?? "overview",
    topicId: (hash?.topicId ?? null) as string | null,
    claimId: (hash?.claimId ?? null) as string | null,
  };
})();

/** Alerts that warrant an unread badge — critical/high and still New. */
function isHotAlert(a: IntelligenceAlert): boolean {
  return a.status === "New" && (a.severity === "critical" || a.severity === "high");
}

const FEED_MAX = 10;

export function AppProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<Filters>(INITIAL.filters);
  const [screen, setScreen] = useState<ScreenId>(INITIAL.screen);
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(INITIAL.topicId);
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(INITIAL.claimId);
  const [watchlist, setWatchlist] = useState<string[]>(INITIAL.watchlist);
  const [savedViews, setSavedViews] = useState<SavedView[]>(INITIAL.savedViews);
  const [claimNotes, setClaimNotes] = useState<Record<string, ClaimNote>>(INITIAL.claimNotes);
  const [reports, setReports] = useState<ArchivedReport[]>(INITIAL.reports);
  const [compareIds, setCompareIds] = useState<string[]>(INITIAL.compareIds);
  const [compareOpen, setCompareOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [methodologyOpen, setMethodologyOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  /* live alert bus (v0.12): arriving alerts live here so the bell, the
     Overview feed and the tab-title unread count all share one source. */
  const [liveAlerts, setLiveAlerts] = useState<IntelligenceAlert[]>([]);
  const [alertReadIds, setAlertReadIds] = useState<Set<string>>(() => new Set());

  const bump = useCallback(() => setRefreshKey((k) => k + 1), []);

  /* ---- live feed singleton: starts once at the shell level; every
     arrival (a) fires the critical-audio cue (see lib/alert-cue) and
     (b) lands in the shared feed state below. setState runs inside the
     event callback, never inside an effect body. ---- */
  useEffect(() => {
    const stop = startLiveFeed();
    const unsubscribe = subscribeLiveAlerts((a) => {
      setLiveAlerts((prev) => [a, ...prev].slice(0, FEED_MAX));
    });
    return () => {
      unsubscribe();
      stop();
    };
  }, []);

  /* Persist snapshot + mirror navigation into the URL hash.
   *
   * History strategy (v0.11): the first write normalises the URL silently
   * (replaceState); every later in-app navigation PUSHES a history entry,
   * which is what makes browser Back/Forward walk through console screens.
   * popstate-driven updates converge on a hash that already matches the
   * restored state, so the effect never re-pushes for those.
   * (Effect only WRITES — never setState — so it stays lint-clean.) */
  const firstHashWriteRef = useRef(true);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const parts: string[] = [screen];
    if (selectedTopicId) parts.push(selectedTopicId);
    if (screen === "misinfo" && selectedClaimId) parts.push(`claim:${selectedClaimId}`);
    const nextHash = `#/${parts.join("/")}`;
    if (window.location.hash !== nextHash) {
      if (firstHashWriteRef.current) {
        window.history.replaceState(null, "", nextHash);
      } else {
        window.history.pushState(null, "", nextHash);
      }
    }
    firstHashWriteRef.current = false;
    try {
      const snap: PersistedSnapshot = { filters, watchlist, savedViews, claimNotes, reports, compareIds };
      window.localStorage.setItem(STORE_KEY, JSON.stringify(snap));
    } catch {
      /* private mode / quota — persistence is best-effort */
    }
  }, [screen, selectedTopicId, selectedClaimId, filters, watchlist, savedViews, claimNotes, reports, compareIds]);

  /* Browser Back/Forward + manual hash edits: restore console state from
   * the target hash. setState lives in the event handler (not an effect),
   * and a bare/foreign hash is normalised to #/overview BEFORE setState so
   * the write-effect above sees a matching hash and never re-pushes. */
  useEffect(() => {
    const onPopState = () => {
      const target = parseHash();
      if (!target) {
        window.history.replaceState(null, "", "#/overview");
        setScreen("overview");
        setSelectedTopicId(null);
        setSelectedClaimId(null);
      } else {
        setScreen(target.screen);
        setSelectedTopicId(target.topicId ?? null);
        setSelectedClaimId(target.claimId ?? null);
      }
      window.scrollTo({ top: 0 });
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const setPlatform = useCallback(
    (p: Platform) => {
      setFilters((f) => (f.platform === p ? f : { ...f, platform: p }));
      bump();
    },
    [bump]
  );

  const setRange = useCallback(
    (r: RangeKey) => {
      setFilters((f) => ({ ...f, range: r }));
      bump();
    },
    [bump]
  );

  const setCustomDays = useCallback(
    (d: number) => {
      setFilters((f) => ({ ...f, customDays: d, range: "custom" }));
      bump();
    },
    [bump]
  );

  const toggleLanguage = useCallback(
    (code: string) => {
      setFilters((f) => ({
        ...f,
        languages: f.languages.includes(code)
          ? f.languages.filter((c) => c !== code)
          : [...f.languages, code],
      }));
      bump();
    },
    [bump]
  );

  const clearLanguages = useCallback(() => {
    setFilters((f) => ({ ...f, languages: [] }));
    bump();
  }, [bump]);

  const setQuery = useCallback((q: string) => {
    setFilters((f) => ({ ...f, query: q }));
    bump();
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    bump();
  }, [bump]);

  const go = useCallback((s: ScreenId, opts?: { topicId?: string; claimId?: string }) => {
    setScreen(s);
    if (opts?.topicId !== undefined) setSelectedTopicId(opts.topicId);
    if (opts?.claimId !== undefined) setSelectedClaimId(opts.claimId);
    window.scrollTo({ top: 0 });
  }, []);

  const toggleWatchlist = useCallback((topicId: string) => {
    setWatchlist((w) => (w.includes(topicId) ? w.filter((t) => t !== topicId) : [...w, topicId]));
  }, []);

  /* ---- narrative A/B compare pins (v0.15) ----
     Result code lets callers surface the right toast; the functional
     updater keeps state correct even if two pins land in one event task. */
  const toggleComparePin = useCallback(
    (topicId: string): "pinned" | "unpinned" | "full" => {
      if (compareIds.includes(topicId)) {
        setCompareIds(compareIds.filter((x) => x !== topicId));
        return "unpinned";
      }
      if (compareIds.length >= 2) return "full";
      setCompareIds((prev) => (prev.includes(topicId) || prev.length >= 2 ? prev : [...prev, topicId]));
      return "pinned";
    },
    [compareIds]
  );

  const clearCompare = useCallback(() => setCompareIds([]), []);

  /* ---- saved views ---- */
  const saveView = useCallback(
    (name: string, viewScreen?: ScreenId) => {
      const trimmed = name.trim().slice(0, 40) || `VIEW-${new Date().toISOString().slice(11, 19)}`;
      const id = `view-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      const view: SavedView = {
        id,
        name: trimmed,
        /* snapshot the current bank — event handlers always see fresh state
           through this closure (filters is a dependency below) */
        filters,
        screen: viewScreen && VALID_SCREENS.has(viewScreen) ? viewScreen : undefined,
        savedAt: Date.now(),
      };
      setSavedViews((prev) => [...prev.slice(0, 11), view]);
      return id;
    },
    [filters]
  );

  const applyView = useCallback(
    (id: string) => {
      const view = savedViews.find((v) => v.id === id);
      if (!view?.filters) return;
      /* apply through the same validation-safe spread the loader uses */
      setFilters({ ...DEFAULT_FILTERS, ...view.filters });
      bump();
      if (view.screen) setScreen(view.screen);
    },
    [savedViews, bump]
  );

  const deleteView = useCallback((id: string) => {
    setSavedViews((views) => views.filter((v) => v.id !== id));
  }, []);

  const isViewActive = useCallback(
    (view: SavedView) => {
      const f = view.filters;
      return (
        !!f &&
        f.platform === filters.platform &&
        f.range === filters.range &&
        f.customDays === filters.customDays &&
        f.query === filters.query &&
        f.languages.length === filters.languages.length &&
        f.languages.every((c) => filters.languages.includes(c))
      );
    },
    [filters]
  );

  /* ---- analyst annotations ---- */
  const setClaimNote = useCallback((claimId: string, text: string) => {
    setClaimNotes((notes) => {
      const trimmed = text.slice(0, 2_000);
      if (!trimmed.trim()) {
        const { [claimId]: _drop, ...rest } = notes;
        return rest;
      }
      return { ...notes, [claimId]: { text: trimmed, updatedAt: Date.now() } };
    });
  }, []);

  /* ---- briefing archive (v0.14) ---- */
  const archiveReport = useCallback((report: Omit<ArchivedReport, "id" | "createdAt">) => {
    const id = `rpt-${Date.now().toString(36)}`;
    const full: ArchivedReport = { ...report, id, createdAt: Date.now() };
    setReports((prev) => [full, ...prev].slice(0, 12));
    return id;
  }, []);

  const deleteReport = useCallback((id: string) => {
    setReports((prev) => prev.filter((r) => r.id !== id));
  }, []);

  /* ---- alert feed bus ---- */
  const alertsFeed = useMemo(() => {
    const base = getAlerts().sort((a, b) => b.t - a.t);
    const seen = new Set(liveAlerts.map((a) => a.id));
    return [...liveAlerts, ...base.filter((a) => !seen.has(a.id))].slice(0, FEED_MAX);
  }, [liveAlerts]);

  const alertUnread = useMemo(
    () => alertsFeed.filter((a) => isHotAlert(a) && !alertReadIds.has(a.id)).length,
    [alertsFeed, alertReadIds]
  );

  const markAlertsRead = useCallback((ids: string[]) => {
    setAlertReadIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.add(id);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      filters,
      setPlatform,
      setRange,
      setCustomDays,
      toggleLanguage,
      clearLanguages,
      setQuery,
      resetFilters,
      screen,
      go,
      selectedTopicId,
      setSelectedTopicId,
      selectedClaimId,
      setSelectedClaimId,
      reportOpen,
      setReportOpen,
      methodologyOpen,
      setMethodologyOpen,
      watchlist,
      toggleWatchlist,
      isWatched: (topicId: string) => watchlist.includes(topicId),
      compareIds,
      toggleComparePin,
      clearCompare,
      compareOpen,
      setCompareOpen,
      savedViews,
      saveView,
      applyView,
      deleteView,
      isViewActive,
      claimNotes,
      setClaimNote,
      reports,
      archiveReport,
      deleteReport,
      alertsFeed,
      alertUnread,
      markAlertsRead,
      refreshKey,
    }),
    [
      filters,
      setPlatform,
      setRange,
      setCustomDays,
      toggleLanguage,
      clearLanguages,
      setQuery,
      resetFilters,
      screen,
      go,
      selectedTopicId,
      selectedClaimId,
      reportOpen,
      methodologyOpen,
      watchlist,
      toggleWatchlist,
      compareIds,
      toggleComparePin,
      clearCompare,
      compareOpen,
      savedViews,
      saveView,
      applyView,
      deleteView,
      isViewActive,
      claimNotes,
      setClaimNote,
      reports,
      archiveReport,
      deleteReport,
      alertsFeed,
      alertUnread,
      markAlertsRead,
      refreshKey,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}
