import "server-only";
import { getAiProvider } from "@/lib/ai";
import type { InterviewSetupInput, AnswerSubmissionInput } from "@/lib/validation/interview";
import type { AnswerEvaluation } from "@/lib/ai/types";
import { AiProviderError } from "@/lib/ai/types";
import { isNearDuplicateQuestion } from "@/lib/ai/dedupe";
import {
  createQuestions,
  createFollowUpQuestion,
  getQuestionById,
  getQuestionsForInterview,
  type QuestionRecord,
} from "@/services/questions";
import { submitAnswer, getAnswersForInterview, type AnswerRecord } from "@/services/answers";
import {
  createEvaluation,
  getEvaluationsForInterview,
  type EvaluationRecord,
} from "@/services/evaluations";
import {
  getInterviewById,
  markInterviewInProgress,
  getMostRecentInProgressInterview,
  type InterviewRecord,
} from "@/services/interviews";
import { getSavedQuestionIdsForInterview } from "@/services/saved-questions";

/**
 * Business logic for the interview lifecycle. Server actions call into
 * this layer; this layer is the only thing that talks to both the AI
 * provider and the database for interview data. UI components never
 * import `lib/ai`, a Supabase client, or the services below directly.
 */

/**
 * Hard limits on adaptive follow-up growth, enforced server-side so a
 * chain of "needsFollowUp: true" evaluations can never turn a 10-question
 * interview into an unbounded conversation. These are the *only* two
 * knobs that shape how far a session can grow — deliberately simple and
 * deterministic (no scoring heuristics, no randomness) so the behavior is
 * easy to reason about and debug.
 *
 * - MAX_FOLLOW_UPS_PER_QUESTION: at most one follow-up per primary
 *   question. A second unresolved gap on the same question is better
 *   served by feedback in the report than a third turn on one topic.
 * - MAX_QUESTION_BUFFER_RATIO: total questions (primary + follow-ups)
 *   may grow at most 50% past the configured question count. For a
 *   10-question session that's a hard ceiling of 15 questions total,
 *   regardless of how many answers trigger a follow-up.
 */
const MAX_FOLLOW_UPS_PER_QUESTION = 1;
const MAX_QUESTION_BUFFER_RATIO = 0.5;

export interface InterviewState {
  interview: InterviewRecord;
  questions: QuestionRecord[];
  answers: AnswerRecord[];
  evaluations: EvaluationRecord[];
  savedQuestionIds: string[];
}

/**
 * Loads everything needed to render or resume an interview from
 * Postgres. This is the single function the workspace calls on mount,
 * on refresh, and when returning to an in-progress interview — there is
 * no client-side cache that stands in for it. Returns null when the
 * interview doesn't exist or (via RLS) doesn't belong to the caller.
 */
export async function getInterviewState(interviewId: string): Promise<InterviewState | null> {
  const interview = await getInterviewById(interviewId);
  if (!interview) return null;

  const [questions, answers, evaluations, savedQuestionIds] = await Promise.all([
    getQuestionsForInterview(interviewId),
    getAnswersForInterview(interviewId),
    getEvaluationsForInterview(interviewId),
    getSavedQuestionIdsForInterview(interviewId),
  ]);

  return { interview, questions, answers, evaluations, savedQuestionIds };
}

/**
 * Generates and persists the question set for an interview exactly once.
 * If questions already exist for this interview (a refresh, a retried
 * submit, a second tab), those rows are returned unchanged instead of
 * calling the AI provider or inserting again — this is what makes
 * "Build my interview" safe to retry.
 *
 * Each question is persisted with the AI's own per-question
 * classification (`questionType`, `difficulty`) rather than blindly
 * copying the session-level setup values onto every row — the setup
 * values are a *request*, not a guarantee that every question is
 * identical, especially for a "mixed" type/difficulty session where
 * intentional variety is the point (see the generation prompt).
 */
export async function generateAndPersistQuestions(
  interviewId: string,
  setup: InterviewSetupInput
): Promise<QuestionRecord[]> {
  const existing = await getQuestionsForInterview(interviewId);
  if (existing.length > 0) return existing;

  const ai = getAiProvider();
  const generated = await ai.generateQuestions({
    role: setup.role,
    experienceLevel: setup.experienceLevel,
    interviewType: setup.interviewType,
    topics: setup.topics,
    difficulty: setup.difficulty,
    questionCount: setup.questionCount,
  });

  try {
    return await createQuestions(
      interviewId,
      generated.map((q, i) => ({
        questionText: q.prompt,
        topic: q.topic,
        questionType: q.questionType,
        difficulty: q.difficulty,
        modelAnswer: q.modelAnswer,
        explanation: q.explanation,
        whatItTests: q.whatItTests,
        keyPoints: q.keyPoints,
        order: i + 1,
      }))
    );
  } catch (error) {
    // A concurrent request may have won the race and inserted first —
    // the unique(interview_id, question_order) constraint is what would
    // reject this insert. Fall back to whatever is now persisted rather
    // than surfacing a spurious duplicate-key error to the user.
    const persisted = await getQuestionsForInterview(interviewId);
    if (persisted.length > 0) return persisted;
    throw error;
  }
}

export interface SubmitAnswerResult {
  answer: AnswerRecord;
  evaluation: EvaluationRecord | null;
  followUp: QuestionRecord | null;
  /** True when the answer was saved but AI evaluation failed — distinct
   *  from total failure, since the user's answer is NOT lost. */
  evaluationFailed: boolean;
}

/**
 * Persists an answer, then evaluates and persists the result. The answer
 * write and the evaluation write are separate steps on purpose: if
 * Gemini fails or times out, the answer is still saved and the caller
 * can retry evaluation without the user retyping anything.
 */
export async function submitAndEvaluateAnswer(
  interviewId: string,
  submission: AnswerSubmissionInput,
  context: {
    question: string;
    role: string;
    experienceLevel: InterviewSetupInput["experienceLevel"];
    questionType?: string | null;
    modelAnswer?: string | null;
    keyPoints?: string[];
  }
): Promise<SubmitAnswerResult> {
  await markInterviewInProgress(interviewId);

  const answer = await submitAnswer(submission.questionId, submission.answerText);

  let evaluation: AnswerEvaluation;
  try {
    evaluation = await getAiProvider().evaluateAnswer({
      question: context.question,
      answerText: submission.answerText,
      role: context.role,
      experienceLevel: context.experienceLevel,
      questionType: context.questionType,
      modelAnswer: context.modelAnswer,
      keyPoints: context.keyPoints,
    });
  } catch (error) {
    if (error instanceof AiProviderError || error instanceof Error) {
      return { answer, evaluation: null, followUp: null, evaluationFailed: true };
    }
    throw error;
  }

  const persistedEvaluation = await createEvaluation({
    answerId: answer.id,
    overallScore: evaluation.overallScore,
    technicalScore: evaluation.technicalScore,
    communicationScore: evaluation.communicationScore,
    accuracyScore: evaluation.accuracyScore,
    confidenceScore: evaluation.confidenceScore,
    strengths: evaluation.strengths,
    weaknesses: evaluation.weaknesses,
    feedback: evaluation.feedback,
    improvementSuggestions: evaluation.improvementSuggestions,
  });

  let followUp: QuestionRecord | null = null;
  if (evaluation.needsFollowUp && evaluation.followUpQuestion) {
    const parent = await getQuestionById(submission.questionId);
    if (parent) {
      // The generation prompt already avoids repeating existing
      // questions, but a follow-up is generated from the evaluation
      // call, a separate model call with no visibility into the rest
      // of the interview's question set — so it gets its own
      // server-side duplicate check against everything already
      // persisted for this interview before being inserted.
      const [existingQuestions, interview] = await Promise.all([
        getQuestionsForInterview(interviewId),
        getInterviewById(interviewId),
      ]);

      const followUpsForParent = existingQuestions.filter(
        (q) => q.parent_question_id === parent.id
      ).length;
      // If the interview record can't be loaded for some reason, fail
      // closed (no further growth) rather than generating an unbounded
      // number of questions.
      const maxTotalQuestions = interview
        ? interview.question_count + Math.ceil(interview.question_count * MAX_QUESTION_BUFFER_RATIO)
        : existingQuestions.length;

      const withinPerQuestionLimit = followUpsForParent < MAX_FOLLOW_UPS_PER_QUESTION;
      const withinTotalLimit = existingQuestions.length < maxTotalQuestions;

      if (withinPerQuestionLimit && withinTotalLimit) {
        const isDuplicate = isNearDuplicateQuestion(
          evaluation.followUpQuestion,
          existingQuestions.map((q) => q.question_text)
        );
        if (!isDuplicate) {
          followUp = await createFollowUpQuestion(interviewId, parent, evaluation.followUpQuestion);
        }
      }
      // Otherwise: the AI still flagged a genuine gap, but the session
      // has hit its structural limit — that gap surfaces in the
      // evaluation's own feedback/weaknesses instead of a new question.
    }
  }

  return { answer, evaluation: persistedEvaluation, followUp, evaluationFailed: false };
}

export interface ContinueInterviewSummary {
  interview: InterviewRecord;
  questionsTotal: number;
  questionsCompleted: number;
  lastActivityAt: string;
}

/**
 * Aggregates the data the dashboard's "continue your interview" card
 * needs. Lives here rather than in services/interviews.ts because it
 * reads across three tables (interviews, questions, answers) — the same
 * reason getInterviewState does.
 */
export async function getContinueInterviewSummary(): Promise<ContinueInterviewSummary | null> {
  const interview = await getMostRecentInProgressInterview();
  if (!interview) return null;

  const [questions, answers, evaluations] = await Promise.all([
    getQuestionsForInterview(interview.id),
    getAnswersForInterview(interview.id),
    getEvaluationsForInterview(interview.id),
  ]);

  const lastActivityAt = answers.reduce<string>(
    (latest, a) => (a.updated_at > latest ? a.updated_at : latest),
    interview.updated_at
  );

  return {
    interview,
    questionsTotal: questions.length,
    questionsCompleted: evaluations.length,
    lastActivityAt,
  };
}
