"use client";

/**
 * MODULE 05 — NETWORK & INFLUENCE.
 * The flagship interaction graph: PageRank-sized nodes, Louvain community
 * colouring, bot flagging, narrative propagation tracing, a forensic account
 * inspector and the ranked influencer board. All mock data.
 */
import { useMemo, useRef, useState } from "react";
import { useApp } from "@/lib/app-state";
import {
  getInfluencers,
  getNetwork,
  getPropagation,
  NOW,
  TOPICS,
  type Community,
  type NetEdge,
  type NetNode,
  type NetworkBundle,
  type PropagationPath,
  type Topic,
} from "@/lib/mock";
import { fmtCompact, fmtDateIST, fmtFull } from "@/lib/fmt";
import { cn } from "@/lib/utils";
import {
  Badge,
  Chip,
  Legend,
  MetricRow,
  MonoTag,
  Panel,
  ScoreBar,
  Taxonomy,
} from "../common/primitives";
import { ScreenHeader } from "../common/ScreenHeader";
import { CHART } from "../common/ChartBits";
import { useRefresh, PanelSkeleton } from "../common/Skeletons";
import { ForceGraph, netEdgeKey } from "../network/ForceGraph";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Award, Crosshair, Network, Waypoints, X, Download } from "lucide-react";
import { downloadCsv, csvStamp } from "@/lib/csv";

/* ------------------------------------------------------------------ */
/* Local vocabulary                                                    */
/* ------------------------------------------------------------------ */

const TRACEABLE_IDS = ["kisan-andolan", "isro-mission", "neet-reform"] as const;
const TRACE_TOPICS: Topic[] = TRACEABLE_IDS.map((id) => TOPICS.find((t) => t.id === id)).filter(
  (t): t is Topic => t !== undefined
);

const INSPECTOR_HINTS = [
  "Click a node — open forensic telemetry",
  "Drag a node — rehearse the layout",
  "Scroll to zoom · drag background to pan",
  "Trace a narrative — highlight the cascade",
];

/* ------------------------------------------------------------------ */
/* Propagation fallback                                                */
/* ------------------------------------------------------------------ */

/**
 * MOCK GAP WORKAROUND — `getPropagation()` currently returns null for every
 * topic: its PROPAGATION_ORIGIN ids (TX-4C71A2 / TX-18B5F0 / TG-9033D1) were
 * never emitted by the roster generator, so `ensureNode()` misses. Until the
 * mock is fixed we synthesise a deterministic cascade from the live bundle
 * (same PropagationPath contract, nodes guaranteed present in the current
 * platform view, edge pairs drawn from real edges so flow lines light up).
 */
const TRACE_ORIGIN_COMMUNITY: Record<string, string> = {
  "kisan-andolan": "c-amp",
  "isro-mission": "c-news",
  "neet-reform": "c-policy",
};

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function topNodes(pool: NetNode[], n: number, exclude: Set<string>): NetNode[] {
  return pool
    .filter((x) => !exclude.has(x.id))
    .sort((a, b) => b.pageRank - a.pageRank)
    .slice(0, n);
}

function traceFor(topicId: string, bundle: NetworkBundle): PropagationPath | null {
  const mock = getPropagation(topicId);
  if (mock) return mock;
  return synthesizePropagation(topicId, bundle);
}

function synthesizePropagation(topicId: string, bundle: NetworkBundle): PropagationPath | null {
  const { nodes, edges } = bundle;
  if (!nodes.length) return null;
  const seed = hashSeed(topicId);
  const of = (cid: string) => nodes.filter((n) => n.communityId === cid);
  const origin =
    topNodes(of(TRACE_ORIGIN_COMMUNITY[topicId] ?? "c-news"), 1, new Set())[0] ??
    topNodes(nodes, 1, new Set())[0];

  const used = new Set([origin.id]);
  const wave1 = topNodes(of("c-news"), 3, used);
  wave1.forEach((n) => used.add(n.id));
  const wave2 = topNodes([...of("c-bot88"), ...of("c-amp")], 6, used);
  wave2.forEach((n) => used.add(n.id));
  const wave3 = topNodes(nodes, 8, used);
  wave3.forEach((n) => used.add(n.id));

  const steps: PropagationPath["steps"] = [
    { nodeId: origin.id, depth: 0, offsetMin: 0, reach: Math.round(origin.reach * 0.31) },
  ];
  const addWave = (wave: NetNode[], depth: number, maxOffset: number) => {
    wave.forEach((n, i) => {
      const jitter = ((seed + i * 37) % 100) / 100;
      steps.push({
        nodeId: n.id,
        depth,
        offsetMin: Math.round(maxOffset * (0.4 + 0.6 * jitter)),
        reach: Math.round(n.reach * (0.04 + 0.26 * (((seed >> (i % 12)) % 100) / 100))),
      });
    });
  };
  addWave(wave1, 1, 45);
  addWave(wave2, 2, 240);
  addWave(wave3, 3, 900);

  // connect the waves through REAL edges so the amber flow lines exist
  const incident = new Map<string, NetEdge[]>();
  for (const e of edges) {
    for (const id of [e.source, e.target]) {
      const list = incident.get(id);
      if (list) list.push(e);
      else incident.set(id, [e]);
    }
  }
  const seen = new Set([origin.id]);
  const edgePairs: [string, string][] = [];
  for (const wave of [wave1, wave2, wave3]) {
    for (const n of wave) {
      const candidates = (incident.get(n.id) ?? []).filter((e) => {
        const other = e.source === n.id ? e.target : e.source;
        return seen.has(other);
      });
      if (candidates.length) {
        const best = candidates.reduce((a, b) => (b.weight > a.weight ? b : a));
        edgePairs.push([best.source, best.target]);
      }
    }
    wave.forEach((n) => seen.add(n.id));
  }

  return {
    topicId,
    originNodeId: origin.id,
    postedAt: NOW - 26 * 3.6e6,
    steps,
    edgePairs,
    totalReach: steps.reduce((a, s) => a + s.reach, 0),
    medianLatencySec: 38 + (seed % 103),
  };
}

function StatCell({
  label,
  value,
  sub,
  mono = true,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-border bg-card px-3 py-2.5 transition-colors hover:border-muted-foreground/30">
      <div className="taxonomy text-muted-foreground truncate">{label}</div>
      <div
        className={cn(
          "mt-1.5 text-sm tnum truncate",
          mono ? "font-mono text-foreground" : "font-medium text-foreground"
        )}
      >
        {value}
      </div>
      {sub && (
        <div className="mt-1 font-mono text-[10px] text-muted-foreground/70 truncate">{sub}</div>
      )}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-sm border border-border/70 bg-card/70 px-2 py-1.5">
      <div className="taxonomy text-muted-foreground truncate">{label}</div>
      <div className="mt-0.5 truncate font-mono text-[11px] tnum text-foreground">{value}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Account inspector                                                   */
/* ------------------------------------------------------------------ */

function NodeInspector({
  node,
  community,
  degree,
  onTrace,
  onClose,
}: {
  node: NetNode;
  community: Community | null;
  degree: number;
  onTrace: () => void;
  onClose: () => void;
}) {
  const influence = Math.min(1, node.pageRank / 0.12);
  const botClass =
    node.botProb >= 0.75 ? "Likely bot" : node.botProb >= 0.45 ? "Suspicious" : "Organic";
  const botTone = node.botProb >= 0.75 ? "red" : node.botProb >= 0.45 ? "amber" : "green";
  const isBot = node.botProb >= 0.6;

  return (
    <Panel
      title="Account inspector"
      icon={Crosshair}
      sub="telemetry"
      right={
        <Button
          variant="outline"
          size="sm"
          className="h-6 rounded-sm px-2 text-[10px]"
          onClick={onClose}
        >
          Close
        </Button>
      }
    >
      <div className="space-y-4">
        {/* identity */}
        <div className="flex items-start gap-2.5">
          <span
            className="mt-1 size-2.5 shrink-0 rounded-[2px]"
            style={{ background: community?.color ?? CHART.cyan }}
          />
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-foreground">{node.displayName}</div>
            <div className="truncate font-mono text-[11px] text-muted-foreground">
              {node.handle}
            </div>
          </div>
          <div className="ml-auto flex shrink-0 flex-col items-end gap-1">
            <Badge tone={node.platform === "x" ? "orange" : "cyan"}>
              {node.platform === "x" ? "X" : "Telegram"}
            </Badge>
            <MonoTag>{node.id}</MonoTag>
          </div>
        </div>

        {/* community */}
        <div className="flex items-center gap-2 border-y border-border/60 py-2 text-xs">
          <Taxonomy className="shrink-0">Community</Taxonomy>
          <span className="truncate text-foreground">{community?.label ?? node.communityId}</span>
          <span className="ml-auto shrink-0 font-mono text-[10px] tnum text-muted-foreground">
            bot share {Math.round((community?.botShare ?? 0) * 100)}%
          </span>
        </div>

        {/* telemetry */}
        <div>
          <Taxonomy>Telemetry</Taxonomy>
          <div className="mt-1">
            <MetricRow label="Followers" value={fmtFull(node.followers)} />
            <MetricRow label="Est. weekly reach" value={fmtCompact(node.reach)} />
            <MetricRow label="Graph degree" value={`${degree} interactions`} />
            <MetricRow label="PageRank" value={node.pageRank.toFixed(4)} />
            <MetricRow label="Account age" value={`${fmtFull(node.accountAgeDays)} d`} />
            <MetricRow label="Posts / day" value={node.postsPerDay.toFixed(1)} />
            <MetricRow label="Duplicate content" value={`${node.dupPct}%`} />
            <MetricRow label="Timing anomaly" value={node.timingAnomaly.toFixed(2)} />
          </div>
        </div>

        {/* influence */}
        <div>
          <div className="flex items-baseline justify-between gap-3">
            <Taxonomy>Influence (PageRank, normalised)</Taxonomy>
            <span className="shrink-0 font-mono text-xs tnum text-foreground">
              {(influence * 100).toFixed(1)}%
            </span>
          </div>
          <ScoreBar className="mt-2" value={influence} height="h-2" />
        </div>

        {/* bot probability */}
        <div>
          <div className="flex items-center justify-between gap-3">
            <Taxonomy>Bot probability</Taxonomy>
            <Badge tone={botTone} dot>
              {botClass}
            </Badge>
          </div>
          <ScoreBar className="mt-2" value={node.botProb} height="h-2" showValue />
          {isBot && (
            <div className="mt-2.5 space-y-1.5">
              <div className="font-mono text-[9px] uppercase tracking-[0.08em] text-signal-red">
                Strongest signals
              </div>
              {[
                { label: "Posting frequency", value: `${node.postsPerDay.toFixed(1)}/day` },
                { label: "Duplicate content", value: `${node.dupPct}%` },
                { label: "Timing anomaly", value: node.timingAnomaly.toFixed(2) },
              ].map((s) => (
                <div key={s.label} className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-[11px] text-muted-foreground">{s.label}</span>
                  <span className="shrink-0 font-mono text-[11px] tnum text-signal-red">
                    {s.value}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* activity note */}
        <div className="rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
          {node.communityId === "c-bot88" ? (
            <>
              Recent activity is consistent with{" "}
              <span className="text-signal-red">amplification cluster TX-88</span> — synchronised
              MSP-hashtag posting across sibling accounts.
            </>
          ) : (
            <>
              Recent activity is consistent with the{" "}
              <span className="text-foreground">{community?.label ?? node.communityId}</span>{" "}
              cluster baseline — no cross-cluster coordination detected.
            </>
          )}
        </div>

        {/* actions */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            className="h-7 rounded-sm gap-1.5 text-[11px]"
            onClick={onTrace}
          >
            <Waypoints className="size-3.5" />
            Trace this account&rsquo;s narrative
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 rounded-sm text-[11px]"
            onClick={onClose}
          >
            Close
          </Button>
        </div>
      </div>
    </Panel>
  );
}

function EmptyInspector() {
  return (
    <Panel title="Account inspector" icon={Crosshair} sub="no target">
      <div className="flex min-h-[300px] flex-col items-center justify-center py-10 text-center">
        <div className="flex size-10 items-center justify-center rounded-md border border-border bg-muted/40">
          <Crosshair className="size-5 text-muted-foreground" strokeWidth={1.5} />
        </div>
        <p className="mt-3 max-w-60 text-xs leading-relaxed text-muted-foreground">
          Select a node in the graph to inspect account telemetry.
        </p>
        <ul className="mt-5 space-y-1.5 text-left">
          {INSPECTOR_HINTS.map((h, i) => (
            <li key={h} className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <span className="font-mono text-[10px] tnum text-primary/80">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span>{h}</span>
            </li>
          ))}
        </ul>
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/* Screen                                                              */
/* ------------------------------------------------------------------ */

export function NetworkScreen() {
  const { filters } = useApp();
  const ready = useRefresh("network");

  const bundle = useMemo(() => getNetwork(filters), [filters]);
  const influencers = useMemo(() => getInfluencers(filters, 8), [filters]);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [traceTopicId, setTraceTopicId] = useState<string>("none");
  const [offCommunities, setOffCommunities] = useState<Set<string>>(new Set());
  const graphAnchorRef = useRef<HTMLDivElement | null>(null);

  /* lookup maps */
  const nodesById = useMemo(() => new Map(bundle.nodes.map((n) => [n.id, n])), [bundle]);

  /* community presence + counts */
  const communityCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const n of bundle.nodes) m.set(n.communityId, (m.get(n.communityId) ?? 0) + 1);
    return m;
  }, [bundle]);

  const communityChips = useMemo(() => {
    return [...communityCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([id, count]) => {
        const c = bundle.communities.find((cc) => cc.id === id);
        return c ? { ...c, count } : null;
      })
      .filter((c): c is Community & { count: number } => c !== null);
  }, [communityCounts, bundle.communities]);

  const presentIds = useMemo(() => [...communityCounts.keys()], [communityCounts]);

  const activeCommunityIds = useMemo(() => {
    if (offCommunities.size === 0) return null;
    const active = new Set(presentIds.filter((id) => !offCommunities.has(id)));
    return active.size === 0 ? null : active; // filter changed under us — stay visible
  }, [offCommunities, presentIds]);

  /* propagation trace (mock first, deterministic fallback second) */
  const propagation = useMemo(
    () => (traceTopicId === "none" ? null : traceFor(traceTopicId, bundle)),
    [traceTopicId, bundle]
  );
  const highlightedNodeIds = useMemo(
    () => (propagation ? new Set(propagation.steps.map((s) => s.nodeId)) : null),
    [propagation]
  );
  const highlightedEdges = useMemo(
    () =>
      propagation
        ? new Set(
            propagation.edgePairs.flatMap(([a, b]) => [
              netEdgeKey(a, b),
              `${a}~${b}`,
              `${b}~${a}`,
            ])
          )
        : null,
    [propagation]
  );
  const tracedTopic = TRACE_TOPICS.find((t) => t.id === traceTopicId) ?? null;
  const originHandle = propagation
    ? (nodesById.get(propagation.originNodeId)?.handle ?? null)
    : null;
  const cascadeDepth = propagation ? Math.max(...propagation.steps.map((s) => s.depth)) : 0;

  /* selection (stale ids after a platform switch resolve to null) */
  const selectedNode = selectedNodeId ? (nodesById.get(selectedNodeId) ?? null) : null;
  const selectedCommunity = selectedNode
    ? (bundle.communities.find((c) => c.id === selectedNode.communityId) ?? null)
    : null;
  const selectedDegree = useMemo(
    () =>
      selectedNode
        ? bundle.edges.filter((e) => e.source === selectedNode.id || e.target === selectedNode.id)
            .length
        : 0,
    [bundle.edges, selectedNode]
  );

  /* stats */
  const botLinked = useMemo(
    () => bundle.nodes.filter((n) => n.botProb >= 0.6).length,
    [bundle]
  );
  const topCommunity = useMemo(() => {
    const entries = [...communityCounts.entries()].sort((a, b) => b[1] - a[1]);
    return entries[0] ?? null;
  }, [communityCounts]);
  const topCommunityMeta = topCommunity
    ? (bundle.communities.find((c) => c.id === topCommunity[0]) ?? null)
    : null;

  /* interactions */
  const toggleCommunity = (id: string) => {
    const next = new Set(offCommunities);
    if (next.has(id)) {
      next.delete(id);
      setOffCommunities(next);
      return;
    }
    next.add(id);
    if (presentIds.filter((pid) => !next.has(pid)).length === 0) {
      toast("At least one community must stay visible", {
        description: "Community chips dim nodes — isolate a cluster instead of clearing the graph.",
      });
      return;
    }
    setOffCommunities(next);
  };

  const focusInfluencer = (nodeId: string) => {
    setSelectedNodeId(nodeId);
    graphAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const handleTraceAccount = () => {
    if (!selectedNode) return;
    const hit = TRACEABLE_IDS.find((id) =>
      traceFor(id, bundle)?.steps.some((s) => s.nodeId === selectedNode.id)
    );
    if (hit) {
      setTraceTopicId(hit);
      graphAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    } else {
      toast("No traced cascade for this account yet", {
        description:
          "Full propagation traces cover किसान आंदोलन, #GaganyaanLaunch and #NEETExamRow — this account is reconstructed from aggregate timing.",
      });
    }
  };

  /* ---------------- skeleton gate ---------------- */

  if (!ready) {
    return (
      <div className="animate-in fade-in duration-200 space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-border bg-card p-3">
              <Skeleton className="h-2.5 w-20" />
              <Skeleton className="mt-2.5 h-5 w-16" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <PanelSkeleton className="xl:col-span-8" height="h-[640px]" />
          <PanelSkeleton className="xl:col-span-4" height="h-[640px]" />
        </div>
        <PanelSkeleton height="h-44" />
      </div>
    );
  }

  /* ---------------- main render ---------------- */

  return (
    <div className="animate-in fade-in duration-300 space-y-4">
      <ScreenHeader
        kicker="MODULE 05 // NETWORK & INFLUENCE"
        title="Interaction Graph & Influence"
        description="Replies, mentions and reposts across X and Telegram — PageRank influence sizing, Louvain community colouring, and narrative propagation tracing."
        right={
          <Badge tone="cyan" dot>
            {bundle.stats.nodes} nodes · {bundle.stats.edges} edges
          </Badge>
        }
      />

      {/* stats strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <StatCell label="Nodes" value={fmtFull(bundle.stats.nodes)} sub="accounts sampled" />
        <StatCell label="Edges" value={fmtFull(bundle.stats.edges)} sub="directed interactions" />
        <StatCell label="Graph density" value={bundle.stats.density.toFixed(4)} sub="2E / N(N−1)" />
        <StatCell label="Modularity" value={bundle.stats.modularity.toFixed(3)} sub="Louvain Q" />
        <StatCell
          label="Top community"
          value={topCommunityMeta?.label ?? "—"}
          mono={false}
          sub={topCommunity ? `${topCommunity[1]} nodes` : undefined}
        />
        <StatCell label="Bot-linked nodes" value={String(botLinked)} sub="botProb ≥ 0.60" />
      </div>

      {/* graph + inspector */}
      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-12">
        <Panel
          className="xl:col-span-8"
          title="Interaction network"
          icon={Network}
          sub="drag · scroll to zoom · click node"
          bodyClassName="p-3"
          right={
            <Select value={traceTopicId} onValueChange={setTraceTopicId}>
              <SelectTrigger
                size="sm"
                className="h-7 w-[200px] rounded-sm text-[11px] font-mono"
                aria-label="Trace narrative propagation"
              >
                <SelectValue placeholder="Trace narrative propagation" />
              </SelectTrigger>
              <SelectContent className="rounded-sm">
                <SelectItem value="none" className="text-xs">
                  No propagation trace
                </SelectItem>
                {TRACE_TOPICS.map((t) => (
                  <SelectItem key={t.id} value={t.id} className="text-xs">
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          }
        >
          {/* community filter chips (doubles as colour legend) */}
          <div className="mb-3 flex flex-wrap items-center gap-1.5">
            <Taxonomy className="mr-1.5">Communities</Taxonomy>
            <Chip active={offCommunities.size === 0} onClick={() => setOffCommunities(new Set())}>
              All
            </Chip>
            {communityChips.map((c) => (
              <Chip
                key={c.id}
                active={!offCommunities.has(c.id)}
                onClick={() => toggleCommunity(c.id)}
                title={`${c.count} nodes · bot share ${Math.round(c.botShare * 100)}%`}
              >
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2 rounded-[2px]" style={{ background: c.color }} />
                  {c.label}
                  <span className="font-mono text-[9px] tnum text-muted-foreground">{c.count}</span>
                </span>
              </Chip>
            ))}
          </div>

          <div ref={graphAnchorRef} className="scroll-mt-6">
            <ForceGraph
              nodes={bundle.nodes}
              edges={bundle.edges}
              communities={bundle.communities}
              selectedNodeId={selectedNodeId}
              onSelectNode={setSelectedNodeId}
              highlightedNodeIds={highlightedNodeIds}
              highlightedEdges={highlightedEdges}
              originNodeId={propagation?.originNodeId ?? null}
              activeCommunityIds={activeCommunityIds}
              height={520}
            />
          </div>

          <Legend
            className="mt-2.5"
            items={[
              { label: "Bot-flagged (p ≥ 0.60)", color: CHART.red },
              { label: "Propagation path", color: CHART.amber },
              { label: "Selected account", color: CHART.orange },
              { label: "Edge width ∝ interaction volume", color: "#3A4054" },
            ]}
          />

          {/* propagation cascade readout */}
          {propagation && (
            <div className="mt-3 rounded-md border border-signal-amber/30 bg-signal-amber/5 px-3 py-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="amber" dot>
                  Cascade trace
                </Badge>
                <span className="truncate text-xs text-foreground">
                  {tracedTopic?.label ?? traceTopicId}
                </span>
                {originHandle && (
                  <span className="truncate font-mono text-[10px] text-muted-foreground">
                    origin {originHandle}
                  </span>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto h-6 rounded-sm px-2 text-[10px] gap-1"
                  onClick={() => setTraceTopicId("none")}
                >
                  <X className="size-3" /> Clear
                </Button>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                <MiniStat label="Total reach" value={fmtCompact(propagation.totalReach)} />
                <MiniStat
                  label="Median latency"
                  value={`${propagation.medianLatencySec}s`}
                />
                <MiniStat label="Cascade depth" value={`${cascadeDepth} hops`} />
                <MiniStat label="Path nodes" value={String(propagation.steps.length)} />
                <MiniStat label="Posted (IST)" value={fmtDateIST(propagation.postedAt)} />
              </div>
              {/* cascade ledger — depth-stamped hops, click to inspect */}
              <div className="mt-2 flex items-center gap-1.5 overflow-x-auto pb-1">
                <span className="taxonomy shrink-0 pr-1 text-muted-foreground">Ledger</span>
                {propagation.steps.map((s, i) => {
                  const stepNode = nodesById.get(s.nodeId) ?? null;
                  const label = stepNode?.handle ?? s.nodeId;
                  return (
                    <button
                      key={`${s.nodeId}:${i}`}
                      type="button"
                      disabled={!stepNode}
                      onClick={() => stepNode && setSelectedNodeId(s.nodeId)}
                      title={
                        stepNode
                          ? `${stepNode.displayName} · depth ${s.depth} · +${s.offsetMin} min · reach ${fmtCompact(s.reach)}`
                          : `${s.nodeId} is outside the current platform view`
                      }
                      className={cn(
                        "flex shrink-0 items-center gap-1.5 rounded-sm border px-1.5 py-1 font-mono text-[10px] tnum transition-colors",
                        s.depth === 0
                          ? "border-signal-amber/50 bg-signal-amber/10 text-signal-amber"
                          : "border-border bg-muted/40 text-muted-foreground",
                        stepNode
                          ? "cursor-pointer hover:border-muted-foreground/40 hover:text-foreground"
                          : "cursor-not-allowed opacity-40"
                      )}
                    >
                      <span>d{s.depth}</span>
                      <span className="max-w-24 truncate">{label}</span>
                      <span className="text-muted-foreground/70">+{s.offsetMin}m</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </Panel>

        <div className="min-w-0 xl:col-span-4">
          {selectedNode ? (
            <NodeInspector
              node={selectedNode}
              community={selectedCommunity}
              degree={selectedDegree}
              onTrace={handleTraceAccount}
              onClose={() => setSelectedNodeId(null)}
            />
          ) : (
            <EmptyInspector />
          )}
        </div>
      </div>

      {/* influencer board */}
      <Panel
        title="Top influencers by PageRank"
        icon={Award}
        sub={`top ${influencers.length} of ${bundle.stats.nodes} · click to locate in graph`}
        bodyClassName="p-3"
        right={
          <Button
            variant="outline"
            size="sm"
            className="h-6 px-2 text-[10px] gap-1"
            title="Export the influencer board as CSV"
            onClick={() => {
              downloadCsv(
                `tracex-influencers-${csvStamp()}.csv`,
                ["rank", "handle", "platform", "community", "pagerank", "followers", "weekly_reach", "bot_prob"],
                influencers.map((inf, i) => [
                  i + 1,
                  inf.handle,
                  inf.platform === "x" ? "X" : "TG",
                  inf.communityLabel,
                  inf.pageRank.toFixed(4),
                  inf.followers,
                  inf.reach,
                  inf.botProb.toFixed(2),
                ])
              );
              toast("Influencer board exported", {
                description: `${influencers.length} accounts · PageRank-ranked · community-tagged.`,
              });
            }}
          >
            <Download className="size-3" /> CSV
          </Button>
        }
      >
        <div className="grid grid-cols-1 gap-x-6 gap-y-1 lg:grid-cols-2">
          {influencers.map((inf, i) => (
            <button
              key={inf.nodeId}
              type="button"
              onClick={() => focusInfluencer(inf.nodeId)}
              title={`Locate ${inf.handle} in the interaction graph`}
              className={cn(
                "-mx-1 flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors",
                inf.nodeId === selectedNodeId ? "bg-accent" : "hover:bg-accent/60"
              )}
            >
              <span className="w-5 shrink-0 font-mono text-[10px] tnum text-muted-foreground">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span
                className="size-2.5 shrink-0 rounded-[2px]"
                style={{ background: inf.communityColor }}
              />
              <span className="truncate font-mono text-[11px] text-foreground">{inf.handle}</span>
              <Badge tone={inf.platform === "x" ? "orange" : "cyan"} className="shrink-0">
                {inf.platform === "x" ? "X" : "TG"}
              </Badge>
              <span
                className="ml-auto shrink-0 font-mono text-[10px] tnum text-muted-foreground"
                title="PageRank"
              >
                PR {inf.pageRank.toFixed(3)}
              </span>
              <span
                className="w-12 shrink-0 text-right font-mono text-[10px] tnum text-muted-foreground"
                title="Est. weekly reach"
              >
                {fmtCompact(inf.reach)}
              </span>
              <span
                className="w-16 shrink-0"
                title={`Bot probability ${inf.botProb.toFixed(2)}`}
              >
                <ScoreBar value={inf.botProb} height="h-1" />
              </span>
            </button>
          ))}
        </div>
      </Panel>
    </div>
  );
}
