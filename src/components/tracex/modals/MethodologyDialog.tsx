"use client";

/**
 * Methodology & data provenance (v0.13) — the "how it sees" briefing.
 *
 * Answers the first question judges and analysts ask: what exactly does
 * TraceX measure, how are the scores derived, and what does it
 * deliberately NOT see. Four sections: pipeline, the four intelligence
 * questions, scoring rubrics, privacy guarantees. Global state
 * (methodologyOpen) so the palette / cheatsheet / status bar can open it
 * over any screen.
 */
import { useApp } from "@/lib/app-state";
import type { ScreenId } from "@/lib/mock/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "../common/primitives";
import { ScoreBar } from "../common/primitives";
import {
  Database,
  ShieldCheck,
  Languages,
  Gauge,
  Layers,
  TrendingUp,
  Network,
  Radar,
  HeartPulse,
  Lock,
  EyeOff,
  Users,
  FlaskConical,
  ArrowUpRight,
} from "lucide-react";

const PIPELINE = [
  {
    icon: Database,
    name: "Ingestion",
    detail: "Public X + Telegram APIs · ~12.4k posts/min peak · language-tagged on arrival",
  },
  {
    icon: ShieldCheck,
    name: "Privacy envelope",
    detail: "k ≥ 50 aggregation before storage · handles hashed to cohorts · no PII retained",
  },
  {
    icon: Languages,
    name: "Enrichment",
    detail: "Language ID (7 incl. Hinglish & transliteration) · entity + narrative clustering",
  },
  {
    icon: Gauge,
    name: "Scoring",
    detail: "Sentiment ensemble · bot-probability behavioural model · PageRank influence · risk fusion",
  },
  {
    icon: Layers,
    name: "Fusion",
    detail: "Cross-platform correlation · propagation traces · alert bus → this console",
  },
];

const QUESTIONS: { icon: typeof TrendingUp; q: string; a: string; mod: string; goTo?: ScreenId }[] = [
  {
    icon: TrendingUp,
    q: "WHAT",
    a: "is gaining velocity — z-scored narrative detection surfaces emerging stories hours before keyword dashboards.",
    mod: "02 · Trends",
    goTo: "trends",
  },
  {
    icon: Network,
    q: "WHO",
    a: "amplifies it — PageRank over the reply/mention/repost graph, plus bot-probability for inorganic accounts.",
    mod: "05 · Network / 06 · Bots",
    goTo: "network",
  },
  {
    icon: Radar,
    q: "WHERE",
    a: "it spreads — cross-platform propagation tracing (X ↔ Telegram bridges) and cohort-level geography.",
    mod: "04 · Demographics",
    goTo: "demographics",
  },
  {
    icon: HeartPulse,
    q: "HOW",
    a: "sentiment shifts — positive/neutral/negative composition over time with flip attribution to narratives.",
    mod: "03 · Sentiment",
    goTo: "sentiment",
  },
];

const PRIVACY = [
  {
    icon: Lock,
    title: "Aggregate by construction",
    detail: "Every demographic figure is a cohort with k ≥ 50 members; smaller groups are suppressed outright.",
  },
  {
    icon: EyeOff,
    title: "No individual profiling",
    detail: "No dossiers, no tracking across sessions, no pursuit of identity. Influence analysis operates on public interaction structure.",
  },
  {
    icon: Users,
    title: "Cohorts, never persons",
    detail: "Demographics describe the audience of a narrative (states, languages, age bands) — never who said what.",
  },
  {
    icon: FlaskConical,
    title: "Demo transparency",
    detail: "This prototype renders a deterministic synthetic corpus — zero live collection, safe for evaluation.",
  },
];

export function MethodologyDialog() {
  const { methodologyOpen, setMethodologyOpen, go } = useApp();

  return (
    <Dialog open={methodologyOpen} onOpenChange={setMethodologyOpen}>
      <DialogContent className="sm:max-w-2xl bg-card border-border">
        <DialogHeader>
          <DialogTitle className="font-mono text-sm tracking-tight flex items-center gap-2">
            <FlaskConical className="size-4 text-primary" />
            Methodology &amp; data provenance
          </DialogTitle>
          <DialogDescription className="text-xs">
            How TraceX sees the public conversation — and what it deliberately never sees.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 max-h-[68vh] overflow-y-auto pr-1.5">
          {/* pipeline */}
          <section aria-labelledby="tm-pipeline">
            <div id="tm-pipeline" className="taxonomy text-muted-foreground/70 mb-2">
              Processing pipeline
            </div>
            <ol className="space-y-1.5">
              {PIPELINE.map((s, i) => (
                <li key={s.name} className="flex items-start gap-3 bg-background/50 border border-border rounded-md px-3 py-2">
                  <s.icon className="size-4 text-primary shrink-0 mt-0.5" strokeWidth={1.75} />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium text-foreground">
                      {i + 1}. {s.name}
                    </div>
                    <div className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">{s.detail}</div>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {/* four questions */}
          <section aria-labelledby="tm-questions">
            <div id="tm-questions" className="taxonomy text-muted-foreground/70 mb-2">
              The four intelligence questions
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {QUESTIONS.map((item) => (
                <div key={item.q} className="bg-background/50 border border-border rounded-md p-3">
                  <div className="flex items-center gap-2">
                    <item.icon className="size-3.5 text-primary" strokeWidth={1.75} />
                    <span className="font-mono text-xs font-semibold text-foreground tracking-wide">{item.q}</span>
                    <Badge tone="cyan" className="ml-auto shrink-0">
                      {item.mod}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed mt-1.5">{item.a}</p>
                  {item.goTo && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2 h-6 px-2 text-[10px] gap-1 text-primary hover:text-primary"
                      onClick={() => {
                        setMethodologyOpen(false);
                        go(item.goTo!);
                      }}
                    >
                      Open module <ArrowUpRight className="size-3" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* scoring rubric */}
          <section aria-labelledby="tm-scoring">
            <div id="tm-scoring" className="taxonomy text-muted-foreground/70 mb-2">
              Scoring reference
            </div>
            <div className="bg-background/50 border border-border rounded-md p-3 space-y-3">
              <div>
                <div className="text-[11px] font-medium text-foreground mb-1.5">Narrative risk (0 – 1)</div>
                <div className="space-y-1">
                  {[
                    { v: 0.18, t: "0.00 – 0.44 · routine discourse — monitor only", tone: "green" as const },
                    { v: 0.62, t: "0.45 – 0.74 · elevated — watchlist + shift alerts", tone: "amber" as const },
                    { v: 0.88, t: "0.75 – 1.00 · high — escalation, claim cross-check", tone: "red" as const },
                  ].map((r) => (
                    <div key={r.t} className="flex items-center gap-3">
                      <ScoreBar value={r.v} className="w-24 shrink-0" />
                      <span className="text-[11px] text-muted-foreground">{r.t}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="border-t border-border/60 pt-2.5">
                <div className="text-[11px] font-medium text-foreground mb-1">Bot probability signals</div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Posting frequency vs account age · duplicate-content ratio · inter-post timing correlation ·
                  cluster co-ordination (temporal burst alignment). Scores ≥ 0.6 enter the flagged watchlist;
                  clusters ≥ 5 accounts are treated as co-ordinated activity.
                </p>
              </div>
              <div className="border-t border-border/60 pt-2.5">
                <div className="text-[11px] font-medium text-foreground mb-1">Sentiment scale</div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Net sentiment = (positive − negative) / total, per bucket and per narrative. Emotion mix
                  (support / opposition / anxiety / anger / joy) drives the shift alerts at ±0.15 flips.
                </p>
              </div>
            </div>
          </section>

          {/* privacy */}
          <section aria-labelledby="tm-privacy">
            <div id="tm-privacy" className="taxonomy text-muted-foreground/70 mb-2">
              Privacy guarantees
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {PRIVACY.map((p) => (
                <div key={p.title} className="bg-signal-green/[0.06] border border-signal-green/20 rounded-md p-3">
                  <div className="flex items-center gap-2">
                    <p.icon className="size-3.5 text-signal-green shrink-0" strokeWidth={1.75} />
                    <span className="text-xs font-medium text-foreground">{p.title}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed mt-1.5">{p.detail}</p>
                </div>
              ))}
            </div>
          </section>

          <div className="text-[10px] font-mono text-muted-foreground/60 border-t border-border/60 pt-3">
            SIH 2026 · PS 26152 — prototype build · all telemetry deterministic &amp; generated locally
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
