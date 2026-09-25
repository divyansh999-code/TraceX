"use client";

/**
 * Top command bar: category / time-window / language filter dropdowns,
 * global search, live clock. The filter bank is a trio of compact
 * dropdowns sharing one trigger language; the bar wraps gracefully on
 * narrow viewports (filters claim their own row below the search).
 */
import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useApp } from "@/lib/app-state";
import { LANGUAGES } from "@/lib/mock";
import { fmtClockIST } from "@/lib/fmt";
import { useNow } from "../common/Skeletons";
import { LiveDot } from "../common/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverAnchor } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Search,
  RotateCw,
  Send,
  CalendarClock,
  X as XIcon,
  Volume2,
  VolumeX,
  ChevronDown,
  Languages,
  Menu,
  Check,
  SlidersHorizontal,
} from "lucide-react";
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

/* ------------------------------------------------------------------ */
/* Filter-bank dropdown trio — one shared trigger language             */
/* ------------------------------------------------------------------ */

function FilterTrigger({
  children,
  active,
  title,
  ...props
}: React.ComponentPropsWithoutRef<"button"> & { active: boolean }) {
  return (
    <button
      type="button"
      title={title}
      className={cn(
        "h-7 px-2.5 rounded-md border inline-flex items-center gap-1.5 text-[11px] font-medium",
        "transition-colors duration-100 cursor-pointer whitespace-nowrap",
        active
          ? "bg-secondary text-foreground border-border"
          : "bg-background text-foreground border-border hover:border-muted-foreground/40"
      )}
      {...props}
    >
      {children}
    </button>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <ChevronDown
      className={cn("size-3 text-muted-foreground transition-transform duration-150", open && "rotate-180")}
      aria-hidden="true"
    />
  );
}

const PLATFORM_META: {
  value: Platform;
  label: string;
  glyph: React.ReactNode;
  hint: string;
}[] = [
  {
    value: "all",
    label: "All",
    glyph: <span className="size-2 rounded-[2px] bg-signal-cyan inline-block" />,
    hint: "X + Telegram",
  },
  { value: "x", label: "X", glyph: <XGlyph />, hint: "X (Twitter)" },
  { value: "telegram", label: "Telegram", glyph: <Send className="size-3" />, hint: "Telegram only" },
];

function CategoryFilter() {
  const { filters, setPlatform } = useApp();
  const [open, setOpen] = useState(false);
  const meta = PLATFORM_META.find((p) => p.value === filters.platform) ?? PLATFORM_META[0];

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <FilterTrigger active={filters.platform !== "all"} title="Filter by source category">
          {meta.glyph}
          <span>{meta.label}</span>
          <Chevron open={open} />
        </FilterTrigger>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        <div className="taxonomy text-muted-foreground/70 px-2 py-1.5 select-none">Categories</div>
        {PLATFORM_META.map((p) => (
          <DropdownMenuItem
            key={p.value}
            onSelect={() => setPlatform(p.value)}
            className="gap-2.5 text-xs cursor-pointer"
          >
            {p.glyph}
            <span>{p.label}</span>
            <span className="ml-auto text-[10px] text-muted-foreground/70 font-mono">{p.hint}</span>
            <Check
              className={cn(
                "size-3.5 text-primary shrink-0",
                filters.platform === p.value ? "opacity-100" : "opacity-0"
              )}
            />
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const RANGE_META: { value: RangeKey; label: string; hint: string }[] = [
  { value: "24h", label: "24 hours", hint: "rolling day" },
  { value: "7d", label: "7 days", hint: "past week" },
  { value: "30d", label: "30 days", hint: "past month" },
];

function DaysFilter() {
  const { filters, setRange, setCustomDays } = useApp();
  const [open, setOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [customValue, setCustomValue] = useState(String(filters.customDays));
  /* transit flag — when the menu hands over to the custom-window popover,
     the menu must NOT return focus to the trigger (the focusin would hit
     the popover's outside-layer dismissal and instantly close it) */
  const openingCustomRef = useRef(false);

  const label =
    filters.range === "custom" ? `${filters.customDays} days` : RANGE_META.find((r) => r.value === filters.range)?.label ?? "24 hours";

  return (
    <Popover
      open={customOpen}
      onOpenChange={(v) => {
        setCustomOpen(v);
      }}
    >
      <PopoverAnchor asChild>
        <span className="inline-flex">
          <DropdownMenu open={open} onOpenChange={setOpen}>
            <DropdownMenuTrigger asChild>
              <FilterTrigger active={filters.range !== "24h"} title="Time window">
                <CalendarClock className="size-3.5 text-muted-foreground" />
                <span>{label}</span>
                <Chevron open={open} />
              </FilterTrigger>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="w-52"
              onCloseAutoFocus={(e) => {
                if (openingCustomRef.current) e.preventDefault();
              }}
            >
          <div className="taxonomy text-muted-foreground/70 px-2 py-1.5 select-none">Time window</div>
          {RANGE_META.map((r) => (
            <DropdownMenuItem
              key={r.value}
              onSelect={() => setRange(r.value)}
              className="gap-2.5 text-xs cursor-pointer"
            >
              <span>{r.label}</span>
              <span className="ml-auto text-[10px] text-muted-foreground/70 font-mono">{r.hint}</span>
              <Check
                className={cn(
                  "size-3.5 text-primary shrink-0",
                  filters.range === r.value ? "opacity-100" : "opacity-0"
                )}
              />
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => {
              openingCustomRef.current = true;
              setOpen(false);
              window.setTimeout(() => {
                openingCustomRef.current = false;
                setCustomOpen(true);
              }, 260);
            }}
            className="gap-2.5 text-xs cursor-pointer"
          >
            <SlidersHorizontal className="size-3.5 text-muted-foreground" />
            <span>Custom window…</span>
            <span className="ml-auto text-[10px] font-mono text-muted-foreground/70">3–90d</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
        </DropdownMenu>
      </span>
      </PopoverAnchor>
      <PopoverContent align="start" className="w-64 p-3">
        <div className="taxonomy text-muted-foreground mb-2">Custom window</div>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={3}
            max={90}
            value={customValue}
            autoFocus
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
  );
}

function LanguageFilter() {
  const { filters, toggleLanguage, clearLanguages } = useApp();
  const [open, setOpen] = useState(false);
  const n = filters.languages.length;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <FilterTrigger active={n > 0} title="Language filter">
          <Languages className="size-3.5 text-muted-foreground" />
          <span>Languages</span>
          {n > 0 && (
            <span className="font-mono text-[10px] tnum text-primary border border-primary/35 bg-primary/10 rounded-sm px-1 leading-4">
              {n}
            </span>
          )}
          <Chevron open={open} />
        </FilterTrigger>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        <div className="taxonomy text-muted-foreground/70 px-2 py-1.5 flex items-center justify-between select-none">
          <span>Languages</span>
          <span className="font-mono text-[9px] tnum text-muted-foreground/70">
            {n}/{LANGUAGES.length} selected
          </span>
        </div>
        {LANGUAGES.map((lang) => {
          const active = filters.languages.includes(lang.code);
          return (
            <DropdownMenuItem
              key={lang.code}
              onSelect={(e) => {
                e.preventDefault(); // multi-select — keep the menu open
                toggleLanguage(lang.code);
              }}
              title={`${lang.label} — ${lang.share}% of corpus`}
              className="gap-2.5 text-xs cursor-pointer"
            >
              <Check className={cn("size-3.5 text-primary shrink-0", active ? "opacity-100" : "opacity-0")} />
              <span>{lang.native}</span>
              <span className="ml-auto text-[10px] font-mono text-muted-foreground/70 tnum">{lang.share}%</span>
            </DropdownMenuItem>
          );
        })}
        {n > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                clearLanguages();
              }}
              className="gap-2.5 text-xs cursor-pointer text-signal-red focus:text-signal-red"
            >
              <XIcon className="size-3.5" />
              <span>Clear language filter</span>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ------------------------------------------------------------------ */

export function TopBar({ onOpenMobileNav }: { onOpenMobileNav: () => void }) {
  const { filters, setQuery, screen } = useApp();
  const now = useNow(1000);
  const [searchText, setSearchText] = useState(filters.query);
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
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 min-h-14 px-4 py-2">
        {/* Mobile drawer trigger */}
        <button
          type="button"
          onClick={onOpenMobileNav}
          className="md:hidden size-8 rounded-md border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-muted-foreground/40 transition-colors cursor-pointer shrink-0"
          title="Open navigation"
          aria-label="Open navigation"
        >
          <Menu className="size-4" />
        </button>

        {/* Screen identifier */}
        <div className="hidden lg:flex items-center gap-2 shrink-0 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
          <span className="text-primary">MODULE {meta.code}</span>
          <span className="text-border">{"//"}</span>
          <span>{meta.label}</span>
        </div>

        {/* Global search */}
        <div className="relative flex-1 min-w-32 max-w-md">
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

        {/* Filter bank — category · window · languages (guided-tour anchor) */}
        <div className="flex items-center gap-2 shrink-0" data-tour="filter-bank">
          <CategoryFilter />
          <DaysFilter />
          <LanguageFilter />
        </div>

        <div className="ml-auto flex items-center gap-2 shrink-0">
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
    </header>
  );
}
