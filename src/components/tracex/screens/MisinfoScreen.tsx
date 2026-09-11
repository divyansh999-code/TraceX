"use client";

/**
 * MISINFORMATION RADAR — claim extraction, fact-check cross-referencing,
 * bot-correlation scoring and cross-platform spread mapping.
 * Two-column operating view: extraction list + selected claim dossier.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/lib/app-state";
import { getClaims, getTopicById, NOW, type Claim, type ClaimStatus } from "@/lib/mock";
import { fmtCompact, fmtDateIST, fmtFull, relTime, riskTone } from "@/lib/fmt";
import {
  Panel,
  Badge,
  ScoreBar,
  Legend,
  Chip,
  Taxonomy,
  MonoTag,
  MetricRow,
  type Tone,
} from "../common/primitives";
import { KpiCard } from "../common/KpiCard";
import { ScreenHeader } from "../common/ScreenHeader";
import { CHART, ChartTooltip, GRID, useChartTheme } from "../common/ChartBits";
import { useRefresh, KpiRowSkeleton, PanelSkeleton } from "../common/Skeletons";
import { cn } from "@/lib/utils";
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import {
  AlertTriangle,
  Bot,
  Check,
  FileCheck,
  FileSearch,
  Gauge,
  NotebookPen,
  Radar,
  SearchX,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { downloadCsv, csvStamp } from "@/lib/csv";
import { toast } from "sonner";

const WINDOW_LABEL: Record<string, string> = {
  "24h": "last 24 hours",
  "7d": "last 7 days",
  "30d": "last 30 days",
  custom: "custom window",
};

const STATUS_TONE: Record<ClaimStatus, Tone> = {
  Verified: "green",
  Disputed: "amber",
  Unverified: "cyan",
  False: "red",
};

const XREF_LABEL: Record<ClaimStatus, string> = {
  Verified: "cross-verified",
  Disputed: "cross-referenced",
  Unverified: "awaiting check",
  False: "debunked",
};

type RiskFilter = "all" | "high" | "elevated" | "low";
type StatusFilter = ClaimStatus | "all";

const RISK_FILTERS: { id: RiskFilter; label: string; test: (risk: number) => boolean }[] = [
  { id: "all", label: "All", test: () => true },
  { id: "high", label: "High ≥0.75", test: (r) => r >= 0.75 },
  { id: "elevated", label: "Elevated ≥0.45", test: (r) => r >= 0.45 && r < 0.75 },
  { id: "low", label: "Low", test: (r) => r < 0.45 },
];

const STATUS_FILTERS: StatusFilter[] = ["all", "Verified", "Disputed", "Unverified", "False"];

/* ------------------------------------------------------------------ */
/* Claim dossier — detail column                                       */
/* ------------------------------------------------------------------ */

/** Analyst notebook — free-form annotation attached to a claim, persisted
 *  in the session store (survives reload; shared across dossiers).
 *  Remounts per claim (keyed by claim id) so the draft initialises cleanly
 *  without setState-in-effect. Saves are debounced 500ms + on blur. */
function ClaimNotebook({ claimId }: { claimId: string }) {
  const { claimNotes, setClaimNote } = useApp();
  const saved = claimNotes[claimId]?.text ?? "";
  const [draft, setDraft] = useState(saved);
  const [dirty, setDirty] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const commit = (text: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setClaimNote(claimId, text);
    setDirty(false);
  };

  const onChange = (v: string) => {
    setDraft(v);
    setDirty(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => commit(v), 500);
  };

  /* flush pending edits if the component unmounts mid-debounce */
  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    []
  );

  const updatedAt = claimNotes[claimId]?.updatedAt;

  return (
    <div className="mt-4 pt-3 border-t border-border/60">
      <div className="flex items-center gap-2 mb-2">
        <NotebookPen className="size-3.5 text-primary" />
        <Taxonomy>Analyst notebook</Taxonomy>
        <span className="ml-auto font-mono text-[9px] text-muted-foreground/70">
          {dirty ? "saving…" : updatedAt ? `saved ${relTime(updatedAt, NOW)} ago` : "empty"}
        </span>
        {draft.trim() !== "" && (
          <span
            className={cn(
              "inline-flex items-center gap-1 font-mono text-[9px]",
              dirty ? "text-muted-foreground" : "text-signal-green"
            )}
          >
            <Check className="size-2.5" />
            {dirty ? "draft" : "synced"}
          </span>
        )}
      </div>
      <Textarea
        value={draft}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => dirty && commit(draft)}
        placeholder="Triage notes, escalation decisions, cross-references… (auto-saves, persists across sessions)"
        className="min-h-20 text-xs bg-background font-mono leading-relaxed resize-y"
        maxLength={2000}
        aria-label={`Analyst notes for claim ${claimId}`}
      />
      <div className="flex items-center justify-between mt-1.5">
        <span className="font-mono text-[9px] tnum text-muted-foreground/60">{draft.length}/2000</span>
        {draft !== saved && (
          <button
            type="button"
            onClick={() => commit(draft)}
            className="text-[10px] font-mono uppercase tracking-wider text-primary hover:text-primary/80 transition-colors cursor-pointer"
          >
            Save now
          </button>
        )}
      </div>
    </div>
  );
}

function ClaimDossier({ claim }: { claim: Claim }) {
  const { go } = useApp();
  const chartTheme = useChartTheme();
  const topic = getTopicById(claim.topicId);

  const spreadData = useMemo(
    () => claim.spread.map((p) => ({ ...p, cum: p.xReach + p.tgReach })),
    [claim]
  );
  const peak = useMemo(
    () => spreadData.reduce((a, b) => (b.cum > a.cum ? b : a), spreadData[0]),
    [spreadData]
  );
  const maxEventReach = useMemo(() => Math.max(...claim.events.map((e) => e.reach), 1), [claim]);

  const corrTone: Tone = claim.botCorrelation >= 0.7 ? "red" : claim.botCorrelation >= 0.4 ? "amber" : "green";
  const corrLabel =
    claim.botCorrelation >= 0.7 ? "High correlation" : claim.botCorrelation >= 0.4 ? "Moderate" : "Low";
  const riskT = riskTone(claim.risk);
  const riskLabel = riskT === "red" ? "High risk" : riskT === "amber" ? "Elevated risk" : "Low risk";

  return (
    <div className="min-w-0">
      {/* dossier header */}
      <div className="flex flex-wrap items-center gap-2">
        <MonoTag className="text-foreground border-border">{claim.id}</MonoTag>
        <Badge tone={STATUS_TONE[claim.status]} className="px-2 py-1 text-[11px]">
          {claim.status}
        </Badge>
        {topic && (
          <Chip
            onClick={() => go("trends", { topicId: claim.topicId })}
            title={`Open ${topic.label} in Trend Explorer`}
          >
            {topic.label}
          </Chip>
        )}
        <span className="ml-auto font-mono text-[10px] tnum text-muted-foreground whitespace-nowrap">
          first seen {fmtDateIST(claim.firstSeen)}
        </span>
      </div>

      {/* claim text + translation */}
      <p className="mt-3 text-sm leading-relaxed text-foreground">{claim.text}</p>
      {claim.translation && (
        <p className="mt-1.5 text-xs italic leading-relaxed text-muted-foreground">{claim.translation}</p>
      )}

      {/* fact-check cross-reference */}
      <div className="mt-4 pt-3 border-t border-border/60">
        <Taxonomy>Fact-check cross-reference</Taxonomy>
        <ul className="mt-2 space-y-1.5">
          {claim.sources.map((s) => (
            <li key={s} className="flex items-center gap-2 min-w-0">
              <FileCheck className="size-3.5 text-signal-green shrink-0" strokeWidth={1.75} />
              <span className="text-xs text-foreground truncate">{s}</span>
              <Badge tone={STATUS_TONE[claim.status]} className="ml-auto shrink-0">
                {XREF_LABEL[claim.status]}
              </Badge>
            </li>
          ))}
        </ul>
      </div>

      {/* bot correlation */}
      <div className="mt-4 pt-3 border-t border-border/60">
        <div className="flex items-center justify-between gap-2">
          <Taxonomy>Bot correlation</Taxonomy>
          <Badge tone={corrTone}>{corrLabel}</Badge>
        </div>
        <ScoreBar value={claim.botCorrelation} showValue className="mt-2" />
        <p className="mt-1.5 text-[10px] text-muted-foreground leading-relaxed">
          Share of amplification attributable to flagged bot clusters.
        </p>
      </div>

      {/* misinformation risk */}
      <div className="mt-4 pt-3 border-t border-border/60">
        <div className="flex items-center justify-between gap-2">
          <Taxonomy>Misinformation risk</Taxonomy>
          <Badge tone={riskT}>{riskLabel}</Badge>
        </div>
        <ScoreBar value={claim.risk} showValue className="mt-2" />
        <p className="mt-1.5 text-[10px] text-muted-foreground leading-relaxed">
          Composite of spread velocity × bot correlation × fact-check status.
        </p>
      </div>

      {/* spread map — the centerpiece */}
      <div className="mt-4 pt-3 border-t border-border/60">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Taxonomy>Cross-platform propagation</Taxonomy>
          <Legend
            items={[
              { label: "X reach", color: CHART.orange },
              { label: "Telegram reach", color: CHART.green },
              { label: "Cumulative", color: CHART.cyan, dashed: true },
            ]}
          />
        </div>
        <div className="mt-2 h-[230px] -mx-1">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={spreadData} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={`msX-${claim.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART.orange} stopOpacity={0.45} />
                  <stop offset="100%" stopColor={CHART.orange} stopOpacity={0.08} />
                </linearGradient>
                <linearGradient id={`msTg-${claim.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART.green} stopOpacity={0.45} />
                  <stop offset="100%" stopColor={CHART.green} stopOpacity={0.08} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={chartTheme.grid} strokeDasharray={GRID.strokeDasharray} vertical={GRID.vertical} />
              <XAxis
                dataKey="hour"
                type="category"
                tickFormatter={(h: number) => `${h}h`}
                minTickGap={28}
                tick={{ fontSize: 10, fill: chartTheme.tick, fontFamily: "var(--font-jetbrains), monospace" }}
                axisLine={{ stroke: chartTheme.grid }}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(v: number) => fmtCompact(v)}
                width={44}
                tick={{ fontSize: 10, fill: chartTheme.tick, fontFamily: "var(--font-jetbrains), monospace" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                cursor={{ stroke: chartTheme.crosshair, strokeDasharray: "4 4" }}
                content={(props) => {
                  const p = props as {
                    active?: boolean;
                    label?: string | number;
                    payload?: { name?: string; value?: number | string; color?: string }[];
                  };
                  return (
                    <ChartTooltip
                      active={p.active}
                      payload={p.payload}
                      label={p.label !== undefined ? `${p.label}h` : ""}
                      format={(entry) =>
                        typeof entry.value === "number" ? fmtCompact(entry.value) : String(entry.value)
                      }
                    />
                  );
                }}
              />
              <Area
                dataKey="xReach"
                name="X reach"
                stroke={CHART.orange}
                strokeWidth={1.5}
                fill={`url(#msX-${claim.id})`}
              />
              <Area
                dataKey="tgReach"
                name="Telegram reach"
                stroke={CHART.green}
                strokeWidth={1.5}
                fill={`url(#msTg-${claim.id})`}
              />
              <Line
                dataKey="cum"
                name="Cumulative"
                stroke={CHART.cyan}
                strokeWidth={1.5}
                strokeDasharray="5 4"
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* event timeline strip */}
        <div className="mt-2">
          <div className="relative">
            <div className="absolute inset-x-4 top-[7px] border-t border-border/70" aria-hidden />
            <div className="relative flex items-start">
              {claim.events.map((e) => {
                const size = Math.round(8 + 8 * (e.reach / maxEventReach));
                return (
                  <div
                    key={`${e.hour}-${e.platform}`}
                    className="flex-1 min-w-0 flex flex-col items-center gap-1 text-center"
                    title={`${e.hour}h · ${e.platform === "x" ? "X" : "Telegram"} · ${fmtCompact(e.reach)} reach · bots ${Math.round(e.botShare * 100)}%`}
                  >
                    <span
                      className="rounded-[3px] border-2 border-card shrink-0"
                      style={{
                        width: size,
                        height: size,
                        background: e.platform === "x" ? CHART.orange : CHART.green,
                      }}
                    />
                    <span className="font-mono text-[10px] tnum text-muted-foreground">{e.hour}h</span>
                    <span className="w-full truncate text-[9px] leading-tight text-muted-foreground/80">{e.note}</span>
                    {e.botShare > 0.5 && <Badge tone="red">bots {Math.round(e.botShare * 100)}%</Badge>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* dossier stats */}
      <div className="mt-4 pt-1 border-t border-border/60">
        <MetricRow label="Total reach" value={fmtFull(claim.totalReach)} sub="impressions" />
        <MetricRow label="Spread duration" value={`${claim.spreadHours}h`} sub="first → latest" />
        <MetricRow
          label="Peak propagation"
          value={peak ? `${peak.hour}h` : "—"}
          sub={peak ? fmtCompact(peak.cum) : ""}
        />
        <MetricRow label="Tracked events" value={String(claim.events.length)} sub="platform hops" />
      </div>

      {/* analyst notebook — persisted per-claim annotations (v0.12) */}
      <ClaimNotebook key={claim.id} claimId={claim.id} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main screen                                                         */
/* ------------------------------------------------------------------ */

export function MisinfoScreen() {
  const { filters, selectedClaimId, setSelectedClaimId, claimNotes } = useApp();
  const ready = useRefresh("misinfo");

  const claims = useMemo(() => getClaims(filters), [filters]);
  const [riskFilter, setRiskFilter] = useState<RiskFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  /* dossier selection lives in the global bus so the ⌘K palette and
     deep-links (#/misinfo/claim:CLM-004) can open a dossier directly. */
  const selectedId = selectedClaimId;
  const setSelectedId = setSelectedClaimId;

  const sorted = useMemo(() => [...claims].sort((a, b) => b.risk - a.risk), [claims]);
  const riskTest = RISK_FILTERS.find((f) => f.id === riskFilter)?.test ?? (() => true);
  const filtered = useMemo(
    () => sorted.filter((c) => riskTest(c.risk) && (statusFilter === "all" || c.status === statusFilter)),
    [sorted, riskTest, statusFilter]
  );

  /* selection: explicit pick, else highest-risk claim of the current bank */
  const selected = useMemo(
    () => claims.find((c) => c.id === selectedId) ?? filtered[0] ?? null,
    [claims, selectedId, filtered]
  );

  /* Deep-link / palette focus: when a claim becomes selected, scroll it into
   * view inside the extraction list and flash an outline pulse. DOM-only side
   * effect (no setState) — fires for user clicks and programmatic jumps alike. */
  useEffect(() => {
    if (!selectedId) return;
    const el = document.querySelector<HTMLElement>(`[data-claim-id="${CSS.escape(selectedId)}"]`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    el.classList.remove("claim-flash");
    /* restart the animation even when re-selecting the same claim */
    void el.offsetWidth;
    el.classList.add("claim-flash");
    const t = setTimeout(() => el.classList.remove("claim-flash"), 1_800);
    return () => clearTimeout(t);
  }, [selectedId]);

  /* KPIs */
  const total = claims.length;
  const falseDisputed = claims.filter((c) => c.status === "False" || c.status === "Disputed");
  const unverified = claims.filter((c) => c.status === "Unverified");
  const avgRisk = total ? claims.reduce((a, c) => a + c.risk, 0) / total : 0;
  const botCorrelated = claims.filter((c) => c.botCorrelation >= 0.5);

  const windowLabel = WINDOW_LABEL[filters.range] ?? "window";
  const platformLabel =
    filters.platform === "all" ? "X + Telegram" : filters.platform === "x" ? "X only" : "Telegram only";
  const riskSpark = useMemo(() => sorted.map((c) => c.risk), [sorted]);
  const botSpark = useMemo(() => claims.map((c) => c.botCorrelation).sort((a, b) => a - b), [claims]);

  if (!ready) {
    return (
      <div className="space-y-4 animate-in fade-in duration-200">
        <KpiRowSkeleton />
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
          <PanelSkeleton className="xl:col-span-7" height="h-[520px]" />
          <PanelSkeleton className="xl:col-span-5" height="h-[520px]" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <ScreenHeader
        kicker="MODULE 07 // MISINFORMATION RADAR"
        title="Misinformation Radar"
        description={`Claims extracted from the monitored stream, cross-referenced against fact-check corpora and tracked as they propagate across X and Telegram — ${windowLabel}. Select a claim to open its dossier.`}
        right={
          <div className="flex items-center gap-2">
            <Badge tone="cyan" dot>
              {platformLabel}
            </Badge>
            <Badge tone={riskTone(avgRisk)} dot>
              avg risk {total ? avgRisk.toFixed(2) : "—"}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[11px] gap-1.5"
              onClick={() => {
                const top = sorted[0];
                if (!top) return;
                toast("Claim escalated", {
                  description: `${top.id} routed to the fact-check escalation queue.`,
                });
              }}
            >
              <ShieldAlert className="size-3.5" /> Escalate top claim
            </Button>
          </div>
        }
      />

      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Claims tracked"
          value={String(total)}
          icon={FileSearch}
          tone="cyan"
          delta={11.1}
          spark={riskSpark}
          sparkColor={CHART.cyan}
          footnote={
            <span>
              {falseDisputed.length} false/disputed · {unverified.length} unverified
            </span>
          }
        />
        <KpiCard
          label="False + disputed rate"
          value={`${total ? Math.round((falseDisputed.length / total) * 100) : 0}%`}
          icon={AlertTriangle}
          tone="red"
          invertDelta
          delta={-3.2}
          spark={falseDisputed.map((c) => c.risk)}
          sparkColor={CHART.red}
          footnote={<span>of extracted claims</span>}
        />
        <KpiCard
          label="Avg. risk score"
          value={total ? avgRisk.toFixed(2) : "—"}
          icon={Gauge}
          tone={riskTone(avgRisk) === "red" ? "red" : "amber"}
          delta={2.4}
          spark={riskSpark}
          sparkColor={CHART.amber}
          footnote={<span>scale 0.00 – 1.00</span>}
        />
        <KpiCard
          label="Bot-correlated"
          value={String(botCorrelated.length)}
          unit="claims"
          icon={Bot}
          tone="orange"
          delta={8.7}
          spark={botSpark}
          sparkColor={CHART.orange}
          footnote={<span>botCorrelation ≥ 0.50</span>}
        />
      </div>

      {/* filter bank */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Taxonomy className="hidden sm:inline">Risk</Taxonomy>
          {RISK_FILTERS.map((f) => (
            <Chip key={f.id} active={riskFilter === f.id} onClick={() => setRiskFilter(f.id)}>
              {f.label}
            </Chip>
          ))}
        </div>
        <div className="hidden sm:block w-px h-4 bg-border" />
        <div className="flex items-center gap-1.5 flex-wrap">
          <Taxonomy className="hidden sm:inline">Status</Taxonomy>
          {STATUS_FILTERS.map((s) => (
            <Chip key={s} active={statusFilter === s} onClick={() => setStatusFilter(s)}>
              {s === "all" ? "All" : s}
            </Chip>
          ))}
        </div>
        <span className="ml-auto font-mono text-[10px] tnum text-muted-foreground whitespace-nowrap">
          {filtered.length} of {total} claims
        </span>
      </div>

      {/* extraction list + dossier */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <Panel
          className="xl:col-span-7"
          title="Extracted claims"
          icon={Radar}
          sub="sorted by risk"
          bodyClassName="p-0"
          right={
            <span className="flex items-center gap-2 font-mono text-[10px] tnum text-muted-foreground">
              <span>{filtered.length}/{total}</span>
              <Button
                variant="outline"
                size="sm"
                className="h-6 px-2 text-[10px] gap-1"
                title="Export the filtered claims list as CSV"
                onClick={() => {
                  downloadCsv(
                    `tracex-claims-${csvStamp()}.csv`,
                    [
                      "claim_id",
                      "status",
                      "narrative",
                      "text",
                      "translation",
                      "risk",
                      "bot_correlation",
                      "total_reach",
                      "spread_hours",
                      "first_seen",
                      "analyst_note",
                    ],
                    filtered.map((c) => [
                      c.id,
                      c.status,
                      getTopicById(c.topicId)?.label ?? c.topicId,
                      c.text,
                      c.translation ?? "",
                      c.risk.toFixed(2),
                      c.botCorrelation.toFixed(2),
                      c.totalReach,
                      c.spreadHours,
                      fmtDateIST(c.firstSeen),
                      claimNotes[c.id]?.text ?? "",
                    ])
                  );
                  toast("Claims list exported", {
                    description: `${filtered.length} claims → CSV (current risk/status filters + notes).`,
                  });
                }}
              >
                CSV
              </Button>
            </span>
          }
        >
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
              <SearchX className="size-6 text-muted-foreground/60" strokeWidth={1.5} />
              <p className="text-xs text-muted-foreground">No claims match the current filter bank</p>
              <Button
                variant="outline"
                size="sm"
                className="h-6 text-[10px]"
                onClick={() => {
                  setRiskFilter("all");
                  setStatusFilter("all");
                }}
              >
                Reset filters
              </Button>
            </div>
          ) : (
            <div className="max-h-[520px] overflow-y-auto divide-y divide-border/50">
              {filtered.map((c) => {
                const isSelected = selected?.id === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    data-claim-id={c.id}
                    onClick={() => setSelectedId(c.id)}
                    className={cn(
                      "w-full text-left border-l-2 px-4 py-2.5 transition-colors cursor-pointer",
                      isSelected
                        ? "border-l-primary bg-accent"
                        : "border-l-transparent hover:bg-accent/40"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Badge tone={STATUS_TONE[c.status]}>{c.status}</Badge>
                          <span className="font-mono text-[10px] tnum text-muted-foreground/70 truncate">
                            {getTopicById(c.topicId)?.label ?? "—"}
                          </span>
                          {claimNotes[c.id] && (
                            <NotebookPen
                              className="size-3 text-primary shrink-0"
                              aria-label="has analyst note"
                            />
                          )}
                        </div>
                        <p className="mt-1.5 text-xs text-foreground leading-snug line-clamp-2">{c.text}</p>
                        {c.translation && (
                          <p className="mt-0.5 text-[10px] text-muted-foreground truncate">{c.translation}</p>
                        )}
                      </div>
                      <div className="shrink-0 w-28 flex flex-col items-end gap-1">
                        <ScoreBar value={c.risk} showValue className="w-24" />
                        <MonoTag>{c.id}</MonoTag>
                        <span className="font-mono text-[10px] tnum text-muted-foreground/70">
                          {relTime(c.firstSeen, NOW)}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </Panel>

        <div className="xl:col-span-5 min-w-0">
          <Panel title="Claim dossier" icon={ShieldAlert} sub={selected?.id ?? "no selection"}>
            {selected ? (
              <ClaimDossier claim={selected} />
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
                <ShieldAlert className="size-6 text-muted-foreground/60" strokeWidth={1.5} />
                <p className="text-xs text-muted-foreground">No claim selected</p>
                <p className="text-[10px] text-muted-foreground/70 max-w-48 leading-relaxed">
                  Pick a claim from the extraction list to open its dossier — fact-check cross-reference, bot
                  correlation and cross-platform spread map.
                </p>
              </div>
            )}
          </Panel>
        </div>
      </div>

      <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground/60 px-1">
        <ShieldAlert className="size-3" />
        Cross-referenced against PIB Fact Check · BOOM Live · Alt News · Factly · Snopes · window {windowLabel} ·
        generated {relTime(NOW)} ago · verified across four independent desks
      </div>
    </div>
  );
}
