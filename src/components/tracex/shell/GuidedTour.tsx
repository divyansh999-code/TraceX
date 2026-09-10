"use client";

/**
 * Guided tour (v0.13) — first-visit spotlight walkthrough.
 *
 * A dark scrim with a spotlight cut-out (box-shadow trick) walks new
 * analysts through the console: filter bank → module rail → watchlist →
 * fusion KPIs → live alert bus → palette hints. Auto-starts once per
 * browser (localStorage gate, set inside async callbacks — lint-clean),
 * relaunchable from the ⌘K palette / shortcut cheatsheet via the
 * `tracex:tour-start` CustomEvent. While active, module hotkeys are
 * muted (body class guard) and stray targets auto-skip.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useApp } from "@/lib/app-state";
import { Button } from "@/components/ui/button";
import { TraceXMark } from "../common/TraceXLogo";
import { cn } from "@/lib/utils";
import { X, ArrowLeft, ArrowRight, Check } from "lucide-react";

const TOUR_KEY = "tracex.tour.v1";
export const TOUR_START_EVENT = "tracex:tour-start";

interface TourStep {
  title: string;
  body: React.ReactNode;
  /** CSS selector of the spotlight target; omit for centred cards. */
  target?: string;
  /** Navigate to this module before measuring the target. */
  screen?: "overview";
}

const STEPS: TourStep[] = [
  {
    title: "Welcome to TraceX",
    body: (
      <>
        <p>
          A social-intelligence console that fuses <span className="text-foreground">X + Telegram</span> public
          chatter into one operating picture — what&apos;s trending, who amplifies it, where it spreads and
          how sentiment shifts.
        </p>
        <p className="text-muted-foreground">
          Sixty seconds of orientation, analyst. Everything you&apos;ll see is aggregate and anonymised —
          cohorts, never individuals.
        </p>
      </>
    ),
  },
  {
    title: "The filter bank",
    target: '[data-tour="filter-bank"]',
    body: (
      <p>
        Slice the <em>entire</em> console by platform (X / Telegram), time window, language and free-text
        query — every module below re-queries instantly.
      </p>
    ),
  },
  {
    title: "Eight analysis modules",
    target: '[data-tour="module-rail"]',
    body: (
      <p>
        One rail, four intelligence questions: <span className="text-foreground">WHAT</span> (trends) ·{" "}
        <span className="text-foreground">WHO</span> (network, bots) ·{" "}
        <span className="text-foreground">WHERE</span> (propagation) ·{" "}
        <span className="text-foreground">HOW</span> (sentiment). Keys <span className="font-mono">1–8</span>{" "}
        jump anywhere.
      </p>
    ),
  },
  {
    title: "Narrative watchlist",
    target: '[data-tour="watchlist"]',
    body: (
      <p>
        Star narratives in the Trend Explorer to pin them here — live sparklines and one-click drill-down.
        Your console state persists across sessions.
      </p>
    ),
  },
  {
    title: "Fusion KPIs",
    target: '[data-tour="kpi-row"]',
    screen: "overview",
    body: (
      <p>
        Volume, active narratives, aggregate sentiment and high-risk alerts — recomputed live from the
        filtered corpus. Try the temporal replay scrubber beneath the main chart to rewind 30 days.
      </p>
    ),
  },
  {
    title: "Live alert bus",
    target: '[data-tour="live-feed"]',
    screen: "overview",
    body: (
      <p>
        Triage events stream in from every module — the bell, the browser-tab unread count and the optional
        audio cue all hang off this one feed.
      </p>
    ),
  },
  {
    title: "You're set",
    body: (
      <>
        <p>
          <span className="font-mono text-foreground">⌘K</span> opens the command palette,{" "}
          <span className="font-mono text-foreground">?</span> lists every shortcut, and the report modal
          packages findings for briefing.
        </p>
        <p className="text-muted-foreground">Good hunting, analyst.</p>
      </>
    ),
  },
];

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PAD = 8;

export function GuidedTour() {
  const { screen, go } = useApp();
  const [step, setStep] = useState<number | null>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const [cardPos, setCardPos] = useState<{ top: number; left: number } | null>(null);
  const [cardAbove, setCardAbove] = useState(false);
  const rafRef = useRef<number | null>(null);
  const skipRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const current = step != null ? STEPS[step] : null;

  const finish = useCallback(
    (markSeen = true) => {
      setStep(null);
      if (markSeen) {
        try {
          window.localStorage.setItem(TOUR_KEY, "seen");
        } catch {
          /* private mode — best effort */
        }
      }
    },
    []
  );

  const start = useCallback(
    (fromScreen?: string) => {
      if (fromScreen && fromScreen !== "overview") go("overview");
      setStep(0);
    },
    [go]
  );

  /** Jump to step i — navigating first when the step's target lives on
      another module (KPI row / live feed are Overview artefacts). Only
      ever called from event handlers / async callbacks → lint-clean. */
  const gotoStep = useCallback(
    (i: number) => {
      const clamped = Math.max(0, Math.min(STEPS.length - 1, i));
      const def = STEPS[clamped];
      if (def?.screen && def.screen !== screen) go(def.screen);
      setStep(clamped);
    },
    [go, screen]
  );

  /* ---- auto-start once per browser (async callback → lint-clean) ---- */
  useEffect(() => {
    let unseen = false;
    try {
      unseen = !window.localStorage.getItem(TOUR_KEY);
    } catch {
      unseen = false;
    }
    if (!unseen) return;
    const t = setTimeout(() => start(screen), 700);
    return () => clearTimeout(t);
  }, []);

  /* ---- manual relaunch bus (palette / cheatsheet) ---- */
  useEffect(() => {
    const onStart = () => start(screen);
    window.addEventListener(TOUR_START_EVENT, onStart);
    return () => window.removeEventListener(TOUR_START_EVENT, onStart);
  }, [start, screen]);

  /* ---- measure + reposition (target rect, card placement) ---- */
  const measure = useCallback(() => {
    if (skipRef.current) {
      clearTimeout(skipRef.current);
      skipRef.current = null;
    }
    if (step == null) return;
    const def = STEPS[step];
    if (!def?.target) {
      setRect(null);
      setCardPos(null);
      return;
    }
    const el = document.querySelector<HTMLElement>(def.target);
    if (!el || !el.offsetParent) {
      /* target not on screen — auto-skip forward (e.g. empty watchlist) */
      setRect(null);
      setCardPos(null);
      skipRef.current = setTimeout(
        () => setStep((s) => (s == null ? s : Math.min(s + 1, STEPS.length - 1))),
        650
      );
      return;
    }
    const r = el.getBoundingClientRect();
    const next: Rect = {
      top: r.top - PAD,
      left: r.left - PAD,
      width: r.width + PAD * 2,
      height: r.height + PAD * 2,
    };
    setRect(next);

    /* card: prefer below the target, flip above when cramped; clamp to viewport */
    const CARD_W = 340;
    const estH = 210;
    const below = next.top + next.height + 14;
    const useAbove = below + estH > window.innerHeight - 16 && next.top > estH + 32;
    const top = useAbove
      ? Math.max(16, next.top - estH - 14)
      : Math.min(below, window.innerHeight - estH - 16);
    const left = Math.max(
      16,
      Math.min(next.left + Math.max(0, (next.width - CARD_W) / 2), window.innerWidth - CARD_W - 16)
    );
    setCardAbove(useAbove);
    setCardPos({ top, left });
  }, [step]);

  useEffect(() => {
    if (step == null) return;
    /* measure inside rAF callbacks (async) — never synchronously in the
       effect body, so setState stays lint-clean */
    const initial = requestAnimationFrame(measure);
    const onRe = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(measure);
    };
    window.addEventListener("resize", onRe);
    window.addEventListener("scroll", onRe, { passive: true });
    return () => {
      cancelAnimationFrame(initial);
      window.removeEventListener("resize", onRe);
      window.removeEventListener("scroll", onRe);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [step, measure, screen]);

  /* ---- keyboard: Esc skips, ←/→ walk, Enter advances ---- */
  useEffect(() => {
    if (step == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        finish();
      } else if (e.key === "ArrowRight" || e.key === "Enter") {
        e.preventDefault();
        if (step >= STEPS.length - 1) finish();
        else gotoStep(step + 1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        gotoStep(step - 1);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [step, finish, gotoStep]);

  /* mute module hotkeys + flag tour mode for the shell; also clear any
     pending auto-skip timer when the tour closes */
  useEffect(() => {
    if (step == null) {
      if (skipRef.current) {
        clearTimeout(skipRef.current);
        skipRef.current = null;
      }
      return;
    }
    document.body.classList.add("tour-active");
    return () => document.body.classList.remove("tour-active");
  }, [step]);

  if (step == null || !current) return null;

  const isLast = step === STEPS.length - 1;
  const centered = !current.target;

  return (
    <div role="dialog" aria-modal="true" aria-label={`Guided tour — ${current.title}`} className="fixed inset-0 z-[80]">
      {/* click-catcher under the card: absorbs stray clicks, dim scrim */}
      <div className="absolute inset-0 bg-background/72 backdrop-blur-[1px]" onClick={() => finish()} />

      {/* spotlight ring — box-shadow casts the scrim cut-out */}
      {rect && (
        <div
          className="absolute rounded-lg pointer-events-none tour-spotlight"
          style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }}
        />
      )}

      {/* tooltip card */}
      <div
        className="absolute w-[min(340px,calc(100vw-32px))] bg-card border border-border shadow-2xl rounded-lg p-4 tour-card-in"
        style={
          centered
            ? {
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
              }
            : cardPos
              ? { top: cardPos.top, left: cardPos.left }
              : { visibility: "hidden" as const }
        }
      >
        {/* caret pointing back at the spotlight target */}
        {!centered && cardPos && (
          <span
            aria-hidden="true"
            className={cn(
              "absolute size-2.5 rotate-45 bg-card border-border",
              cardAbove ? "-bottom-[6px] border-b border-r" : "-top-[6px] border-l border-t"
            )}
            style={{ left: 22 }}
          />
        )}
        <div className="flex items-start gap-3">
          {centered && <TraceXMark size={34} className="shrink-0 mt-0.5" />}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="taxonomy text-primary">step {step + 1} / {STEPS.length}</span>
              {!centered && <span className="font-mono text-[10px] text-muted-foreground/70 truncate">{current.title}</span>}
            </div>
            <h3 className="font-display text-base font-semibold text-foreground mt-1">{current.title}</h3>
            <div className="mt-1.5 text-xs leading-relaxed text-muted-foreground space-y-1.5">{current.body}</div>
          </div>
          <button
            type="button"
            onClick={() => finish()}
            aria-label="Skip tour"
            className="size-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer shrink-0"
          >
            <X className="size-3.5 mx-auto" />
          </button>
        </div>

        {/* progress dots */}
        <div className="mt-3 flex items-center gap-1.5" aria-hidden="true">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-1 rounded-full transition-all",
                i === step ? "w-4 bg-primary" : i < step ? "w-1.5 bg-primary/50" : "w-1.5 bg-border"
              )}
            />
          ))}
        </div>

        <div className="mt-3 flex items-center gap-2">
          <span className="font-mono text-[9px] text-muted-foreground/60 hidden sm:inline">
            esc skip · ←/→ walk
          </span>
          <div className="ml-auto flex items-center gap-2">
            {step > 0 && (
              <Button variant="outline" size="sm" className="h-7 text-[11px] gap-1" onClick={() => gotoStep(step - 1)}>
                <ArrowLeft className="size-3" /> Back
              </Button>
            )}
            <Button
              size="sm"
              className="h-7 text-[11px] gap-1"
              onClick={() => (isLast ? finish() : gotoStep(step + 1))}
              autoFocus
            >
              {isLast ? (
                <>
                  <Check className="size-3" /> Finish
                </>
              ) : (
                <>
                  Next <ArrowRight className="size-3" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Dispatch the tour-start event (palette / cheatsheet relaunchers). */
export function startGuidedTour() {
  window.dispatchEvent(new CustomEvent(TOUR_START_EVENT));
}
