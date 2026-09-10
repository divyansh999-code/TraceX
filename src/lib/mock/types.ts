/** Shared type contracts for the TraceX mock intelligence layer. */

export type Platform = "all" | "x" | "telegram";
export type RangeKey = "24h" | "7d" | "30d" | "custom";

export interface Filters {
  platform: Platform;
  range: RangeKey;
  customDays: number; // used when range === 'custom' (3–90)
  languages: string[]; // empty = all languages
  query: string;
}

export type ScreenId =
  | "overview"
  | "trends"
  | "sentiment"
  | "demographics"
  | "network"
  | "bots"
  | "misinfo"
  | "alerts";

export type SentimentKind = "positive" | "neutral" | "negative";

export interface Topic {
  id: string;
  label: string; // as shown in UI (hashtag / phrase, EN / HI / Hinglish)
  gloss: string; // english gloss for analysts
  category: string;
  languages: string[]; // language codes present in conversation
  baseVolume: number; // posts/day baseline (all platforms)
  xShare: number; // fraction of volume on X
  sentiment: { positive: number; neutral: number; negative: number };
  risk: number; // 0–1 composite risk
  change24h: number; // % change vs previous 24h
  velocity: "surging" | "rising" | "steady" | "declining";
  spikeDay: number | null; // day index within last 30d, null = no spike
  spikeHour: number | null; // hour index within last 24h
  emerging: boolean; // volume exceeded baseline → flagged
  relatedTopics: string[]; // topic ids
}

/** A single point on a time-series chart. */
export interface VolumePoint {
  t: number; // epoch ms
  label: string; // human label for axis
  total: number;
  x: number;
  telegram: number;
  positive: number;
  neutral: number;
  negative: number;
  baseline: number; // historical average (dotted reference)
  spike: boolean; // abnormal spike flag vs baseline
}

export interface Kpis {
  postsTracked: number;
  activeNarratives: number;
  avgSentiment: number; // -1..1
  sentimentDelta: number; // vs previous window
  highRiskAlerts: number;
  botShare: number; // 0..1 estimated bot-authored share
  xShare: number;
  telegramShare: number;
}

export interface EmotionPoint {
  emotion: string;
  value: number; // 0..100 share
  delta: number; // vs previous window
}

export interface TopicSentimentRow {
  topicId: string;
  label: string;
  volume: number;
  positive: number;
  neutral: number;
  negative: number;
  net: number; // -1..1
  shift: number; // net change vs previous window
}

export interface SentimentShiftEvent {
  id: string;
  topicLabel: string;
  from: number;
  to: number;
  windowLabel: string;
  t: number;
  note: string;
}

export interface StateShare {
  state: string;
  share: number; // %
  volume: number;
}

export interface LanguageShare {
  code: string;
  label: string;
  native: string;
  share: number; // %
}

export interface DemographicsBundle {
  states: StateShare[];
  languages: LanguageShare[];
  ages: { bracket: string; share: number }[];
  interests: { label: string; share: number }[];
  activityByHour: number[]; // 24 values, posts/h share
  methodology: string;
}

export interface Community {
  id: string;
  label: string;
  color: string;
  botShare: number;
}

export interface NetNode {
  id: string; // e.g. TX-7F3A91 / TG-C41022
  handle: string;
  displayName: string;
  platform: "x" | "telegram";
  communityId: string;
  followers: number;
  pageRank: number; // normalised 0..~0.12
  botProb: number; // 0..1
  accountAgeDays: number;
  postsPerDay: number;
  dupPct: number; // duplicate content %
  timingAnomaly: number; // 0..1
  reach: number; // est. impressions/week
}

export interface NetEdge {
  source: string;
  target: string;
  weight: number; // interactions count
  kind: "reply" | "mention" | "repost" | "forward";
}

export interface NetworkBundle {
  nodes: NetNode[];
  edges: NetEdge[];
  communities: Community[];
  stats: { nodes: number; edges: number; density: number; modularity: number };
}

export interface PropagationStep {
  nodeId: string;
  depth: number; // hops from origin
  offsetMin: number; // minutes after origin post
  reach: number;
}

export interface PropagationPath {
  topicId: string;
  originNodeId: string;
  postedAt: number; // epoch ms
  steps: PropagationStep[];
  edgePairs: [string, string][]; // highlighted edges
  totalReach: number;
  medianLatencySec: number;
}

export interface BotAccount {
  id: string;
  handle: string;
  platform: "x" | "telegram";
  botProb: number;
  clusterId: string | null;
  clusterSize: number;
  postsPerDay: number;
  accountAgeDays: number;
  dupPct: number;
  timingAnomaly: number;
  firstSeen: number; // epoch ms
}

export interface BotCluster {
  id: string;
  label: string;
  size: number;
  syncWindowSec: number;
  sharedMediaHashes: number;
  targetTopics: string[];
  activity: number[]; // hourly activity sparkline
  memberIds: string[];
  severity: "high" | "medium";
}

export interface ScatterPoint {
  age: number; // account age days
  freq: number; // posts/day
  botProb: number;
  platform: "x" | "telegram";
  flagged: boolean;
}

export interface BotBundle {
  flagged: BotAccount[];
  scatter: ScatterPoint[];
  clusters: BotCluster[];
  distribution: { bucket: string; count: number }[];
  stats: {
    sampled: number;
    flaggedAccounts: number;
    botShare: number;
    accountsPerCluster: number;
    newLast24h: number;
  };
}

export type ClaimStatus = "Verified" | "Disputed" | "Unverified" | "False";

export interface Claim {
  id: string;
  text: string;
  translation: string | null;
  status: ClaimStatus;
  sources: string[]; // fact-check cross-references
  botCorrelation: number; // 0..1
  risk: number; // 0..1
  topicId: string;
  firstSeen: number; // epoch ms
  spreadHours: number;
  spread: { hour: number; xReach: number; tgReach: number }[];
  events: { hour: number; platform: "x" | "telegram"; reach: number; botShare: number; note: string }[];
  totalReach: number;
}

export type AlertType = "spike" | "bot-cluster" | "misinformation" | "sentiment-shift";
export type AlertSeverity = "critical" | "high" | "medium" | "low";
export type AlertStatus = "New" | "Acknowledged" | "Resolved";

export interface IntelligenceAlert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  detail: string;
  t: number; // epoch ms
  status: AlertStatus;
  topicLabel?: string;
  linkScreen?: ScreenId;
}

export interface SamplePost {
  id: string;
  handle: string;
  platform: "x" | "telegram";
  text: string;
  lang: string;
  minutesAgo: number;
  engagement: { reposts: number; replies: number; likes: number };
  botProb: number;
}

/** Day-level corpus dossier (v0.15 spike inspector) — one calendar day
 *  decomposed into volume, platform/sentiment mix, the narratives that
 *  dominated it and the claims in play that day. */
export interface DayNarrativeSlice {
  id: string;
  label: string;
  dayVolume: number;
  share: number; // 0..1 fraction of the day's total corpus
  spike: boolean; // that narrative's own day bucketed as anomalous
  velocity: Topic["velocity"];
  risk: number;
  /** 7-day volume context around the day (v0.16) — the sparkline data. */
  context: number[];
  /** Index of THIS day within `context` (v0.16) — the sparkline marker. */
  contextIdx: number;
}

export interface DayClaimSlice {
  id: string;
  text: string;
  status: ClaimStatus;
  risk: number;
  why: string; // e.g. "first detected that day" | "active in #GaganyaanLaunch"
}

export interface DayDossier {
  t: number;
  label: string;
  total: number;
  baseline: number;
  vsBaseline: number; // % delta vs the day's baseline
  xShare: number; // 0..1
  sentiment: { positive: number; neutral: number; negative: number }; // fractions
  narratives: DayNarrativeSlice[];
  claims: DayClaimSlice[];
}

export interface Influencer {
  nodeId: string;
  handle: string;
  platform: "x" | "telegram";
  communityLabel: string;
  communityColor: string;
  pageRank: number;
  followers: number;
  reach: number;
  botProb: number;
}

export interface AlertRule {
  id: string;
  metric: "Volume" | "Net sentiment" | "Bot score" | "Misinfo risk";
  condition: "exceeds" | "drops below";
  threshold: number;
  target: string;
  channel: "Console" | "Email digest" | "Webhook";
  active: boolean;
}
