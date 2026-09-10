"use client";

/**
 * Global console state: filter bank + navigation bus.
 * Every screen reads filters from here; the shell writes to it.
 */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
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
  go: (screen: ScreenId, opts?: { topicId?: string }) => void;
  selectedTopicId: string | null;
  setSelectedTopicId: (id: string | null) => void;

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

export function AppProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [screen, setScreen] = useState<ScreenId>("overview");
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const bump = useCallback(() => setRefreshKey((k) => k + 1), []);

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

  const go = useCallback((s: ScreenId, opts?: { topicId?: string }) => {
    setScreen(s);
    if (opts?.topicId !== undefined) setSelectedTopicId(opts.topicId);
    window.scrollTo({ top: 0 });
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
