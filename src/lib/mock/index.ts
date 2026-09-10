/** TraceX mock intelligence layer — public API. */
import { TOPICS, LANGUAGES, DEMOGRAPHICS, SAMPLE_POSTS, GENERIC_POSTS, ALERT_POOL, NOW } from "./content";
import {
  getVolumeSeries,
  getKpis,
  getEmotions,
  getTopicSentimentTable,
  getSentimentShifts,
  getClaims,
  effectiveTopics,
  getTopicSeries,
  getDayDossier,
} from "./series";
import { getNetwork, getInfluencers, getPropagation, getBots } from "./network";

export { NOW, TOPICS, LANGUAGES, DEMOGRAPHICS, ALERT_POOL };
export {
  getVolumeSeries,
  getKpis,
  getEmotions,
  getTopicSentimentTable,
  getSentimentShifts,
  getClaims,
  effectiveTopics,
  getTopicSeries,
  getDayDossier,
  getNetwork,
  getInfluencers,
  getPropagation,
  getBots,
};

export function getTopicById(id: string | null | undefined) {
  return TOPICS.find((t) => t.id === id) ?? null;
}

export function getSamplePosts(topicId: string | null | undefined) {
  if (!topicId) return [];
  return SAMPLE_POSTS[topicId] ?? GENERIC_POSTS;
}

export function getAlerts() {
  return [...ALERT_POOL].sort((a, b) => b.t - a.t);
}

export * from "./types";
