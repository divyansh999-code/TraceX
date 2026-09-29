import { rngFrom, Rng } from "./rng";
import { COMMUNITIES, NOW } from "./content";
import type {
  NetNode,
  NetEdge,
  NetworkBundle,
  PropagationPath,
  BotBundle,
  BotAccount,
  BotCluster,
  ScatterPoint,
  Influencer,
  Filters,
} from "./types";

/* ------------------------------------------------------------------ */
/* Account roster — clearly fictional handles, seeded deterministically */
/* ------------------------------------------------------------------ */

interface RosterSpec {
  communityId: string;
  count: number;
  handles: string[]; // curated; rest generated
  tgNames?: string[];
  platformBias: number; // probability of X vs Telegram
  followers: [number, number];
  botProb: [number, number];
  pagerankBoost: number;
}

const ROSTER: RosterSpec[] = [
  {
    communityId: "c-news",
    count: 14,
    handles: [
      "@thenationaldesk", "@bharatwire_in", "@newslens_in", "@indiafeed24",
      "@thepolicybeat", "@capitalchronicle", "@factline_in", "@morningbrief_in",
      "@thestatewatch", "@mediawire_in", "@thecivicpost", "@breakingdesk_in",
    ],
    tgNames: ["National Desk Live", "Bharat Wire", "Morning Brief"],
    platformBias: 0.7,
    followers: [80_000, 900_000],
    botProb: [0.03, 0.14],
    pagerankBoost: 1.8,
  },
  {
    communityId: "c-amp",
    count: 16,
    handles: [
      "@maharashtra_mitra", "@up_samachar", "@tn_pulse", "@karnataka_vani",
      "@bangla_barta", "@delhi_charcha", "@gujarat_updates", "@telugu_tanam",
    ],
    tgNames: ["Rashtriya Updates", "Desh Ki Baatein", " Pradesh Pulse"],
    platformBias: 0.45,
    followers: [15_000, 240_000],
    botProb: [0.12, 0.52],
    pagerankBoost: 1.0,
  },
  {
    communityId: "c-policy",
    count: 10,
    handles: [
      "@policynotes_in", "@governancewatch", "@trackreform", "@budgetnerd_in",
      "@legiswatch", "@data4policy", "@reformdigest", "@statedesk_policy",
    ],
    platformBias: 0.85,
    followers: [40_000, 320_000],
    botProb: [0.03, 0.12],
    pagerankBoost: 1.35,
  },
  {
    communityId: "c-bot88",
    count: 12,
    handles: [
      "@patriot_wave_71", "@voice_of_desh_2", "@truefeed_88", "@deshupdates_4",
      "@national_pulse_9", "@samachar_express_6", "@vekta_update_3", "@newbharat_12",
    ],
    tgNames: ["Desh Update Channel", "Viral Forward Board"],
    platformBias: 0.6,
    followers: [400, 8_000],
    botProb: [0.82, 0.97],
    pagerankBoost: 0.8,
  },
  {
    communityId: "c-fandom",
    count: 14,
    handles: [
      "@bleedblue_18", "@cricketgully", "@sixover_cover", "@fansnet_in",
      "@stadiumroar_in", "@matchday_meme", "@gullycricket_in", "@silentspectator",
    ],
    tgNames: ["Matchday Memes", "Gully Cricket Club"],
    platformBias: 0.75,
    followers: [8_000, 180_000],
    botProb: [0.05, 0.28],
    pagerankBoost: 1.1,
  },
  {
    communityId: "c-tech",
    count: 12,
    handles: [
      "@devdigest_in", "@stackwatch", "@builderlog_in", "@indiasaas_",
      "@compiler_in", "@apiwatcher", "@shipdaily_in", "@techtantra_in",
    ],
    tgNames: ["India SaaS Reads", "Dev Digest"],
    platformBias: 0.8,
    followers: [25_000, 260_000],
    botProb: [0.03, 0.16],
    pagerankBoost: 1.15,
  },
  {
    communityId: "c-civic",
    count: 12,
    handles: [
      "@civicvoice_in", "@transparencynow", "@rti_watchdog", "@urbanmonitor",
      "@waterwatch_in", "@factvolunteer", "@metrocitizen", "@citylab_in",
    ],
    tgNames: ["City Watch Group", "Urban Monitors"],
    platformBias: 0.55,
    followers: [6_000, 120_000],
    botProb: [0.06, 0.22],
    pagerankBoost: 0.9,
  },
];

function hexId(rng: Rng, prefix: "TX" | "TG"): string {
  const hex = "0123456789ABCDEF";
  let id = "";
  for (let i = 0; i < 6; i++) id += hex[rng.int(0, 15)];
  return `${prefix}-${id}`;
}

function displayNameFor(handle: string): string {
  return handle.replace(/^@/, "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function buildRoster(): NetNode[] {
  const nodes: NetNode[] = [];
  for (const spec of ROSTER) {
    for (let i = 0; i < spec.count; i++) {
      const rng = rngFrom("node", spec.communityId, i);
      const isX = rng.chance(spec.platformBias) as boolean;
      const curated = isX ? spec.handles[i % spec.handles.length] : undefined;
      const tgCurated = !isX && spec.tgNames ? spec.tgNames[i % spec.tgNames.length] : undefined;
      const generated = isX
        ? `@${spec.communityId.split("-")[1]}_${rng.int(100, 9999)}`
        : `Channel ${rng.int(1000, 9999)}`;
      const handle = curated ?? tgCurated ?? generated;
      // ensure uniqueness for generated handles
      const platform: "x" | "telegram" = isX ? "x" : "telegram";
      const followers = Math.round(rng.range(spec.followers[0], spec.followers[1]) * (rng.chance(0.12) ? 2.2 : 1));
      const botProb =
        spec.communityId === "c-bot88"
          ? rng.range(0.82, 0.97)
          : rng.range(spec.botProb[0], spec.botProb[1]);
      nodes.push({
        id: hexId(rng, platform === "x" ? "TX" : "TG"),
        handle: platform === "x" ? handle : `tg://${handle.toLowerCase().replace(/[^a-z0-9]+/g, "")}`,
        displayName: platform === "x" ? displayNameFor(handle) : handle,
        platform,
        communityId: spec.communityId,
        followers,
        pageRank: 0, // assigned after normalisation
        botProb,
        accountAgeDays: Math.round(
          spec.communityId === "c-bot88" ? rng.range(5, 210) : rng.range(180, 4200)
        ),
        postsPerDay: Number(
          (spec.communityId === "c-bot88" ? rng.range(18, 142) : rng.range(0.4, 14)).toFixed(1)
        ),
        dupPct: Math.round(
          spec.communityId === "c-bot88" ? rng.range(31, 88) : rng.range(0, 18)
        ),
        timingAnomaly: Number(
          (spec.communityId === "c-bot88" ? rng.range(0.55, 0.95) : rng.range(0.01, 0.3)).toFixed(2)
        ),
        reach: 0,
      });
    }
  }
  // PageRank-ish: followers (log) × community boost × jitter, normalised
  const maxPr = 0.115;
  let rawTotal = 0;
  const raw = nodes.map((n) => {
    const spec = ROSTER.find((r) => r.communityId === n.communityId)!;
    const r = Math.log10(n.followers + 10) * spec.pagerankBoost * (0.75 + ((n.id.charCodeAt(3) % 50) / 100));
    rawTotal += r;
    return r;
  });
  nodes.forEach((n, i) => {
    const pr = (raw[i] / rawTotal) * nodes.length * maxPr * (0.55 + 0.45 * (raw[i] / Math.max(...raw)));
    n.pageRank = Number(pr.toFixed(4));
    n.reach = Math.round(n.followers * (2.4 + n.pageRank * 40));
  });
  return nodes;
}

export const ALL_NODES: NetNode[] = buildRoster();

function buildEdges(nodes: NetNode[]): NetEdge[] {
  const rng = rngFrom("edges", "v1");
  const edges = new Map<string, NetEdge>();
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const weights = nodes.map((n) => 0.2 + n.pageRank * 8);
  const weightedPick = (): NetNode => {
    let roll = rng.next() * weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < nodes.length; i++) {
      roll -= weights[i];
      if (roll <= 0) return nodes[i];
    }
    return nodes[nodes.length - 1];
  };
  const kinds: NetEdge["kind"][] = ["reply", "mention", "repost", "forward"];
  for (const src of nodes) {
    const degree = rng.int(1, 4);
    for (let d = 0; d < degree; d++) {
      let target = weightedPick();
      if (target.id === src.id) continue;
      if (rng.chance(0.62)) {
        const sameCommunity = nodes.filter((n) => n.communityId === src.communityId && n.id !== src.id);
        if (sameCommunity.length) target = rng.pick(sameCommunity);
      }
      const key = [src.id, target.id].sort().join("~");
      if (!edges.has(key)) {
        edges.set(key, {
          source: src.id,
          target: target.id,
          weight: rng.int(1, 14),
          kind: target.platform === "telegram" ? rng.pick(["forward", "mention", "reply"] as const) : rng.pick(kinds),
        });
      }
    }
  }
  return [...edges.values()];
}

export const ALL_EDGES: NetEdge[] = buildEdges(ALL_NODES);

/** Network bundle honouring platform filter. */
export function getNetwork(filters: Filters): NetworkBundle {
  const platform = filters.platform;
  const nodes = ALL_NODES.filter((n) => platform === "all" || n.platform === platform);
  const nodeIds = new Set(nodes.map((n) => n.id));
  const edges = ALL_EDGES.filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target));
  const communities = COMMUNITIES.map((c) => ({
    ...c,
    botShare: c.botShare,
  }));
  const density = nodes.length > 1 ? (2 * edges.length) / (nodes.length * (nodes.length - 1)) : 0;
  return {
    nodes,
    edges,
    communities,
    stats: {
      nodes: nodes.length,
      edges: edges.length,
      density: Number(density.toFixed(4)),
      modularity: 0.612,
    },
  };
}

/** Top influencers by PageRank. */
export function getInfluencers(filters: Filters, n = 8): Influencer[] {
  const { nodes, communities } = getNetwork(filters);
  return [...nodes]
    .sort((a, b) => b.pageRank - a.pageRank)
    .slice(0, n)
    .map((node) => {
      const community = communities.find((c) => c.id === node.communityId)!;
      return {
        nodeId: node.id,
        handle: node.handle,
        platform: node.platform,
        communityLabel: community.label,
        communityColor: community.color,
        pageRank: node.pageRank,
        followers: node.followers,
        reach: node.reach,
        botProb: node.botProb,
      };
    });
}

/* ------------------------------------------------------------------ */
/* Propagation paths                                                   */
/* ------------------------------------------------------------------ */

const PROPAGATION_ORIGIN: Record<string, string> = {
  "kisan-andolan": "TX-4C71A2",
  "isro-mission": "TX-18B5F0",
  "neet-reform": "TG-9033D1",
};

function ensureNode(id: string): NetNode | undefined {
  return ALL_NODES.find((n) => n.id === id);
}

/** A plausible propagation cascade for a narrative. */
export function getPropagation(topicId: string): PropagationPath | null {
  const originId = PROPAGATION_ORIGIN[topicId];
  if (!originId) return null;
  const rng = rngFrom("prop", topicId);
  const origin = ensureNode(originId);
  if (!origin) return null;

  const news = ALL_NODES.filter((n) => n.communityId === "c-news" && n.id !== originId);
  const amps = ALL_NODES.filter((n) => n.communityId === "c-amp");
  const bots = ALL_NODES.filter((n) => n.communityId === "c-bot88");
  const others = ALL_NODES.filter(
    (n) => ["c-fandom", "c-civic", "c-tech", "c-policy"].includes(n.communityId)
  );

  const depth1 = [news[0], news[1], amps[0]].filter(Boolean).slice(0, 3);
  const depth2 = [bots[0], bots[1], bots[2], amps[1], amps[2], news[2]].filter(Boolean).slice(0, 6);
  const depth3 = [others[0], others[1], others[2], others[3], others[4], others[5], amps[3], bots[3]].filter(
    Boolean
  ).slice(0, 8);

  const steps: PropagationPath["steps"] = [
    { nodeId: origin.id, depth: 0, offsetMin: 0, reach: Math.round(origin.followers * 0.31) },
  ];
  const used = new Set([origin.id]);
  const push = (node: NetNode, depth: number, maxOffset: number) => {
    if (used.has(node.id)) return;
    used.add(node.id);
    steps.push({
      nodeId: node.id,
      depth,
      offsetMin: Math.round(rng.range(maxOffset * 0.4, maxOffset)),
      reach: Math.round(node.reach * rng.range(0.04, 0.3)),
    });
  };
  depth1.forEach((n) => push(n, 1, 45));
  depth2.forEach((n) => push(n, 2, 240));
  depth3.forEach((n) => push(n, 3, 900));

  const edgePairs: [string, string][] = [];
  const byDepth = [origin, ...depth1, ...depth2, ...depth3];
  const connect = (from: NetNode[], to: NetNode[]) => {
    from.forEach((f) => {
      const targets = to.filter((t) => !used.has("") && t.id !== f.id);
      if (targets.length) {
        const t = targets[rng.int(0, targets.length - 1)];
        edgePairs.push([f.id, t.id]);
      }
    });
  };
  connect([origin], depth1);
  connect(depth1, depth2);
  connect(depth2, depth3);

  const totalReach = steps.reduce((a, s) => a + s.reach, 0);
  return {
    topicId,
    originNodeId: origin.id,
    postedAt: NOW - 26 * 3.6e6,
    steps,
    edgePairs,
    totalReach,
    medianLatencySec: Math.round(rng.range(38, 140)),
  };
}

/* ------------------------------------------------------------------ */
/* Bot detection module                                                */
/* ------------------------------------------------------------------ */

const CLUSTERS: BotCluster[] = [
  {
    id: "TX-88",
    label: "MSP-hashtag amplifiers",
    size: 340,
    syncWindowSec: 42,
    sharedMediaHashes: 7,
    targetTopics: ["किसान आंदोलन", "#NEETExamRow"],
    activity: [2, 1, 1, 1, 2, 3, 6, 12, 28, 34, 26, 18, 15, 22, 41, 48, 36, 30, 44, 52, 38, 22, 9, 4],
    memberIds: ALL_NODES.filter((n) => n.communityId === "c-bot88").slice(0, 8).map((n) => n.id),
    severity: "high",
  },
  {
    id: "TG-07",
    label: "Telegram forward-burst channels",
    size: 112,
    syncWindowSec: 8,
    sharedMediaHashes: 4,
    targetTopics: ["बिजली बिल राहत", "monsoon session parliament"],
    activity: [4, 3, 2, 2, 3, 5, 9, 14, 18, 16, 12, 11, 10, 13, 17, 15, 13, 16, 21, 26, 19, 12, 7, 5],
    memberIds: ALL_NODES.filter((n) => n.communityId === "c-amp" && n.platform === "telegram")
      .slice(0, 5)
      .map((n) => n.id),
    severity: "high",
  },
  {
    id: "TX-21",
    label: "Dormant retweet ring",
    size: 96,
    syncWindowSec: 190,
    sharedMediaHashes: 2,
    targetTopics: ["#StartupIndia funding winter"],
    activity: [0, 0, 0, 0, 0, 1, 2, 4, 7, 9, 8, 6, 5, 6, 8, 7, 6, 9, 12, 14, 10, 5, 2, 1],
    memberIds: ALL_NODES.filter((n) => n.communityId === "c-bot88").slice(8, 12).map((n) => n.id),
    severity: "medium",
  },
  {
    id: "TX-55",
    label: "Fandom spam fringe",
    size: 61,
    syncWindowSec: 240,
    sharedMediaHashes: 1,
    targetTopics: ["#INDvsAUS", "#KollywoodRelease"],
    activity: [1, 1, 0, 0, 1, 2, 5, 8, 10, 9, 7, 6, 6, 8, 10, 9, 8, 10, 13, 16, 12, 8, 4, 2],
    memberIds: ALL_NODES.filter((n) => n.communityId === "c-fandom").slice(0, 5).map((n) => n.id),
    severity: "medium",
  },
];

function buildFlagged(): BotAccount[] {
  const rng = rngFrom("flagged", "v1");
  const rows: BotAccount[] = [];
  const botNodes = ALL_NODES.filter((n) => n.botProb > 0.55).sort((a, b) => b.botProb - a.botProb);
  botNodes.forEach((node, i) => {
    const cluster =
      node.communityId === "c-bot88" ? CLUSTERS[0] : rng.chance(0.4) ? rng.pick(CLUSTERS.slice(1)) : null;
    rows.push({
      id: node.id,
      handle: node.handle,
      platform: node.platform,
      botProb: node.botProb,
      clusterId: cluster?.id ?? null,
      clusterSize: cluster?.size ?? 1,
      postsPerDay: node.postsPerDay,
      accountAgeDays: node.accountAgeDays,
      dupPct: node.dupPct,
      timingAnomaly: node.timingAnomaly,
      firstSeen: NOW - rng.int(2, 26) * 3.6e6,
    });
    void i;
  });
  return rows.sort((a, b) => b.botProb - a.botProb);
}

function buildScatter(): ScatterPoint[] {
  const rng = rngFrom("scatter", "v2");
  const points: ScatterPoint[] = [];
  for (let i = 0; i < 140; i++) {
    const flagged = rng.chance(0.16);
    const platform = rng.chance(0.66) ? "x" : "telegram";
    if (flagged) {
      points.push({
        age: Math.round(rng.range(4, 260)),
        freq: Number(rng.range(9, 130).toFixed(1)),
        botProb: Number(rng.range(0.6, 0.98).toFixed(2)),
        platform: platform as "x" | "telegram",
        flagged: true,
      });
    } else {
      points.push({
        age: Math.round(rng.range(150, 4300)),
        freq: Number(rng.range(0.2, 9).toFixed(1)),
        botProb: Number(rng.range(0.01, 0.45).toFixed(2)),
        platform: platform as "x" | "telegram",
        flagged: false,
      });
    }
  }
  return points;
}

export function getBots(filters: Filters): BotBundle {
  void filters;
  const flagged = buildFlagged();
  return {
    flagged,
    scatter: buildScatter(),
    clusters: CLUSTERS.map((c) => ({
      ...c,
      memberIds: c.memberIds.filter((id) => {
        const node = ALL_NODES.find((n) => n.id === id);
        return node && (filters.platform === "all" || node.platform === filters.platform);
      }),
    })),
    distribution: [
      { bucket: "0.0–0.2", count: 3_912 },
      { bucket: "0.2–0.4", count: 618 },
      { bucket: "0.4–0.6", count: 262 },
      { bucket: "0.6–0.8", count: 141 },
      { bucket: "0.8–1.0", count: 67 },
    ],
    stats: {
      sampled: 5_000,
      flaggedAccounts: flagged.length + 486,
      botShare: 0.118,
      accountsPerCluster: Math.round(
        CLUSTERS.reduce((a, c) => a + c.size, 0) / CLUSTERS.length
      ),
      newLast24h: 23,
    },
  };
}

export { NOW };
