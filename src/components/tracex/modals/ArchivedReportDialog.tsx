"use client";

/**
 * Archived briefing viewer (v0.14) — renders a persisted report snapshot
 * in the same document-frame language as the live ReportModal. Opened
 * from the Alerts & Reports "Briefing archive" panel.
 */
import type { ArchivedReport } from "@/lib/app-state";
import { fmtCompact, fmtDateIST, fmtNet, relTime } from "@/lib/fmt";
import { Badge, ScoreBar, Taxonomy } from "../common/primitives";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Bot, HeartPulse, ShieldAlert, TrendingUp, Trash2, Copy } from "lucide-react";
import { toast } from "sonner";

const ICONS = {
  trend: TrendingUp,
  claim: ShieldAlert,
  bot: Bot,
  sentiment: HeartPulse,
} as const;

export function ArchivedReportDialog({
  report,
  onClose,
  onDelete,
}: {
  report: ArchivedReport | null;
  onClose: () => void;
  onDelete: (id: string) => void;
}) {
  const r = report;

  const copySummary = async () => {
    if (!r) return;
    const text = [
      `TraceX Intelligence Summary — ${r.windowLabel} (${r.platformLabel})`,
      `Archived ${fmtDateIST(r.createdAt)} IST · DOC ${r.docId}`,
      `Posts tracked: ${fmtCompact(r.postsTracked)} · Net sentiment: ${fmtNet(r.netSentiment)} · Bot share: ${(r.botShare * 100).toFixed(1)}%`,
      "",
      "KEY FINDINGS",
      ...r.findings.map((f, i) => `${i + 1}. ${f.label}: ${f.value}`),
      "",
      "Classification: RESTRICTED — INTERNAL · Prototype data — mock intelligence layer.",
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Archived summary copied", { description: `DOC ${r.docId}` });
    } catch {
      toast.error("Clipboard unavailable", { description: "Browser denied clipboard access." });
    }
  };

  return (
    <Dialog open={!!r} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl gap-0 p-0 overflow-hidden">
        {r && (
          <>
            <DialogHeader className="px-5 pt-5 pb-3 border-b border-border shrink-0">
              <DialogTitle className="font-display text-xl tracking-tight">Archived briefing</DialogTitle>
              <DialogDescription className="text-xs font-mono tnum">
                DOC {r.docId} · archived {relTime(r.createdAt)} ago · {r.windowLabel}
              </DialogDescription>
            </DialogHeader>

            <div className="max-h-[65vh] overflow-y-auto p-4">
              <div className="bg-popover border border-border rounded-md p-5 sm:p-6">
                {/* classification row */}
                <div className="flex flex-wrap items-center gap-2 pb-3 mb-4 border-b-2 border-border">
                  <Badge tone="amber" dot>
                    RESTRICTED — INTERNAL
                  </Badge>
                  <Badge tone="cyan">{r.windowLabel}</Badge>
                  <Badge tone="neutral">{r.platformLabel}</Badge>
                  <span className="ml-auto font-mono text-[10px] tnum text-muted-foreground">
                    {fmtDateIST(r.createdAt)} IST
                  </span>
                </div>

                {/* meta grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="min-w-0">
                    <Taxonomy>Posts tracked</Taxonomy>
                    <div className="text-xs font-mono tnum text-foreground mt-0.5 truncate">
                      {fmtCompact(r.postsTracked)}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <Taxonomy>Net sentiment</Taxonomy>
                    <div
                      className={`text-xs font-mono tnum mt-0.5 ${
                        r.netSentiment >= 0 ? "text-signal-green" : "text-signal-red"
                      }`}
                    >
                      {fmtNet(r.netSentiment)}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <Taxonomy>Window</Taxonomy>
                    <div className="text-xs text-foreground mt-0.5 truncate">{r.windowLabel}</div>
                  </div>
                  <div className="min-w-0">
                    <Taxonomy>Sources</Taxonomy>
                    <div className="text-xs text-foreground mt-0.5 truncate">{r.platformLabel}</div>
                  </div>
                </div>

                {/* archived findings */}
                <div className="mt-5">
                  <Taxonomy>Key findings at archive time</Taxonomy>
                  <ol className="mt-2.5 space-y-2.5">
                    {r.findings.map((f, i) => {
                      const Icon = ICONS[f.iconKey] ?? HeartPulse;
                      return (
                        <li key={i} className="flex items-start gap-3">
                          <span className="font-mono text-[10px] tnum text-muted-foreground/70 mt-0.5 w-4 shrink-0">
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          <Icon className={`size-3.5 mt-0.5 shrink-0 ${f.tone}`} strokeWidth={1.75} />
                          <span className="text-xs leading-relaxed min-w-0">
                            <span className="text-foreground font-medium">{f.label}:</span>{" "}
                            <span className="text-muted-foreground">{f.value}</span>
                          </span>
                        </li>
                      );
                    })}
                  </ol>
                </div>

                {/* bot share snapshot */}
                <div className="mt-5 pt-4 border-t border-border grid grid-cols-2 gap-4">
                  <div className="min-w-0">
                    <Taxonomy>Bot share</Taxonomy>
                    <div className="mt-2.5">
                      <ScoreBar value={r.botShare} showValue />
                    </div>
                    <div className="font-mono text-[10px] tnum text-muted-foreground mt-1.5 truncate">
                      est. bot-authored (at archive)
                    </div>
                  </div>
                  <div className="min-w-0">
                    <Taxonomy>Archive id</Taxonomy>
                    <div className="font-mono text-xs tnum text-foreground mt-1 truncate">{r.id}</div>
                    <div className="font-mono text-[10px] text-muted-foreground mt-1 truncate">
                      persisted locally · survives refresh
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-border text-[10px] font-mono text-muted-foreground/60 leading-relaxed">
                  Distribution: ministry steering committee · SIH 2026 evaluation panel · derived from
                  aggregated public posts, anonymised cohorts · prototype data.
                </div>
              </div>
            </div>

            <DialogFooter className="px-5 py-4 border-t border-border shrink-0">
              <Button variant="ghost" onClick={onClose}>
                Close
              </Button>
              <Button variant="outline" onClick={copySummary}>
                <Copy className="size-3.5" /> Copy
              </Button>
              <Button
                variant="outline"
                className="text-signal-red hover:text-signal-red border-signal-red/30 hover:border-signal-red/50"
                onClick={() => {
                  onDelete(r.id);
                  onClose();
                  toast(`DOC ${r.docId} removed from the archive`);
                }}
              >
                <Trash2 className="size-3.5" /> Delete
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
