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

import type { Filters, Platform, RangeKey, ScreenId } from "./mock/types";

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

  /** Starred narratives — persisted across sessions. */
  watchlist: string[];
  toggleWatchlist: (topicId: string) => void;
  isWatched: (topicId: string) => boolean;

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
}

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
    return { filters, watchlist };
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
    screen: hash?.screen ?? "overview",
    topicId: (hash?.topicId ?? null) as string | null,
    claimId: (hash?.claimId ?? null) as string | null,
  };
})();

export function AppProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<Filters>(INITIAL.filters);
  const [screen, setScreen] = useState<ScreenId>(INITIAL.screen);
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(INITIAL.topicId);
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(INITIAL.claimId);
  const [watchlist, setWatchlist] = useState<string[]>(INITIAL.watchlist);
  const [reportOpen, setReportOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const bump = useCallback(() => setRefreshKey((k) => k + 1), []);

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
      const snap: PersistedSnapshot = { filters, watchlist };
      window.localStorage.setItem(STORE_KEY, JSON.stringify(snap));
    } catch {
      /* private mode / quota — persistence is best-effort */
    }
  }, [screen, selectedTopicId, selectedClaimId, filters, watchlist]);

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
      watchlist,
      toggleWatchlist,
      isWatched: (topicId: string) => watchlist.includes(topicId),
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
      watchlist,
      toggleWatchlist,
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
