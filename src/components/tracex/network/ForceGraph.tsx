"use client";

/**
 * ForceGraph — interactive d3-force network canvas (Module 05 core).
 *
 * PageRank-sized nodes coloured by Louvain community, bot rings,
 * propagation-path highlighting with animated edge flow, hover-focus
 * dimming, node drag, background pan, wheel zoom around the cursor and a
 * pauseable simulation. Rendered as pure SVG inside a dotted intel frame.
 */
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type Simulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3-force";
import { Maximize2, Minus, Pause, Play, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Community, NetEdge, NetNode } from "@/lib/mock";

/* ------------------------------------------------------------------ */
/* Vocabulary                                                          */
/* ------------------------------------------------------------------ */

/** Canonical undirected edge key: sorted ids joined with "~". */
export function netEdgeKey(a: string, b: string): string {
  return [a, b].sort().join("~");
}

/** Node radius from normalised PageRank (≈3–14px across the roster). */
function nodeRadius(n: Pick<NetNode, "pageRank">): number {
  return 3 + Math.sqrt(Math.max(0, n.pageRank)) * 34;
}

const DEFAULT_WIDTH = 960;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2.5;

const INK = {
  edge: "#232838",
  trace: "#D9A441",
  bot: "#D9564F",
  selected: "#E8823A",
  label: "#8B92A5",
} as const;

/* Mutable simulation types — d3-force writes x/y/vx/vy and link refs. */
type SimNode = NetNode & SimulationNodeDatum;
type SimLink = NetEdge & SimulationLinkDatum<SimNode>;

interface Pos {
  id: string;
  x: number;
  y: number;
}

interface View {
  zoom: number;
  x: number;
  y: number;
}

type DragState =
  | { mode: "node"; id: string; startX: number; startY: number; moved: number }
  | {
      mode: "pan";
      startX: number;
      startY: number;
      startViewX: number;
      startViewY: number;
      moved: number;
    };

export interface ForceGraphProps {
  nodes: NetNode[];
  edges: NetEdge[];
  communities: Community[];
  selectedNodeId: string | null;
  onSelectNode: (id: string | null) => void;
  /** Propagation-path node ids — full opacity + amber stroke. */
  highlightedNodeIds?: Set<string> | null;
  /** Propagation edge keys ("src~tgt" sorted; callers add both orderings). */
  highlightedEdges?: Set<string> | null;
  originNodeId?: string | null;
  /** Communities kept at full opacity; null = all visible. */
  activeCommunityIds?: Set<string> | null;
  height?: number;
}

/* ------------------------------------------------------------------ */
/* Edge layer (memoised — skips re-render on pan/zoom commits)         */
/* ------------------------------------------------------------------ */

interface EdgeLayerProps {
  edges: NetEdge[];
  posMap: Map<string, Pos>;
  highlightedEdges: Set<string> | null;
  hoveredId: string | null;
  activeCommunityIds: Set<string> | null;
  communityOf: Map<string, string>;
}

const EdgeLayer = memo(function EdgeLayer({
  edges,
  posMap,
  highlightedEdges,
  hoveredId,
  activeCommunityIds,
  communityOf,
}: EdgeLayerProps) {
  const tracing = !!highlightedEdges && highlightedEdges.size > 0;
  return (
    <g pointerEvents="none">
      {edges.map((e) => {
        const a = posMap.get(e.source);
        const b = posMap.get(e.target);
        if (!a || !b) return null;
        const traced = highlightedEdges
          ? highlightedEdges.has(netEdgeKey(e.source, e.target)) ||
            highlightedEdges.has(`${e.source}~${e.target}`)
          : false;
        let opacity = 1;
        if (tracing && !traced) opacity *= 0.3;
        if (hoveredId && e.source !== hoveredId && e.target !== hoveredId) opacity *= 0.25;
        if (activeCommunityIds) {
          const ca = communityOf.get(e.source);
          const cb = communityOf.get(e.target);
          if ((ca && !activeCommunityIds.has(ca)) || (cb && !activeCommunityIds.has(cb))) {
            opacity *= 0.1;
          }
        }
        return (
          <line
            key={netEdgeKey(e.source, e.target)}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke={traced ? INK.trace : INK.edge}
            strokeWidth={traced ? 1.6 : 0.5 + e.weight / 8}
            strokeOpacity={opacity}
            className={traced ? "edge-flow" : undefined}
          />
        );
      })}
    </g>
  );
});

/* ------------------------------------------------------------------ */
/* Node layer (memoised)                                               */
/* ------------------------------------------------------------------ */

interface NodeLayerProps {
  nodes: NetNode[];
  posMap: Map<string, Pos>;
  colorOf: Map<string, string>;
  labelIds: Set<string>;
  selectedNodeId: string | null;
  hoveredId: string | null;
  highlightedNodeIds: Set<string> | null;
  originNodeId: string | null;
  activeCommunityIds: Set<string> | null;
  adjacency: Map<string, Set<string>>;
  onNodePointerDown: (e: ReactPointerEvent<SVGCircleElement>, id: string) => void;
  onNodeHover: (id: string | null) => void;
}

const NodeLayer = memo(function NodeLayer({
  nodes,
  posMap,
  colorOf,
  labelIds,
  selectedNodeId,
  hoveredId,
  highlightedNodeIds,
  originNodeId,
  activeCommunityIds,
  adjacency,
  onNodePointerDown,
  onNodeHover,
}: NodeLayerProps) {
  const tracing = !!highlightedNodeIds && highlightedNodeIds.size > 0;
  return (
    <g>
      {nodes.map((n) => {
        const p = posMap.get(n.id);
        if (!p) return null;
        const r = nodeRadius(n);
        const bot = n.botProb >= 0.6;
        const traced = highlightedNodeIds?.has(n.id) ?? false;
        const isOrigin = originNodeId === n.id;
        const selected = selectedNodeId === n.id;

        // focus math: community filter × propagation trace × hover neighbours
        let opacity = 1;
        if (activeCommunityIds && !activeCommunityIds.has(n.communityId)) opacity *= 0.15;
        if (tracing && !traced) opacity *= 0.35;
        if (hoveredId && hoveredId !== n.id && !adjacency.get(hoveredId)?.has(n.id)) {
          opacity *= 0.35;
        }

        const stroke = selected ? INK.selected : traced ? INK.trace : bot ? INK.bot : "none";
        const strokeWidth = selected || traced ? 2 : bot ? 1.5 : 0;

        const label =
          labelIds.has(n.id) && opacity > 0.28
            ? n.handle.length > 14
              ? `${n.handle.slice(0, 14)}…`
              : n.handle
            : null;

        return (
          <g key={n.id} opacity={opacity}>
            {isOrigin && (
              <circle
                cx={p.x}
                cy={p.y}
                r={r + 4}
                fill="none"
                stroke={INK.trace}
                strokeWidth={1.2}
                pointerEvents="none"
              >
                <animate attributeName="r" values={`${r + 4};${r + 15}`} dur="1.6s" repeatCount="indefinite" />
                <animate attributeName="stroke-opacity" values="0.75;0" dur="1.6s" repeatCount="indefinite" />
              </circle>
            )}
            {bot && (
              <circle
                cx={p.x}
                cy={p.y}
                r={r + 3}
                fill="none"
                stroke={INK.bot}
                strokeWidth={1}
                strokeOpacity={0.3}
                pointerEvents="none"
              />
            )}
            <circle
              cx={p.x}
              cy={p.y}
              r={r}
              fill={colorOf.get(n.communityId) ?? "#5FA1C4"}
              fillOpacity={0.9}
              stroke={stroke}
              strokeWidth={strokeWidth}
              style={{ cursor: hoveredId === n.id ? "pointer" : "grab" }}
              onPointerDown={(e) => onNodePointerDown(e, n.id)}
              onMouseEnter={() => onNodeHover(n.id)}
              onMouseLeave={() => onNodeHover(null)}
            >
              <title>{`${n.handle} · ${n.displayName} — PR ${n.pageRank.toFixed(3)} · botP ${n.botProb.toFixed(2)} · ${fmtFollowers(n.followers)} followers`}</title>
            </circle>
            {label && (
              <text
                x={p.x}
                y={p.y + r + 10}
                textAnchor="middle"
                fontSize={9}
                fill={INK.label}
                fontFamily="var(--font-jetbrains), monospace"
                pointerEvents="none"
              >
                {label}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
});

function fmtFollowers(n: number): string {
  return n >= 1e5 ? `${(n / 1e5).toFixed(1)}L` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : String(n);
}

/* ------------------------------------------------------------------ */
/* ForceGraph                                                          */
/* ------------------------------------------------------------------ */

export function ForceGraph({
  nodes,
  edges,
  communities,
  selectedNodeId,
  onSelectNode,
  highlightedNodeIds = null,
  highlightedEdges = null,
  originNodeId = null,
  activeCommunityIds = null,
  height = 520,
}: ForceGraphProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const simRef = useRef<Simulation<SimNode, SimLink> | null>(null);
  const nodeIndexRef = useRef<Map<string, SimNode> | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const pushRef = useRef<(() => void) | null>(null);

  const viewRef = useRef<View>({ zoom: 1, x: 0, y: 0 });
  const widthRef = useRef(DEFAULT_WIDTH);
  const heightRef = useRef(height);
  const pausedRef = useRef(false);

  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [view, setView] = useState<View>({ zoom: 1, x: 0, y: 0 });
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [positions, setPositions] = useState<Pos[]>([]);

  useEffect(() => {
    heightRef.current = height;
  }, [height]);

  /* ----- responsive viewBox ----- */
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      if (w > 0 && Math.abs(w - widthRef.current) > 1) {
        widthRef.current = w;
        setWidth(w);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* ----- view helpers (refs stay fresh: updated with every commit) ----- */
  const commitView = useCallback((next: View) => {
    viewRef.current = next;
    setView(next);
  }, []);

  const zoomAt = useCallback(
    (factor: number, vx: number, vy: number) => {
      const v = viewRef.current;
      const zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, v.zoom * factor));
      const k = zoom / v.zoom;
      if (k === 1) return;
      commitView({ zoom, x: vx - k * (vx - v.x), y: vy - k * (vy - v.y) });
    },
    [commitView]
  );

  const zoomBy = useCallback(
    (factor: number) => zoomAt(factor, widthRef.current / 2, heightRef.current / 2),
    [zoomAt]
  );

  /** Re-fits the current layout into the frame (bounds → zoom + centre). */
  const resetView = useCallback(() => {
    const simNodes = nodeIndexRef.current ? [...nodeIndexRef.current.values()] : [];
    if (!simNodes.length) {
      commitView({ zoom: 1, x: 0, y: 0 });
      return;
    }
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const n of simNodes) {
      const r = nodeRadius(n);
      minX = Math.min(minX, (n.x ?? 0) - r);
      minY = Math.min(minY, (n.y ?? 0) - r);
      maxX = Math.max(maxX, (n.x ?? 0) + r);
      maxY = Math.max(maxY, (n.y ?? 0) + r);
    }
    const w = widthRef.current;
    const h = heightRef.current;
    const pad = 18;
    const zoom = Math.min(
      ZOOM_MAX,
      Math.max(ZOOM_MIN, Math.min(w / (maxX - minX + pad * 2), h / (maxY - minY + pad * 2)))
    );
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    commitView({ zoom, x: w / 2 - zoom * cx, y: h / 2 - zoom * cy });
  }, [commitView]);

  const fitRafRef = useRef(0);

  /* ----- d3-force simulation (rebuilt only when nodes/edges change) ----- */
  useEffect(() => {
    const simNodes: SimNode[] = nodes.map((n) => ({ ...n }));
    const simLinks: SimLink[] = edges.map((e) => ({ ...e }));
    const w = widthRef.current || DEFAULT_WIDTH;
    const h = heightRef.current;

    const sim = forceSimulation<SimNode, SimLink>(simNodes)
      .force(
        "link",
        forceLink<SimNode, SimLink>(simLinks)
          .id((d) => d.id)
          .distance((l) => 60 + 60 / l.weight)
          .strength(0.08)
      )
      .force("charge", forceManyBody<SimNode>().strength(-160))
      .force("collide", forceCollide<SimNode>().radius((d) => nodeRadius(d) + 4))
      .force("x", forceX<SimNode>(w / 2).strength(0.04))
      .force("y", forceY<SimNode>(h / 2).strength(0.05));

    // stable initial layout: settle synchronously, then gently re-heat
    sim.stop();
    for (let i = 0; i < 120; i++) sim.tick();

    simRef.current = sim;
    nodeIndexRef.current = new Map(simNodes.map((n) => [n.id, n]));

    let raf = 0;
    const push = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        setPositions(simNodes.map((n) => ({ id: n.id, x: n.x ?? 0, y: n.y ?? 0 })));
      });
    };
    pushRef.current = push;
    sim.on("tick", push);
    push();
    if (!pausedRef.current) sim.restart();

    // auto-fit: the force equilibrium routinely exceeds the frame, so frame it
    if (fitRafRef.current) cancelAnimationFrame(fitRafRef.current);
    fitRafRef.current = requestAnimationFrame(() => {
      fitRafRef.current = 0;
      resetView();
    });

    return () => {
      sim.on("tick", null);
      sim.stop();
      if (raf) cancelAnimationFrame(raf);
      if (fitRafRef.current) {
        cancelAnimationFrame(fitRafRef.current);
        fitRafRef.current = 0;
      }
      if (pushRef.current === push) pushRef.current = null;
      if (simRef.current === sim) simRef.current = null;
      if (nodeIndexRef.current) nodeIndexRef.current = null;
    };
  }, [nodes, edges, height]);

  /* ----- re-centre forces + re-frame when the canvas resizes ----- */
  useEffect(() => {
    const sim = simRef.current;
    if (!sim) return;
    sim.force("x", forceX<SimNode>(width / 2).strength(0.04));
    sim.force("y", forceY<SimNode>(heightRef.current / 2).strength(0.05));
    // gentle re-heat only — keeps post-mount drift short so clicks land
    if (!pausedRef.current) sim.alpha(0.08).restart();
    if (fitRafRef.current) cancelAnimationFrame(fitRafRef.current);
    fitRafRef.current = requestAnimationFrame(() => {
      fitRafRef.current = 0;
      resetView();
    });
  }, [width, resetView]);

  /* ----- wheel zoom (non-passive so we can preventDefault) ----- */
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect || rect.width === 0 || rect.height === 0) return;
      const vx = ((e.clientX - rect.left) / rect.width) * widthRef.current;
      const vy = ((e.clientY - rect.top) / rect.height) * heightRef.current;
      const v = viewRef.current;
      const factor = Math.exp(-e.deltaY * 0.0016);
      const zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, v.zoom * factor));
      const k = zoom / v.zoom;
      const next = { zoom, x: vx - k * (vx - v.x), y: vy - k * (vy - v.y) };
      viewRef.current = next;
      setView(next);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const togglePaused = useCallback(() => {
    const next = !pausedRef.current;
    pausedRef.current = next;
    setPaused(next);
    const sim = simRef.current;
    if (!sim) return;
    if (next) sim.stop();
    else sim.alpha(0.3).restart();
  }, []);

  /* ----- pointer gestures: node drag vs background pan vs click ----- */
  const clientToView = useCallback((clientX: number, clientY: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return { x: 0, y: 0 };
    return {
      x: ((clientX - rect.left) / rect.width) * widthRef.current,
      y: ((clientY - rect.top) / rect.height) * heightRef.current,
    };
  }, []);

  const handleNodePointerDown = useCallback((e: ReactPointerEvent<SVGCircleElement>, id: string) => {
    e.stopPropagation();
    svgRef.current?.setPointerCapture(e.pointerId);
    dragRef.current = { mode: "node", id, startX: e.clientX, startY: e.clientY, moved: 0 };
    const sim = simRef.current;
    if (sim && !pausedRef.current) sim.alphaTarget(0.25).restart();
  }, []);

  const handleBackgroundPointerDown = useCallback((e: ReactPointerEvent<SVGSVGElement>) => {
    svgRef.current?.setPointerCapture(e.pointerId);
    const v = viewRef.current;
    dragRef.current = {
      mode: "pan",
      startX: e.clientX,
      startY: e.clientY,
      startViewX: v.x,
      startViewY: v.y,
      moved: 0,
    };
  }, []);

  const handlePointerMove = useCallback(
    (e: ReactPointerEvent<SVGSVGElement>) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      const dist = Math.hypot(dx, dy);
      if (dist > d.moved) d.moved = dist;

      if (d.mode === "node") {
        const v = clientToView(e.clientX, e.clientY);
        const view0 = viewRef.current;
        const n = nodeIndexRef.current?.get(d.id);
        if (n) {
          n.fx = (v.x - view0.x) / view0.zoom;
          n.fy = (v.y - view0.y) / view0.zoom;
          if (pausedRef.current) {
            // simulation timer is stopped — advance a single frame manually
            simRef.current?.tick();
            pushRef.current?.();
          }
        }
      } else {
        const rect = svgRef.current?.getBoundingClientRect();
        const scale = rect && rect.width > 0 ? widthRef.current / rect.width : 1;
        const next = {
          zoom: viewRef.current.zoom,
          x: d.startViewX + dx / scale,
          y: d.startViewY + dy / scale,
        };
        viewRef.current = next;
        setView(next);
      }
    },
    [clientToView]
  );

  const handlePointerUp = useCallback(
    (e: ReactPointerEvent<SVGSVGElement>) => {
      const d = dragRef.current;
      if (!d) return;
      dragRef.current = null;
      const svg = svgRef.current;
      if (svg && svg.hasPointerCapture(e.pointerId)) svg.releasePointerCapture(e.pointerId);

      if (d.mode === "node") {
        const n = nodeIndexRef.current?.get(d.id);
        if (n) {
          n.fx = null;
          n.fy = null;
        }
        const sim = simRef.current;
        if (sim && !pausedRef.current) sim.alphaTarget(0);
        // <4px of movement counts as a click, not a drag
        if (d.moved < 4) onSelectNode(d.id);
      } else if (d.moved < 4) {
        onSelectNode(null);
      }
    },
    [onSelectNode]
  );

  const handleNodeHover = useCallback((id: string | null) => setHoveredId(id), []);

  /* ----- derived render maps ----- */
  const posMap = useMemo(() => new Map(positions.map((p) => [p.id, p])), [positions]);
  const colorOf = useMemo(() => new Map(communities.map((c) => [c.id, c.color])), [communities]);
  const communityOf = useMemo(() => new Map(nodes.map((n) => [n.id, n.communityId])), [nodes]);
  const adjacency = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const e of edges) {
      let s = m.get(e.source);
      if (!s) {
        s = new Set();
        m.set(e.source, s);
      }
      s.add(e.target);
      let t = m.get(e.target);
      if (!t) {
        t = new Set();
        m.set(e.target, t);
      }
      t.add(e.source);
    }
    return m;
  }, [edges]);
  const labelIds = useMemo(
    () =>
      new Set(
        [...nodes]
          .sort((a, b) => b.pageRank - a.pageRank)
          .slice(0, 8)
          .map((n) => n.id)
      ),
    [nodes]
  );

  return (
    <div
      ref={wrapRef}
      className="relative overflow-hidden rounded-md border border-border/60 bg-[radial-gradient(circle_at_1px_1px,rgba(35,40,56,0.6)_1px,transparent_0)] bg-[size:22px_22px]"
      style={{ height }}
    >
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className="block w-full select-none"
        style={{ height, touchAction: "none" }}
        onPointerDown={handleBackgroundPointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        role="img"
        aria-label={`Interaction graph — ${nodes.length} accounts, ${edges.length} interactions`}
      >
        <g transform={`translate(${view.x} ${view.y}) scale(${view.zoom})`}>
          <EdgeLayer
            edges={edges}
            posMap={posMap}
            highlightedEdges={highlightedEdges}
            hoveredId={hoveredId}
            activeCommunityIds={activeCommunityIds}
            communityOf={communityOf}
          />
          <NodeLayer
            nodes={nodes}
            posMap={posMap}
            colorOf={colorOf}
            labelIds={labelIds}
            selectedNodeId={selectedNodeId}
            hoveredId={hoveredId}
            highlightedNodeIds={highlightedNodeIds}
            originNodeId={originNodeId}
            activeCommunityIds={activeCommunityIds}
            adjacency={adjacency}
            onNodePointerDown={handleNodePointerDown}
            onNodeHover={handleNodeHover}
          />
        </g>
      </svg>

      {/* viewport controls */}
      <div className="absolute right-2 top-2 flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          className="size-6 rounded-sm bg-card/90 p-0"
          title="Zoom in"
          aria-label="Zoom in"
          onClick={() => zoomBy(1.25)}
        >
          <Plus className="size-3" strokeWidth={2} />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="size-6 rounded-sm bg-card/90 p-0"
          title="Zoom out"
          aria-label="Zoom out"
          onClick={() => zoomBy(0.8)}
        >
          <Minus className="size-3" strokeWidth={2} />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="size-6 rounded-sm bg-card/90 p-0"
          title="Reset view"
          aria-label="Reset view"
          onClick={resetView}
        >
          <Maximize2 className="size-3" strokeWidth={2} />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="size-6 rounded-sm bg-card/90 p-0"
          title={paused ? "Resume simulation" : "Pause simulation"}
          aria-label={paused ? "Resume simulation" : "Pause simulation"}
          onClick={togglePaused}
        >
          {paused ? <Play className="size-3" strokeWidth={2} /> : <Pause className="size-3" strokeWidth={2} />}
        </Button>
      </div>

      {/* telemetry readout */}
      <div className="pointer-events-none absolute bottom-1.5 left-2 flex items-center gap-2 font-mono text-[9px] tnum text-muted-foreground/80">
        <span>zoom {view.zoom.toFixed(2)}×</span>
        <span className="text-border">|</span>
        <span>
          {nodes.length} nodes · {edges.length} edges
        </span>
        {paused && <span className="text-signal-amber">sim paused</span>}
      </div>
    </div>
  );
}
