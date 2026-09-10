"use client";

/**
 * ALERTS & REPORTS — alert history with triage actions, analyst report
 * generation (ReportModal) and the custom alert-rule builder.
 */
import { useMemo, useState } from "react";
import { useApp } from "@/lib/app-state";
import {
  getAlerts,
  NOW,
  type AlertRule,
  type AlertSeverity,
  type AlertStatus,
  type AlertType,
  type IntelligenceAlert,
} from "@/lib/mock";
import { DEFAULT_RULES } from "@/lib/mock/content";
import { fmtDateIST, relTime } from "@/lib/fmt";
import { downloadCsv, csvStamp } from "@/lib/csv";
import { Panel, Badge, Chip, LiveDot, MonoTag, SeverityDot, Taxonomy, type Tone } from "../common/primitives";
import { KpiCard } from "../common/KpiCard";
import { ScreenHeader } from "../common/ScreenHeader";
import { useRefresh, KpiRowSkeleton, PanelSkeleton } from "../common/Skeletons";
import { ReportModal } from "../modals/ReportModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  BellPlus,
  BellRing,
  Check,
  CheckCheck,
  Download,
  FileDown,
  FileText,
  Plus,
  ShieldAlert,
  X,
  Zap,
} from "lucide-react";

const WINDOW_LABEL: Record<string, string> = {
  "24h": "last 24 hours",
  "7d": "last 7 days",
  "30d": "last 30 days",
  custom: "custom window",
};

const TYPE_META: Record<AlertType, { label: string; tone: Tone }> = {
  spike: { label: "spike", tone: "orange" },
  "bot-cluster": { label: "bot", tone: "red" },
  misinformation: { label: "misinfo", tone: "amber" },
  "sentiment-shift": { label: "sentiment", tone: "cyan" },
};

const STATUS_TONE: Record<AlertStatus, Tone> = {
  New: "red",
  Acknowledged: "amber",
  Resolved: "green",
};

const SEVERITIES: (AlertSeverity | "all")[] = ["all", "critical", "high", "medium", "low"];
const SEVERITY_LABEL: Record<AlertSeverity | "all", string> = {
  all: "All",
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};
const TYPE_LABEL: Record<AlertType | "all", string> = {
  all: "All",
  spike: "Spike",
  "bot-cluster": "Bot",
  misinformation: "Misinfo",
  "sentiment-shift": "Sentiment",
};
const TYPES: (AlertType | "all")[] = ["all", "spike", "bot-cluster", "misinformation", "sentiment-shift"];
const STATUSES: (AlertStatus | "all")[] = ["all", "New", "Acknowledged", "Resolved"];

const METRICS: AlertRule["metric"][] = ["Volume", "Net sentiment", "Bot score", "Misinfo risk"];
const CONDITIONS: AlertRule["condition"][] = ["exceeds", "drops below"];
const CHANNELS: AlertRule["channel"][] = ["Console", "Email digest", "Webhook"];

const DEFAULT_THRESHOLD: Record<AlertRule["metric"], string> = {
  Volume: "2.5",
  "Net sentiment": "-0.30",
  "Bot score": "0.70",
  "Misinfo risk": "0.80",
};

const RECENT_REPORTS = [
  { id: "RPT-0412", name: "Daily fusion brief", t: NOW - 6 * 3.6e6, pages: 4 },
  { id: "RPT-0407", name: "Bot cluster escalation memo", t: NOW - 27 * 3.6e6, pages: 2 },
  { id: "RPT-0401", name: "Weekly misinformation digest", t: NOW - 74 * 3.6e6, pages: 6 },
];

function ruleSentence(r: AlertRule): string {
  const threshold = r.metric === "Volume" ? `${r.threshold}× baseline` : r.threshold.toFixed(2);
  return `${r.metric} ${r.condition} ${threshold} for ${r.target} → ${r.channel}`;
}

/* ------------------------------------------------------------------ */
/* Alert history table                                                 */
/* ------------------------------------------------------------------ */

function AlertHistory({
  alerts,
  onAcknowledge,
  onResolve,
}: {
  alerts: IntelligenceAlert[];
  onAcknowledge: (id: string) => void;
  onResolve: (id: string) => void;
}) {
  const { go } = useApp();
  const [sevFilter, setSevFilter] = useState<AlertSeverity | "all">("all");
  const [typeFilter, setTypeFilter] = useState<AlertType | "all">("all");
  const [statusFilter, setStatusFilter] = useState<AlertStatus | "all">("all");

  const visible = useMemo(
    () =>
      alerts.filter(
        (a) =>
          (sevFilter === "all" || a.severity === sevFilter) &&
          (typeFilter === "all" || a.type === typeFilter) &&
          (statusFilter === "all" || a.status === statusFilter)
      ),
    [alerts, sevFilter, typeFilter, statusFilter]
  );

  return (
    <Panel
      title="Alert history"
      icon={BellRing}
      sub="triage log"
      bodyClassName="p-0"
      right={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-6 px-2 text-[10px] gap-1"
            title="Export the visible triage log as CSV"
            onClick={() => {
              downloadCsv(
                `tracex-alerts-${csvStamp()}.csv`,
                ["id", "severity", "type", "title", "topic", "timestamp", "status", "detail"],
                visible.map((a) => [
                  a.id,
                  a.severity,
                  a.type,
                  a.title,
                  a.topicLabel ?? "",
                  new Date(a.t).toISOString(),
                  a.status,
                  a.detail,
                ])
              );
              toast("Triage log exported", {
                description: `${visible.length} alerts → CSV (current filters).`,
              });
            }}
          >
            <Download className="size-3" /> CSV
          </Button>
          <span className="font-mono text-[10px] tnum text-muted-foreground">
            {visible.length}/{alerts.length}
          </span>
        </div>
      }
    >
      {/* filter chips */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2.5 border-b border-border">
        <div className="flex items-center gap-1 flex-wrap">
          <Taxonomy className="hidden sm:inline">Severity</Taxonomy>
          {SEVERITIES.map((s) => (
            <Chip key={s} active={sevFilter === s} onClick={() => setSevFilter(s)}>
              {SEVERITY_LABEL[s]}
            </Chip>
          ))}
        </div>
        <div className="hidden md:block w-px h-4 bg-border" />
        <div className="flex items-center gap-1 flex-wrap">
          <Taxonomy className="hidden sm:inline">Type</Taxonomy>
          {TYPES.map((t) => (
            <Chip key={t} active={typeFilter === t} onClick={() => setTypeFilter(t)}>
              {TYPE_LABEL[t]}
            </Chip>
          ))}
        </div>
        <div className="hidden md:block w-px h-4 bg-border" />
        <div className="flex items-center gap-1 flex-wrap">
          <Taxonomy className="hidden sm:inline">Status</Taxonomy>
          {STATUSES.map((s) => (
            <Chip key={s} active={statusFilter === s} onClick={() => setStatusFilter(s)}>
              {s === "all" ? "All" : s}
            </Chip>
          ))}
        </div>
      </div>

      {/* table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-border">
              {["Severity", "Type", "Alert", "Topic", "Timestamp", "Status", "Actions"].map((h, i) => (
                <th
                  key={h}
                  className={cn(
                    "taxonomy text-muted-foreground/70 font-semibold px-3 py-2 whitespace-nowrap",
                    i === 0 && "pl-4",
                    i === 6 && "pr-4 text-right"
                  )}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-xs text-muted-foreground">
                  No alerts match the current filters.
                </td>
              </tr>
            )}
            {visible.map((a) => (
              <tr
                key={a.id}
                onClick={() => a.linkScreen && go(a.linkScreen)}
                title={a.linkScreen ? `Open ${a.linkScreen} module` : undefined}
                className={cn(
                  "border-b border-border/50 last:border-0 transition-colors",
                  a.status === "Resolved" && "opacity-60",
                  a.linkScreen && "cursor-pointer hover:bg-accent"
                )}
              >
                <td className="px-3 pl-4 py-2.5 whitespace-nowrap">
                  <div className="flex items-center gap-1.5">
                    <SeverityDot severity={a.severity} />
                    <span className="text-[10px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                      {a.severity}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  <span title={a.type}>
                    <Badge tone={TYPE_META[a.type].tone}>{TYPE_META[a.type].label}</Badge>
                  </span>
                </td>
                <td className="px-3 py-2.5 min-w-0 max-w-[300px]">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-medium text-foreground truncate">{a.title}</span>
                    <span className="font-mono text-[9px] tnum text-muted-foreground/60 shrink-0">{a.id}</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground truncate mt-0.5">{a.detail}</div>
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  {a.topicLabel ? (
                    <MonoTag className="max-w-32 truncate">{a.topicLabel}</MonoTag>
                  ) : (
                    <span className="text-[10px] font-mono text-muted-foreground/50">—</span>
                  )}
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  <div className="font-mono text-[10px] tnum text-foreground">{fmtDateIST(a.t)}</div>
                  <div className="font-mono text-[10px] tnum text-muted-foreground/70">{relTime(a.t, NOW)} ago</div>
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  <Badge tone={STATUS_TONE[a.status]}>{a.status}</Badge>
                </td>
                <td className="px-3 pr-4 py-2.5 whitespace-nowrap">
                  <div className="flex items-center gap-1.5 justify-end">
                    {a.status === "New" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 px-2 text-[10px] gap-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          onAcknowledge(a.id);
                        }}
                      >
                        <CheckCheck className="size-3" /> Acknowledge
                      </Button>
                    )}
                    {a.status !== "Resolved" ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 px-2 text-[10px] gap-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          onResolve(a.id);
                        }}
                      >
                        <Check className="size-3" /> Resolve
                      </Button>
                    ) : (
                      <span className="text-[10px] font-mono text-muted-foreground/60 pr-1">closed</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/* Analyst reports panel                                               */
/* ------------------------------------------------------------------ */

function ReportsPanel({ onGenerate }: { onGenerate: () => void }) {
  return (
    <Panel title="Analyst reports" icon={FileText} sub="exports">
      <p className="text-xs text-muted-foreground leading-relaxed">
        Compile the current filter window into an exportable intelligence summary — KPIs, key findings, bot clusters
        and the misinformation dossier.
      </p>
      <Button className="mt-3 w-full" onClick={onGenerate}>
        <FileDown className="size-4" /> Generate report
      </Button>
      <div className="mt-4 pt-3 border-t border-border/60 space-y-2.5">
        <Taxonomy>Recent reports</Taxonomy>
        {RECENT_REPORTS.map((r) => (
          <div key={r.id} className="flex items-center gap-2">
            <FileText className="size-3.5 text-muted-foreground shrink-0" strokeWidth={1.75} />
            <div className="min-w-0 flex-1">
              <div className="text-xs text-foreground truncate">{r.name}</div>
              <div className="font-mono text-[10px] tnum text-muted-foreground/70 truncate">
                {r.id} · {fmtDateIST(r.t)} · {r.pages} pp
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              aria-label={`Download ${r.id}`}
              onClick={() =>
                toast("Report export queued (prototype)", {
                  description: `${r.id} · ${r.name} · PDF pipeline simulated.`,
                })
              }
            >
              <Download className="size-3" />
            </Button>
          </div>
        ))}
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/* Alert rule builder                                                  */
/* ------------------------------------------------------------------ */

function RuleBuilder() {
  const [rules, setRules] = useState<AlertRule[]>(() => [...DEFAULT_RULES]);
  const [metric, setMetric] = useState<AlertRule["metric"]>("Volume");
  const [condition, setCondition] = useState<AlertRule["condition"]>("exceeds");
  const [threshold, setThreshold] = useState<string>(DEFAULT_THRESHOLD.Volume);
  const [target, setTarget] = useState("");
  const [channel, setChannel] = useState<AlertRule["channel"]>("Console");

  const createRule = () => {
    const t = target.trim();
    if (!t) {
      toast.error("Rule needs a target", {
        description: "Enter a topic, keyword or 'any monitored topic'.",
      });
      return;
    }
    const parsed = Number.parseFloat(threshold);
    const th = Number.isFinite(parsed) ? parsed : 0.5;
    const id = `RUL-${100 + rules.length + 1}`;
    const rule: AlertRule = { id, metric, condition, threshold: th, target: t, channel, active: true };
    setRules((prev) => [...prev, rule]);
    toast.success(`Rule ${id} armed`, { description: ruleSentence(rule) });
    setTarget("");
  };

  const activeCount = rules.filter((r) => r.active).length;

  return (
    <Panel title="Custom alert rules" icon={BellPlus} sub="rule builder">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 space-y-1.5">
          <Label className="text-[11px] font-normal text-muted-foreground">Alert me when</Label>
          <Select
            value={metric}
            onValueChange={(v) => {
              const m = v as AlertRule["metric"];
              setMetric(m);
              setThreshold(DEFAULT_THRESHOLD[m]);
            }}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {METRICS.map((m) => (
                <SelectItem key={m} value={m} className="text-xs">
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-[11px] font-normal text-muted-foreground">Condition</Label>
          <Select value={condition} onValueChange={(v) => setCondition(v as AlertRule["condition"])}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CONDITIONS.map((c) => (
                <SelectItem key={c} value={c} className="text-xs">
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-[11px] font-normal text-muted-foreground">
            Threshold{metric === "Volume" ? " · × baseline" : " · 0–1"}
          </Label>
          <Input
            type="number"
            step="0.05"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            className="h-8 font-mono text-xs tnum"
            aria-label="Threshold"
          />
        </div>

        <div className="col-span-2 space-y-1.5">
          <Label className="text-[11px] font-normal text-muted-foreground">Target</Label>
          <Input
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="topic, keyword or 'any monitored topic'"
            className="h-8 text-xs"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-[11px] font-normal text-muted-foreground">Channel</Label>
          <Select value={channel} onValueChange={(v) => setChannel(v as AlertRule["channel"])}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CHANNELS.map((c) => (
                <SelectItem key={c} value={c} className="text-xs">
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5 flex flex-col justify-end">
          <Button className="h-8 w-full text-xs" onClick={createRule}>
            <Plus className="size-3.5" /> Create rule
          </Button>
        </div>
      </div>

      {/* armed rules */}
      <div className="mt-4 pt-3 border-t border-border/60 space-y-2">
        <div className="flex items-center justify-between">
          <Taxonomy>Armed rules</Taxonomy>
          <span className="font-mono text-[10px] tnum text-muted-foreground">
            {activeCount}/{rules.length} active
          </span>
        </div>
        {rules.map((r) => (
          <div
            key={r.id}
            className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/20 px-2 py-1.5"
          >
            <Switch
              checked={r.active}
              onCheckedChange={(v) =>
                setRules((prev) => prev.map((x) => (x.id === r.id ? { ...x, active: v } : x)))
              }
              aria-label={`Toggle rule ${r.id}`}
            />
            <MonoTag className="shrink-0">{r.id}</MonoTag>
            <span className="text-[11px] text-muted-foreground truncate flex-1" title={ruleSentence(r)}>
              {ruleSentence(r)}
            </span>
            <button
              type="button"
              aria-label={`Delete rule ${r.id}`}
              onClick={() => {
                setRules((prev) => prev.filter((x) => x.id !== r.id));
                toast(`Rule ${r.id} disarmed`);
              }}
              className="text-muted-foreground/60 hover:text-signal-red transition-colors cursor-pointer shrink-0"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ))}
        {rules.length === 0 && (
          <p className="text-[11px] text-muted-foreground/70 py-2 text-center">No rules armed — create one above.</p>
        )}
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/* Main screen                                                         */
/* ------------------------------------------------------------------ */

export function AlertsScreen() {
  const { filters } = useApp();
  const ready = useRefresh("alerts");

  /* local alert state so triage mutations persist */
  const [alerts, setAlerts] = useState<IntelligenceAlert[]>(() => getAlerts());
  const [reportOpen, setReportOpen] = useState(false);

  const acknowledge = (id: string) => {
    setAlerts((prev) => prev.map((a) => (a.id === id && a.status === "New" ? { ...a, status: "Acknowledged" } : a)));
    toast.success(`${id} acknowledged`);
  };

  const resolve = (id: string) => {
    setAlerts((prev) => prev.map((a) => (a.id === id && a.status !== "Resolved" ? { ...a, status: "Resolved" } : a)));
    toast.success(`${id} resolved`);
  };

  const totalCount = alerts.length;
  const newCount = alerts.filter((a) => a.status === "New").length;
  const criticalCount = alerts.filter((a) => a.severity === "critical").length;
  const ackCount = alerts.filter((a) => a.status === "Acknowledged").length;

  const windowLabel = WINDOW_LABEL[filters.range] ?? "window";
  const platformLabel =
    filters.platform === "all" ? "X + Telegram" : filters.platform === "x" ? "X only" : "Telegram only";

  if (!ready) {
    return (
      <div className="space-y-4 animate-in fade-in duration-200">
        <KpiRowSkeleton />
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
          <PanelSkeleton className="xl:col-span-8" height="h-96" />
          <PanelSkeleton className="xl:col-span-4" height="h-96" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <ScreenHeader
        kicker="MODULE 08 // ALERTS & REPORTS"
        title="Alerts & Reports"
        description={`Intelligence alert history with triage actions, exportable analyst reports and custom alert rules — ${windowLabel} monitoring across ${platformLabel}.`}
        right={
          <div className="flex items-center gap-2">
            <LiveDot label="MONITORING" />
            <Badge tone="red" dot>
              {newCount} new
            </Badge>
            <Badge tone="cyan" dot>
              {platformLabel}
            </Badge>
          </div>
        }
      />

      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Total alerts"
          value={String(totalCount)}
          icon={BellRing}
          tone="cyan"
          delta={6.4}
          spark={[6, 8, 7, 9, 8, 11, 10, 12, 11, totalCount]}
          sparkColor="#5FA1C4"
          footnote={<span>active monitoring window</span>}
        />
        <KpiCard
          label="New"
          value={String(newCount)}
          icon={Zap}
          tone="red"
          invertDelta
          delta={25}
          spark={[1, 2, 1, 3, 2, 4, 3, 5, 4, newCount]}
          sparkColor="#D9564F"
          footnote={<span>awaiting triage</span>}
        />
        <KpiCard
          label="Critical"
          value={String(criticalCount)}
          icon={ShieldAlert}
          tone="red"
          invertDelta
          delta={-12.5}
          spark={[3, 2, 3, 2, 2, 1, 2, 1, 2, criticalCount]}
          sparkColor="#D9564F"
          footnote={<span>severity = critical</span>}
        />
        <KpiCard
          label="Acknowledged"
          value={String(ackCount)}
          icon={CheckCheck}
          tone="amber"
          delta={4.2}
          spark={[2, 2, 3, 3, 4, 3, 4, 5, 4, ackCount]}
          sparkColor="#D9A441"
          footnote={<span>in review</span>}
        />
      </div>

      {/* history + right column */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <div className="xl:col-span-8 min-w-0">
          <AlertHistory alerts={alerts} onAcknowledge={acknowledge} onResolve={resolve} />
        </div>
        <div className="xl:col-span-4 min-w-0 space-y-4">
          <ReportsPanel onGenerate={() => setReportOpen(true)} />
          <RuleBuilder />
        </div>
      </div>

      <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground/60 px-1">
        <BellRing className="size-3" />
        Alert engine: velocity z-scores · bot-cluster sync detection · claim re-emergence matching · sentiment drift ·
        window {windowLabel} · generated {relTime(NOW)} ago · prototype data
      </div>

      <ReportModal open={reportOpen} onOpenChange={setReportOpen} />
    </div>
  );
}
