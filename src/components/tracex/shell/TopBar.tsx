"use client";

/** Top command bar: platform, range, search, languages, live clock. */
import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useApp } from "@/lib/app-state";
import { LANGUAGES } from "@/lib/mock";
import { fmtClockIST } from "@/lib/fmt";
import { useNow } from "../common/Skeletons";
import { LiveDot, Chip } from "../common/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Search, Moon, SunMedium, RotateCw, Send, CalendarClock, X as XIcon, Volume2, VolumeX, Bookmark, BookmarkPlus } from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { isAudioEnabled, setAudioEnabled, playCriticalCue } from "@/lib/alert-cue";
import { CommandPalette } from "./CommandPalette";
import { AlertsBell } from "./AlertsBell";
import type { Platform, RangeKey, ScreenId } from "@/lib/mock/types";

const SCREEN_META: Record<ScreenId, { code: string; label: string }> = {
  overview: { code: "01", label: "INTELLIGENCE FUSION" },
  trends: { code: "02", label: "TREND EXPLORER" },
  sentiment: { code: "03", label: "SENTIMENT & EMOTION" },
  demographics: { code: "04", label: "DEMOGRAPHICS" },
  network: { code: "05", label: "NETWORK & INFLUENCE" },
  bots: { code: "06", label: "BOT DETECTION" },
  misinfo: { code: "07", label: "MISINFORMATION RADAR" },
  alerts: { code: "08", label: "ALERTS & REPORTS" },
};

function XGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={cn("size-3", className)} fill="currentColor" aria-hidden="true">
      <path d="M12.6 1h2.4l-5.3 6 5.5 8h-4.3l-3.4-4.9L3.5 15H1l5.7-6.5L1.4 1h4.4l3.1 4.4L12.6 1z" />
    </svg>
  );
}

function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: { value: T; label: React.ReactNode; title?: string }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div
      role="group"
      className={cn("inline-flex items-center bg-background border border-border rounded-md p-0.5 gap-0.5", className)}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          title={opt.title}
          onClick={() => onChange(opt.value)}
          className={cn(
            "h-7 px-2.5 rounded-sm text-[11px] font-medium inline-flex items-center gap-1.5",
            "transition-colors duration-100 cursor-pointer whitespace-nowrap",
            value === opt.value
              ? "bg-secondary text-foreground border border-border"
              : "text-muted-foreground hover:text-foreground border border-transparent"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function TopBar() {
  const {
    filters,
    setPlatform,
    setRange,
    setCustomDays,
    toggleLanguage,
    clearLanguages,
    setQuery,
    screen,
    savedViews,
    saveView,
    applyView,
    deleteView,
    isViewActive,
  } = useApp();
  const { resolvedTheme, setTheme } = useTheme();
  const now = useNow(1000);
  const [searchText, setSearchText] = useState(filters.query);
  const [customOpen, setCustomOpen] = useState(false);
  const [customValue, setCustomValue] = useState(String(filters.customDays));
  const [saveViewOpen, setSaveViewOpen] = useState(false);
  const [viewName, setViewName] = useState("");
  const [rememberScreen, setRememberScreen] = useState(true);
  /* audio cue toggle — lazy client-side init (TopBar mounts post-boot-splash,
     so the initializer never runs during SSR) */
  const [audioOn, setAudioOn] = useState(() => (typeof window !== "undefined" && isAudioEnabled()));
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onSearch = (v: string) => {
    setSearchText(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setQuery(v), 350);
  };

  const meta = SCREEN_META[screen];

  return (
    <header className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm border-b border-border shrink-0">
      <div className="h-14 flex items-center gap-3 px-4">
        {/* Screen identifier */}
        <div className="hidden lg:flex items-center gap-2 shrink-0 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
          <span className="text-primary">MODULE {meta.code}</span>
          <span className="text-border">{"//"}</span>
          <span>{meta.label}</span>
        </div>

        {/* Global search */}
        <div className="relative flex-1 min-w-24 max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={searchText}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search narratives, claims, accounts…  risk:>0.7  lang:hi"
            className="h-8 pl-8 pr-8 font-mono text-xs bg-background placeholder:text-muted-foreground/60"
          />
          {searchText && (
            <button
              type="button"
              onClick={() => onSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
              aria-label="Clear search"
            >
              <XIcon className="size-3.5" />
            </button>
          )}
        </div>

        {/* Platform */}
        <Segmented<Platform>
          value={filters.platform}
          onChange={setPlatform}
          options={[
            {
              value: "all",
              label: (
                <>
                  <span className="size-2 rounded-[2px] bg-signal-cyan inline-block" /> ALL
                </>
              ),
              title: "Both platforms",
            },
            { value: "x", label: <><XGlyph /> X</>, title: "X (Twitter) only" },
            { value: "telegram", label: <><Send className="size-3" /> TG</>, title: "Telegram only" },
          ]}
        />

        {/* Range */}
        <div className="hidden sm:flex items-center gap-2">
          <Segmented<RangeKey>
            value={filters.range}
            onChange={(r) => r !== "custom" && setRange(r)}
            options={[
              { value: "24h", label: "24H" },
              { value: "7d", label: "7D" },
              { value: "30d", label: "30D" },
            ]}
          />
          <Popover open={customOpen} onOpenChange={setCustomOpen}>
            <PopoverTrigger asChild>
              <Button
                variant={filters.range === "custom" ? "secondary" : "outline"}
                size="sm"
                className={cn("h-7 px-2.5 text-[11px] gap-1.5", filters.range !== "custom" && "text-muted-foreground")}
                title="Custom range"
              >
                <CalendarClock className="size-3.5" />
                {filters.range === "custom" ? `${filters.customDays}D` : "CUSTOM"}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64 p-3">
              <div className="taxonomy text-muted-foreground mb-2">Custom window</div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={3}
                  max={90}
                  value={customValue}
                  onChange={(e) => setCustomValue(e.target.value)}
                  className="h-8 font-mono text-xs"
                />
                <span className="text-xs text-muted-foreground">days</span>
              </div>
              <Button
                size="sm"
                className="mt-3 w-full h-7 text-[11px]"
                onClick={() => {
                  const d = Math.min(90, Math.max(3, parseInt(customValue) || 14));
                  setCustomDays(d);
                  setCustomOpen(false);
                }}
              >
                Apply window
              </Button>
            </PopoverContent>
          </Popover>
        </div>

        <div className="ml-auto flex items-center gap-3 shrink-0">
          <CommandPalette />
          <AlertsBell />
          <LiveDot className="hidden xl:inline-flex" />
          <span className="hidden md:inline font-mono text-[11px] tnum text-muted-foreground tabular-nums">
            {now ? fmtClockIST(now) : "--:--:--"} IST
          </span>
          <button
            type="button"
            onClick={() => {
              const next = !audioOn;
              setAudioOn(next);
              setAudioEnabled(next);
              if (next) {
                playCriticalCue();
                toast("Critical-alert audio armed", { description: "Chirp on high/critical feed arrivals." });
              }
            }}
            aria-pressed={audioOn}
            className={cn(
              "size-7 rounded-md border flex items-center justify-center transition-colors cursor-pointer",
              audioOn
                ? "border-primary/50 text-primary bg-primary/10"
                : "border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground/40"
            )}
            title={audioOn ? "Critical alert audio: armed" : "Critical alert audio: muted"}
            aria-label="Toggle critical alert audio"
          >
            {audioOn ? <Volume2 className="size-3.5" /> : <VolumeX className="size-3.5" />}
          </button>
          <button
            type="button"
            onClick={() => setTheme(resolvedTheme === "light" ? "dark" : "light")}
            className="size-7 rounded-md border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-muted-foreground/40 transition-colors cursor-pointer"
            title="Toggle console illumination"
            aria-label="Toggle theme"
          >
            {resolvedTheme === "light" ? <Moon className="size-3.5" /> : <SunMedium className="size-3.5" />}
          </button>
          <button
            type="button"
            onClick={() => {
              toast.success("Streams re-synced", {
                description: "X stream · TG stream · correlation engine re-queried.",
              });
            }}
            className="size-7 rounded-md border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-muted-foreground/40 transition-colors cursor-pointer"
            title="Re-sync streams"
            aria-label="Refresh"
          >
            <RotateCw className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Saved views + language chips row */}
      <div className="h-9 flex items-center gap-2 px-4 border-t border-border/60 overflow-x-auto">
        {/* Saved filter-bank presets (v0.12) */}
        {savedViews.length > 0 && (
          <>
            <span className="taxonomy text-primary/70 shrink-0 hidden sm:inline">Views</span>
            {savedViews.map((v) => (
              <span key={v.id} className="relative group/view shrink-0">
                <button
                  type="button"
                  onClick={() => applyView(v.id)}
                  title={`Apply view “${v.name}” — ${v.filters.platform.toUpperCase()} · ${v.filters.range}${v.filters.languages.length ? ` · ${v.filters.languages.length} langs` : ""}${v.screen ? ` · ${v.screen} module` : ""}`}
                  className={cn(
                    "inline-flex items-center gap-1.5 h-5.5 px-2 rounded-sm text-[10px] font-mono cursor-pointer transition-colors whitespace-nowrap",
                    isViewActive(v)
                      ? "bg-primary/15 text-primary border border-primary/40"
                      : "text-muted-foreground border border-border hover:text-foreground hover:border-muted-foreground/40"
                  )}
                >
                  <Bookmark className="size-2.5" />
                  {v.name}
                  {v.screen && <span className="text-muted-foreground/60">· {v.screen}</span>}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    deleteView(v.id);
                    toast(`View “${v.name}” removed`);
                  }}
                  aria-label={`Delete view ${v.name}`}
                  title={`Delete view “${v.name}”`}
                  className="absolute -top-1 -right-1 size-3 rounded-[3px] bg-signal-red/90 text-white hidden group-hover/view:flex items-center justify-center cursor-pointer"
                >
                  <XIcon className="size-2" />
                </button>
              </span>
            ))}
            <span className="w-px h-3.5 bg-border shrink-0 hidden sm:block" />
          </>
        )}

        {/* Save current filter bank as a named view */}
        <Popover open={saveViewOpen} onOpenChange={setSaveViewOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              title="Save the current filter bank as a named view"
              aria-label="Save current view"
              className="inline-flex items-center gap-1 h-5.5 px-2 rounded-sm text-[10px] font-mono text-muted-foreground border border-dashed border-border hover:text-primary hover:border-primary/50 transition-colors cursor-pointer shrink-0"
            >
              <BookmarkPlus className="size-2.5" /> Save view
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-64 p-3">
            <div className="taxonomy text-muted-foreground mb-2">Save current filter bank</div>
            <div className="text-[10px] font-mono text-muted-foreground/80 mb-2 leading-relaxed">
              {filters.platform.toUpperCase()} · {filters.range === "custom" ? `${filters.customDays}D` : filters.range.toUpperCase()}
              {filters.languages.length ? ` · ${filters.languages.length} lang${filters.languages.length === 1 ? "" : "s"}` : ""}
              {filters.query ? ` · “${filters.query.slice(0, 14)}…”` : ""} · module {screen}
            </div>
            <Input
              value={viewName}
              onChange={(e) => setViewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  saveView(viewName, rememberScreen ? screen : undefined);
                  setViewName("");
                  setSaveViewOpen(false);
                  toast("View saved", { description: "Reachable from the view rail and ⌘K." });
                }
              }}
              placeholder="e.g. High-risk watch · 30d"
              maxLength={40}
              className="h-8 text-xs"
            />
            <div className="flex items-center justify-between mt-2">
              <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberScreen}
                  onChange={(e) => setRememberScreen(e.target.checked)}
                  className="accent-primary size-3"
                />
                remember module
              </label>
              <Button
                size="sm"
                className="h-7 text-[11px]"
                onClick={() => {
                  saveView(viewName, rememberScreen ? screen : undefined);
                  setViewName("");
                  setSaveViewOpen(false);
                  toast("View saved", { description: "Reachable from the view rail and ⌘K." });
                }}
              >
                Save
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        <span className="taxonomy text-muted-foreground/60 shrink-0 hidden sm:inline">Languages</span>
        {LANGUAGES.map((lang) => (
          <Chip
            key={lang.code}
            active={filters.languages.includes(lang.code)}
            onClick={() => toggleLanguage(lang.code)}
            title={`${lang.label} — ${lang.share}% of corpus`}
          >
            {lang.native}
          </Chip>
        ))}
        {filters.languages.length > 0 && (
          <button
            type="button"
            onClick={clearLanguages}
            className="text-[10px] font-mono text-muted-foreground hover:text-signal-red shrink-0 cursor-pointer uppercase tracking-wider"
          >
            ✕ clear
          </button>
        )}
        <span className="ml-auto hidden lg:inline font-mono text-[10px] text-muted-foreground/60 shrink-0">
          {filters.languages.length}/{LANGUAGES.length} selected
        </span>
      </div>
    </header>
  );
}
