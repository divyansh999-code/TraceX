"use client";

/**
 * REPORT MODAL — mock exportable intelligence summary.
 * Renders a document-framed preview of the current filter window:
 * classification, meta grid, auto-computed key findings, mini visuals.
 */
import { useMemo } from "react";
import { useApp, type ArchivedReport } from "@/lib/app-state";
import { getBots, getClaims, getKpis, getVolumeSeries, TOPICS, NOW } from "@/lib/mock";
import { fmtCompact, fmtDateIST, fmtFull, fmtNet, fmtSigned } from "@/lib/fmt";
import { Badge, ScoreBar, Taxonomy } from "../common/primitives";
import { Sparkline } from "../common/Sparkline";
import { CHART } from "../common/ChartBits";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Bot, Copy, FileDown, HeartPulse, ShieldAlert, TrendingUp, Archive, type LucideIcon } from "lucide-react";

/** findings icon → JSON-safe archive key (reverse-mapped on render) */
function iconKeyOf(icon: LucideIcon): ArchivedReport["findings"][number]["iconKey"] {
  if (icon === TrendingUp) return "trend";
  if (icon === ShieldAlert) return "claim";
  if (icon === Bot) return "bot";
  return "sentiment";
}

const WINDOW_LABEL: Record<string, string> = {
  "24h": "last 24 hours",
  "7d": "last 7 days",
  "30d": "last 30 days",
  custom: "custom window",
};

interface Finding {
  icon: LucideIcon;
  label: string;
  value: string;
  tone: string;
}

export function ReportModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { filters, archiveReport } = useApp();

  const kpis = useMemo(() => getKpis(filters), [filters]);
  const series = useMemo(() => getVolumeSeries(filters), [filters]);
  const claims = useMemo(() => getClaims(filters), [filters]);
  const bots = useMemo(() => getBots(filters), [filters]);

  const windowLabel =
    filters.range === "custom" ? `${filters.customDays}-day custom window` : (WINDOW_LABEL[filters.range] ?? "window");
  const platformLabel =
    filters.platform === "all" ? "X + Telegram" : filters.platform === "x" ? "X only" : "Telegram only";
  const docId = `RPT-${410 + (filters.range === "24h" ? 1 : filters.range === "7d" ? 2 : 3)}${filters.platform === "all" ? "8" : filters.platform === "x" ? "4" : "6"}`;

  /* --- auto-computed key findings --- */
  const findings = useMemo<Finding[]>(() => {
    const top = [...TOPICS].sort((a, b) => b.change24h - a.change24h)[0];
    const worst = [...claims].sort((a, b) => b.risk - a.risk)[0];
    const cluster = [...bots.clusters].sort((a, b) => b.size - a.size)[0];
    return [
      ...(top
        ? [
            {
              icon: TrendingUp,
              label: "Top narrative",
              value: `${top.label} — ${fmtSigned(top.change24h, 1)}% volume vs previous 24h, velocity "${top.velocity}".`,
              tone: "text-signal-orange",
            },
          ]
        : []),
      ...(worst
        ? [
            {
              icon: ShieldAlert,
              label: "Highest-risk claim",
              value: `“${worst.text.length > 68 ? `${worst.text.slice(0, 68)}…` : worst.text}” — risk ${worst.risk.toFixed(2)}, status ${worst.status.toLowerCase()}, ${fmtCompact(worst.totalReach)} reach.`,
              tone: "text-signal-red",
            },
          ]
        : []),
      ...(cluster
        ? [
            {
              icon: Bot,
              label: "Bot cluster",
              value: `${cluster.id} — ${cluster.size} accounts acting within a ${cluster.syncWindowSec}s sync window, ${cluster.sharedMediaHashes} shared media hashes.`,
              tone: "text-signal-red",
            },
          ]
        : []),
      {
        icon: HeartPulse,
        label: "Net sentiment",
        value: `${fmtNet(kpis.avgSentiment)} across monitored narratives — ${kpis.sentimentDelta >= 0 ? "improving" : "deteriorating"} vs previous window.`,
        tone: kpis.avgSentiment >= 0 ? "text-signal-green" : "text-signal-red",
      },
    ];
  }, [claims, bots, kpis]);

  /* --- mini visuals data --- */
  const volumeSpark = useMemo(() => series.map((p) => p.total), [series]);
  const totalPosts = useMemo(() => series.reduce((a, p) => a + p.total, 0), [series]);
  const sentimentMix = useMemo(() => {
    const pos = series.reduce((a, p) => a + p.positive, 0);
    const neu = series.reduce((a, p) => a + p.neutral, 0);
    const neg = series.reduce((a, p) => a + p.negative, 0);
    const tot = Math.max(1, pos + neu + neg);
    return { pos: (pos / tot) * 100, neu: (neu / tot) * 100, neg: (neg / tot) * 100 };
  }, [series]);

  const summaryText = useMemo(
    () =>
      [
        `TraceX Intelligence Summary — ${windowLabel} (${platformLabel})`,
        `Generated ${fmtDateIST(NOW)} IST · Prepared by A. Sharma (Analyst L2) · DOC ${docId}`,
        `Posts tracked: ${fmtFull(kpis.postsTracked)} · Net sentiment: ${fmtNet(kpis.avgSentiment)} · Bot share: ${(kpis.botShare * 100).toFixed(1)}%`,
        "",
        "KEY FINDINGS",
        ...findings.map((f, i) => `${i + 1}. ${f.label}: ${f.value}`),
        "",
        "Classification: INTERNAL · Derived from aggregated public posts · k-anonymised cohorts.",
      ].join("\n"),
    [windowLabel, platformLabel, docId, kpis, findings]
  );

  const copySummary = async () => {
    try {
      await navigator.clipboard.writeText(summaryText);
      toast.success("Summary copied to clipboard", { description: `${findings.length} findings · DOC ${docId}` });
    } catch {
      toast.error("Clipboard unavailable", { description: "Browser denied clipboard access — copy manually." });
    }
  };

  const exportPdf = () => {
    toast("PDF export queued", { description: `${docId} will appear in Analyst reports.` });
  };

  /* snapshot the current brief into the persisted archive (v0.14) —
     reopenable from the Alerts module "Briefing archive" panel */
  const archiveBriefing = () => {
    archiveReport({
      docId,
      windowLabel,
      platformLabel,
      postsTracked: kpis.postsTracked,
      netSentiment: kpis.avgSentiment,
      botShare: kpis.botShare,
      findings: findings.map((f) => ({
        iconKey: iconKeyOf(f.icon),
        label: f.label,
        value: f.value,
        tone: f.tone,
      })),
    });
    toast.success("Briefing archived", {
      description: `${docId} · ${windowLabel} — reopen from Alerts & Reports → Briefing archive.`,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border shrink-0">
          <DialogTitle className="font-display text-xl tracking-tight">TraceX Intelligence Summary</DialogTitle>
          <DialogDescription className="text-xs font-mono tnum">
            Generated {fmtDateIST(NOW)} IST · exportable analyst brief · {windowLabel}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[65vh] overflow-y-auto p-4">
          {/* document frame */}
          <div className="bg-popover border border-border rounded-md p-5 sm:p-6">
            {/* classification row */}
            <div className="flex flex-wrap items-center gap-2 pb-3 mb-4 border-b-2 border-border">
              <Badge tone="amber" dot>
                RESTRICTED — INTERNAL
              </Badge>
              <Badge tone="cyan">{windowLabel}</Badge>
              <Badge tone="neutral">{platformLabel}</Badge>
              <span className="ml-auto font-mono text-[10px] tnum text-muted-foreground">DOC {docId}</span>
            </div>

            {/* meta grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="min-w-0">
                <Taxonomy>Prepared by</Taxonomy>
                <div className="text-xs text-foreground mt-0.5 truncate">A. Sharma (Analyst L2)</div>
              </div>
              <div className="min-w-0">
                <Taxonomy>Sources</Taxonomy>
                <div className="text-xs text-foreground mt-0.5 truncate">X · Telegram</div>
              </div>
              <div className="min-w-0">
                <Taxonomy>Window</Taxonomy>
                <div className="text-xs text-foreground mt-0.5 truncate">{windowLabel}</div>
              </div>
              <div className="min-w-0">
                <Taxonomy>Posts tracked</Taxonomy>
                <div className="text-xs font-mono tnum text-foreground mt-0.5 truncate">
                  {fmtCompact(kpis.postsTracked)}
                </div>
              </div>
            </div>

            {/* key findings */}
            <div className="mt-5">
              <Taxonomy>Key findings</Taxonomy>
              <ol className="mt-2.5 space-y-2.5">
                {findings.map((f, i) => (
                  <li key={f.label} className="flex items-start gap-3">
                    <span className="font-mono text-[10px] tnum text-muted-foreground/70 mt-0.5 w-4 shrink-0">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <f.icon className={`size-3.5 mt-0.5 shrink-0 ${f.tone}`} strokeWidth={1.75} />
                    <span className="text-xs leading-relaxed min-w-0">
                      <span className="text-foreground font-medium">{f.label}:</span>{" "}
                      <span className="text-muted-foreground">{f.value}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>

            {/* mini visuals */}
            <div className="mt-5 pt-4 border-t border-border grid grid-cols-3 gap-4">
              <div className="min-w-0">
                <Taxonomy>Volume</Taxonomy>
                <div className="mt-2">
                  <Sparkline data={volumeSpark} color={CHART.orange} width={160} height={34} />
                </div>
                <div className="font-mono text-[10px] tnum text-muted-foreground mt-1 truncate">
                  {fmtCompact(totalPosts)} posts · window
                </div>
              </div>
              <div className="min-w-0">
                <Taxonomy>Sentiment mix</Taxonomy>
                <div className="mt-2.5 h-2 rounded-sm overflow-hidden flex border border-border/60">
                  <span className="bg-signal-green" style={{ width: `${sentimentMix.pos}%` }} />
                  <span className="bg-signal-slate/60" style={{ width: `${sentimentMix.neu}%` }} />
                  <span className="bg-signal-red" style={{ width: `${sentimentMix.neg}%` }} />
                </div>
                <div className="font-mono text-[10px] tnum mt-1.5 flex gap-2 whitespace-nowrap">
                  <span className="text-signal-green">{sentimentMix.pos.toFixed(0)}% pos</span>
                  <span className="text-muted-foreground/70">{sentimentMix.neu.toFixed(0)}% neu</span>
                  <span className="text-signal-red">{sentimentMix.neg.toFixed(0)}% neg</span>
                </div>
              </div>
              <div className="min-w-0">
                <Taxonomy>Bot share</Taxonomy>
                <div className="mt-2.5">
                  <ScoreBar value={kpis.botShare} showValue />
                </div>
                <div className="font-mono text-[10px] tnum text-muted-foreground mt-1.5 truncate">
                  est. bot-authored
                </div>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-border text-[10px] font-mono text-muted-foreground/60 leading-relaxed">
              Distribution: intelligence desk leads · derived from aggregated public posts, anonymised
              cohorts · k-anonymised (k ≥ 50).
            </div>
          </div>
        </div>

        <DialogFooter className="px-5 py-4 border-t border-border shrink-0">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button variant="outline" onClick={copySummary}>
            <Copy className="size-3.5" /> Copy summary
          </Button>
          <Button variant="outline" onClick={archiveBriefing}>
            <Archive className="size-3.5" /> Archive
          </Button>
          <Button onClick={exportPdf}>
            <FileDown className="size-3.5" /> Export PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
