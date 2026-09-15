import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

/**
 * Performance analytics: every number in this file is derived from
 * persisted `interviews` / `interview_questions` / `interview_answers` /
 * `evaluations` rows for the *authenticated* user only. Nothing here is
 * randomly generated, hardcoded, or estimated.
 *
 * Aggregation method (documented once, used everywhere below):
 * - A single evaluation's sub-scores (overall/technical/communication/
 *   accuracy/confidence) are each 0–10, set by the AI grader per answer.
 * - "Interview-level score" = the simple average of `overall_score`
 *   across every scored answer in that interview. Used for the trend
 *   line and history list, so each interview contributes one point.
 * - "Overall performance" (the headline numbers) = a flat simple
 *   average of the relevant sub-score across *every* scored answer in
 *   every interview being analyzed (i.e. each answer is weighted
 *   equally, not each interview) — the same "average of the numbers you
 *   have" approach used on the single-interview report screen, just
 *   extended across interviews. No weighting, no recency bias, no
 *   custom formula.
 * - Topic/difficulty performance = the same flat average, grouped by
 *   the question's persisted `topic` / `difficulty` instead of across
 *   everything.
 * Only interviews with `status = 'completed'` are included anywhere on
 * this page — an in-progress or draft interview has no bearing on any
 * number shown here.
 */

export type InterviewRecord = Tables<"interviews">;

const ROUND = (n: number) => Math.round(n * 10) / 10;

function average(values: Array<number | null | undefined>): number | null {
  const nums = values.filter((v): v is number => v !== null && v !== undefined).map(Number);
  if (nums.length === 0) return null;
  return ROUND(nums.reduce((sum, v) => sum + v, 0) / nums.length);
}

export interface AnalyticsFilters {
  role?: string;
  interviewType?: string;
  /** Only include interviews completed within the last N days. */
  periodDays?: number;
}

export interface OverallPerformance {
  overall: number | null;
  technical: number | null;
  communication: number | null;
  accuracy: number | null;
  confidence: number | null;
  scoredAnswerCount: number;
}

export interface TrendPoint {
  interviewId: string;
  date: string;
  role: string;
  score: number | null;
}

export interface TopicStat {
  topic: string;
  average: number;
  count: number;
}

export interface DifficultyStat {
  difficulty: string;
  average: number;
  count: number;
}

export interface HistoryInsight {
  id: string;
  title: string | null;
  role: string;
  interviewType: string;
  date: string;
  overallScore: number | null;
  questionCount: number;
  followUpCount: number;
}

export interface NotableAnswer {
  interviewId: string;
  question: string;
  score: number;
  feedback: string | null;
  topic: string | null;
}

export interface TimeBasedImprovement {
  interviewCount: number;
  firstScore: number;
  recentScore: number;
  absoluteImprovement: number;
  /** Null when the first score is 0 — a percentage change is not a
   *  meaningful number to show in that case. */
  percentImprovement: number | null;
}

export interface AnalyticsFilterOptions {
  roles: string[];
  interviewTypes: string[];
}

export interface AnalyticsData {
  /** False only when the user has zero completed interviews at all —
   *  distinct from "filters matched nothing." */
  hasData: boolean;
  /** True when there are completed interviews overall but the current
   *  filters exclude all of them. */
  filtersExcludeEverything: boolean;
  completedInterviewsCount: number;
  filteredInterviewsCount: number;
  overall: OverallPerformance | null;
  trend: TrendPoint[];
  topicPerformance: TopicStat[];
  difficultyPerformance: DifficultyStat[] | null;
  historyInsights: HistoryInsight[];
  strongestAnswer: NotableAnswer | null;
  weakestAnswer: NotableAnswer | null;
  improvementAreas: string[];
  timeBasedImprovement: TimeBasedImprovement | null;
  filterOptions: AnalyticsFilterOptions;
  appliedFilters: AnalyticsFilters;
}

interface QuestionRow {
  id: string;
  interview_id: string;
  is_follow_up: boolean;
}

interface EvalJoinRow {
  id: string;
  overall_score: number | null;
  technical_score: number | null;
  communication_score: number | null;
  accuracy_score: number | null;
  confidence_score: number | null;
  weaknesses: string[] | null;
  improvement_suggestions: string[] | null;
  feedback: string | null;
  interview_answers: {
    interview_questions: {
      interview_id: string;
      topic: string | null;
      difficulty: string | null;
      question_text: string;
    } | null;
  } | null;
}

interface FlatEval {
  interviewId: string;
  overallScore: number | null;
  technicalScore: number | null;
  communicationScore: number | null;
  accuracyScore: number | null;
  confidenceScore: number | null;
  weaknesses: string[];
  improvementSuggestions: string[];
  feedback: string | null;
  topic: string | null;
  difficulty: string | null;
  questionText: string;
}

function flattenEvalRows(rows: EvalJoinRow[]): FlatEval[] {
  const flat: FlatEval[] = [];
  for (const row of rows) {
    const q = row.interview_answers?.interview_questions;
    if (!q) continue; // orphaned join row — skip rather than guess
    flat.push({
      interviewId: q.interview_id,
      overallScore: row.overall_score,
      technicalScore: row.technical_score,
      communicationScore: row.communication_score,
      accuracyScore: row.accuracy_score,
      confidenceScore: row.confidence_score,
      weaknesses: row.weaknesses ?? [],
      improvementSuggestions: row.improvement_suggestions ?? [],
      feedback: row.feedback,
      topic: q.topic,
      difficulty: q.difficulty,
      questionText: q.question_text,
    });
  }
  return flat;
}

/**
 * Lightweight word-overlap deduplication for free-text suggestions —
 * the same technique used for anti-repetition on generated questions
 * (see lib/ai/dedupe.ts), applied here to evaluation feedback text
 * instead. Deliberately no embeddings/vector store.
 */
const DUPLICATE_THRESHOLD = 0.55;

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 2)
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection += 1;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Groups near-duplicate strings and returns the most frequently-repeated
 * ones first (the representative text is whichever occurrence came
 * first). Deterministic, no AI call.
 */
function dedupeByFrequency(texts: string[], limit: number): string[] {
  const clusters: { representative: string; tokens: Set<string>; count: number }[] = [];

  for (const text of texts) {
    const trimmed = text.trim();
    if (!trimmed) continue;
    const tokens = tokenize(trimmed);
    const existing = clusters.find((c) => jaccard(tokens, c.tokens) >= DUPLICATE_THRESHOLD);
    if (existing) {
      existing.count += 1;
    } else {
      clusters.push({ representative: trimmed, tokens, count: 1 });
    }
  }

  return clusters
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map((c) => c.representative);
}

function applyFilters(
  interviews: InterviewRecord[],
  filters: AnalyticsFilters
): InterviewRecord[] {
  let result = interviews;
  if (filters.role) {
    result = result.filter((i) => i.target_role === filters.role);
  }
  if (filters.interviewType) {
    result = result.filter((i) => i.interview_type === filters.interviewType);
  }
  if (filters.periodDays) {
    const cutoff = Date.now() - filters.periodDays * 24 * 60 * 60 * 1000;
    result = result.filter((i) => i.completed_at && new Date(i.completed_at).getTime() >= cutoff);
  }
  return result;
}

/**
 * Fetches every completed interview for the authenticated user, plus
 * the persisted questions and evaluations needed to analyze them — a
 * fixed three queries regardless of how many interviews exist, so this
 * never turns into N+1 as history grows.
 */
async function loadCompletedInterviewData(): Promise<{
  interviews: InterviewRecord[];
  questions: QuestionRow[];
  evaluations: FlatEval[];
} | null> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Query 1 — this user's completed interviews only. RLS also enforces
  // this independently; the explicit eq() avoids an extra round trip
  // for a caller who isn't authenticated as this user.
  const { data: interviews, error: interviewsError } = await supabase
    .from("interviews")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "completed")
    .order("completed_at", { ascending: true });
  if (interviewsError) throw interviewsError;
  if (!interviews || interviews.length === 0) {
    return { interviews: [], questions: [], evaluations: [] };
  }

  const interviewIds = interviews.map((i) => i.id);

  // Query 2 — every persisted question across those interviews, for
  // real (not requested) question/follow-up counts.
  const { data: questions, error: questionsError } = await supabase
    .from("interview_questions")
    .select("id, interview_id, is_follow_up")
    .in("interview_id", interviewIds);
  if (questionsError) throw questionsError;

  // Query 3 — every evaluation across those interviews, joined back to
  // its question for topic/difficulty/text. RLS on `evaluations` is
  // enforced via a join back to `interview_answers`/`interviews`, so
  // this can never return another user's rows.
  const { data: evalRows, error: evalError } = await supabase
    .from("evaluations")
    .select(
      "id, overall_score, technical_score, communication_score, accuracy_score, confidence_score, weaknesses, improvement_suggestions, feedback, interview_answers!inner(interview_questions!inner(interview_id, topic, difficulty, question_text))"
    )
    .in("interview_answers.interview_questions.interview_id", interviewIds);
  if (evalError) throw evalError;

  return {
    interviews,
    questions: (questions ?? []) as QuestionRow[],
    evaluations: flattenEvalRows((evalRows ?? []) as unknown as EvalJoinRow[]),
  };
}

/**
 * The single entry point for the analytics page (and the dashboard
 * summary). Verifies the authenticated user itself — never trusts a
 * caller-supplied id — queries only that user's completed interviews,
 * and returns fully aggregated, typed data. No UI component talks to
 * Supabase directly for any of this.
 */
export async function getAnalyticsData(filters: AnalyticsFilters = {}): Promise<AnalyticsData> {
  const loaded = await loadCompletedInterviewData();

  const empty: AnalyticsData = {
    hasData: false,
    filtersExcludeEverything: false,
    completedInterviewsCount: 0,
    filteredInterviewsCount: 0,
    overall: null,
    trend: [],
    topicPerformance: [],
    difficultyPerformance: null,
    historyInsights: [],
    strongestAnswer: null,
    weakestAnswer: null,
    improvementAreas: [],
    timeBasedImprovement: null,
    filterOptions: { roles: [], interviewTypes: [] },
    appliedFilters: filters,
  };

  if (!loaded || loaded.interviews.length === 0) return empty;

  const { interviews: allCompleted, questions: allQuestions, evaluations: allEvaluations } = loaded;

  const filterOptions: AnalyticsFilterOptions = {
    roles: [...new Set(allCompleted.map((i) => i.target_role))].sort(),
    interviewTypes: [...new Set(allCompleted.map((i) => i.interview_type))].sort(),
  };

  const filteredInterviews = applyFilters(allCompleted, filters);
  const filteredIds = new Set(filteredInterviews.map((i) => i.id));

  if (filteredInterviews.length === 0) {
    return {
      ...empty,
      hasData: true,
      filtersExcludeEverything: true,
      completedInterviewsCount: allCompleted.length,
      filterOptions,
      appliedFilters: filters,
    };
  }

  const questions = allQuestions.filter((q) => filteredIds.has(q.interview_id));
  const evaluations = allEvaluations.filter((e) => filteredIds.has(e.interviewId));
  const scored = evaluations.filter((e) => e.overallScore !== null);

  // ---- Overall performance (flat average across every scored answer) ----
  const overall: OverallPerformance = {
    overall: average(evaluations.map((e) => e.overallScore)),
    technical: average(evaluations.map((e) => e.technicalScore)),
    communication: average(evaluations.map((e) => e.communicationScore)),
    accuracy: average(evaluations.map((e) => e.accuracyScore)),
    confidence: average(evaluations.map((e) => e.confidenceScore)),
    scoredAnswerCount: scored.length,
  };

  // ---- Per-interview score, shared by trend + history ----
  const evalsByInterview = new Map<string, FlatEval[]>();
  for (const e of evaluations) {
    const list = evalsByInterview.get(e.interviewId) ?? [];
    list.push(e);
    evalsByInterview.set(e.interviewId, list);
  }
  const interviewScore = (interviewId: string): number | null =>
    average((evalsByInterview.get(interviewId) ?? []).map((e) => e.overallScore));

  // ---- Trend (chronological — filteredInterviews is already asc) ----
  const trend: TrendPoint[] = filteredInterviews.map((i) => ({
    interviewId: i.id,
    date: i.completed_at ?? i.updated_at,
    role: i.target_role,
    score: interviewScore(i.id),
  }));

  // ---- Topic performance ----
  const topicMap = new Map<string, number[]>();
  for (const e of scored) {
    const topic = e.topic ?? "General";
    const list = topicMap.get(topic) ?? [];
    list.push(Number(e.overallScore));
    topicMap.set(topic, list);
  }
  const topicPerformance: TopicStat[] = [...topicMap.entries()]
    .map(([topic, scores]) => ({
      topic,
      average: ROUND(scores.reduce((s, v) => s + v, 0) / scores.length),
      count: scores.length,
    }))
    .sort((a, b) => b.average - a.average);

  // ---- Difficulty performance ----
  const difficultyMap = new Map<string, number[]>();
  for (const e of scored) {
    if (!e.difficulty) continue;
    const list = difficultyMap.get(e.difficulty) ?? [];
    list.push(Number(e.overallScore));
    difficultyMap.set(e.difficulty, list);
  }
  const DIFFICULTY_ORDER = ["easy", "medium", "hard"];
  const difficultyPerformance: DifficultyStat[] | null =
    difficultyMap.size === 0
      ? null
      : [...difficultyMap.entries()]
          .map(([difficulty, scores]) => ({
            difficulty,
            average: ROUND(scores.reduce((s, v) => s + v, 0) / scores.length),
            count: scores.length,
          }))
          .sort((a, b) => DIFFICULTY_ORDER.indexOf(a.difficulty) - DIFFICULTY_ORDER.indexOf(b.difficulty));

  // ---- History insights ----
  const questionsByInterview = new Map<string, QuestionRow[]>();
  for (const q of questions) {
    const list = questionsByInterview.get(q.interview_id) ?? [];
    list.push(q);
    questionsByInterview.set(q.interview_id, list);
  }
  const historyInsights: HistoryInsight[] = [...filteredInterviews]
    .sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? ""))
    .map((i) => {
      const qs = questionsByInterview.get(i.id) ?? [];
      return {
        id: i.id,
        title: i.title,
        role: i.target_role,
        interviewType: i.interview_type,
        date: i.completed_at ?? i.updated_at,
        overallScore: interviewScore(i.id),
        questionCount: qs.length,
        followUpCount: qs.filter((q) => q.is_follow_up).length,
      };
    });

  // ---- Strongest / weakest answer ----
  let strongestAnswer: NotableAnswer | null = null;
  let weakestAnswer: NotableAnswer | null = null;
  if (scored.length > 0) {
    const byScoreDesc = [...scored].sort((a, b) => Number(b.overallScore) - Number(a.overallScore));
    const top = byScoreDesc[0];
    const bottom = byScoreDesc[byScoreDesc.length - 1];
    if (top && bottom) {
      strongestAnswer = {
        interviewId: top.interviewId,
        question: top.questionText,
        score: Number(top.overallScore),
        feedback: top.feedback,
        topic: top.topic,
      };
      weakestAnswer = {
        interviewId: bottom.interviewId,
        question: bottom.questionText,
        score: Number(bottom.overallScore),
        feedback: bottom.feedback,
        topic: bottom.topic,
      };
    }
  }

  // ---- Improvement areas (deduplicated weaknesses + suggestions) ----
  const rawImprovements = evaluations.flatMap((e) => [...e.weaknesses, ...e.improvementSuggestions]);
  const improvementAreas = dedupeByFrequency(rawImprovements, 8);

  // ---- Time-based improvement ----
  const scoredTrend = trend.filter((t) => t.score !== null) as Array<
    TrendPoint & { score: number }
  >;
  let timeBasedImprovement: TimeBasedImprovement | null = null;
  if (scoredTrend.length >= 1) {
    const first = scoredTrend[0];
    const recent = scoredTrend[scoredTrend.length - 1];
    if (first && recent) {
      const absoluteImprovement = ROUND(recent.score - first.score);
      timeBasedImprovement = {
        interviewCount: scoredTrend.length,
        firstScore: first.score,
        recentScore: recent.score,
        absoluteImprovement,
        percentImprovement: first.score > 0 ? ROUND((absoluteImprovement / first.score) * 100) : null,
      };
    }
  }

  return {
    hasData: true,
    filtersExcludeEverything: false,
    completedInterviewsCount: allCompleted.length,
    filteredInterviewsCount: filteredInterviews.length,
    overall,
    trend,
    topicPerformance,
    difficultyPerformance,
    historyInsights,
    strongestAnswer,
    weakestAnswer,
    improvementAreas,
    timeBasedImprovement,
    filterOptions,
    appliedFilters: filters,
  };
}

export interface DashboardPerformanceSummary {
  hasData: boolean;
  overallScore: number | null;
  trendDirection: "up" | "down" | "flat" | null;
  topStrength: TopicStat | null;
  needsPractice: TopicStat | null;
  completedInterviewsCount: number;
}

/**
 * A trimmed-down view of the same analytics for the dashboard's compact
 * "Your performance" card. Reuses `getAnalyticsData` rather than a
 * second aggregation implementation, so the dashboard and the analytics
 * page can never disagree with each other.
 */
export async function getDashboardPerformanceSummary(): Promise<DashboardPerformanceSummary> {
  const data = await getAnalyticsData({});

  if (!data.hasData || data.filtersExcludeEverything) {
    return {
      hasData: false,
      overallScore: null,
      trendDirection: null,
      topStrength: null,
      needsPractice: null,
      completedInterviewsCount: data.completedInterviewsCount,
    };
  }

  const scoredTrend = data.trend.filter((t) => t.score !== null);
  let trendDirection: "up" | "down" | "flat" | null = null;
  if (scoredTrend.length >= 2) {
    const last = scoredTrend[scoredTrend.length - 1];
    const first = scoredTrend[0];
    if (last && first && last.score !== null && first.score !== null) {
      const delta = last.score - first.score;
      trendDirection = delta > 0.2 ? "up" : delta < -0.2 ? "down" : "flat";
    }
  }

  return {
    hasData: true,
    overallScore: data.overall?.overall ?? null,
    trendDirection,
    topStrength: data.topicPerformance[0] ?? null,
    needsPractice: data.topicPerformance[data.topicPerformance.length - 1] ?? null,
    completedInterviewsCount: data.completedInterviewsCount,
  };
}

/**
 * Deterministic aggregated statistics for the optional AI Coach
 * summary — computed locally with zero AI calls. `features/analytics/
 * actions.ts` passes this (not raw interview history) to the AI
 * provider, and only when the user explicitly asks for it.
 */
export interface CoachContext {
  completedInterviewsCount: number;
  overallScore: number;
  technicalScore: number | null;
  communicationScore: number | null;
  accuracyScore: number | null;
  confidenceScore: number | null;
  strongestTopic: { topic: string; average: number } | null;
  weakestTopic: { topic: string; average: number } | null;
  topicBreakdown: { topic: string; average: number }[];
  difficultyBreakdown: { difficulty: string; average: number }[] | null;
  improvementAreas: string[];
  timeBasedImprovement: {
    firstScore: number;
    recentScore: number;
    absoluteImprovement: number;
  } | null;
}

export async function getCoachContext(filters: AnalyticsFilters = {}): Promise<CoachContext | null> {
  const data = await getAnalyticsData(filters);
  if (!data.hasData || data.filtersExcludeEverything || data.overall?.overall == null) return null;

  return {
    completedInterviewsCount: data.filteredInterviewsCount,
    overallScore: data.overall.overall,
    technicalScore: data.overall.technical,
    communicationScore: data.overall.communication,
    accuracyScore: data.overall.accuracy,
    confidenceScore: data.overall.confidence,
    strongestTopic: data.topicPerformance[0]
      ? { topic: data.topicPerformance[0].topic, average: data.topicPerformance[0].average }
      : null,
    weakestTopic: (() => {
      const last = data.topicPerformance[data.topicPerformance.length - 1];
      return last ? { topic: last.topic, average: last.average } : null;
    })(),
    topicBreakdown: data.topicPerformance.slice(0, 6).map((t) => ({ topic: t.topic, average: t.average })),
    difficultyBreakdown:
      data.difficultyPerformance?.map((d) => ({ difficulty: d.difficulty, average: d.average })) ?? null,
    improvementAreas: data.improvementAreas.slice(0, 5),
    timeBasedImprovement: data.timeBasedImprovement
      ? {
          firstScore: data.timeBasedImprovement.firstScore,
          recentScore: data.timeBasedImprovement.recentScore,
          absoluteImprovement: data.timeBasedImprovement.absoluteImprovement,
        }
      : null,
  };
}
