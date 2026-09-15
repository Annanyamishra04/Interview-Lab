import { z } from "zod";
import type { DifficultyLevel, ExperienceLevel, InterviewType } from "@/lib/validation/interview";
import { questionCategorySchema, questionDifficultySchema } from "@/lib/validation/interview";

export interface GenerateQuestionsRequest {
  role: string;
  experienceLevel: ExperienceLevel;
  interviewType: InterviewType;
  topics: string[];
  difficulty: DifficultyLevel;
  questionCount: number;
  /** Prompt text of questions already persisted for this interview (or
   *  already generated earlier in this same call). Passed back to the
   *  model so it never regenerates something it — or a prior
   *  generation — already asked; this is the prompt-side half of
   *  anti-repetition (see `dedupeQuestions` in interview-service.ts for
   *  the server-side backstop). */
  avoidQuestionTexts?: string[];
}

/**
 * A single generated interview question, fully structured. Every field
 * beyond `prompt`/`topic` exists so a question can support real
 * interview coaching (a model answer to compare against, an
 * explanation of why it's asked, and the key points a strong answer
 * would hit) rather than being a bare prompt string.
 */
export interface GeneratedQuestion {
  prompt: string;
  topic: string;
  questionType: z.infer<typeof questionCategorySchema>;
  difficulty: z.infer<typeof questionDifficultySchema>;
  modelAnswer: string;
  explanation: string;
  /** One sentence: what this question is actually assessing. */
  whatItTests: string;
  /** Concrete points a strong answer would hit — not a rubric essay. */
  keyPoints: string[];
}

export interface EvaluateAnswerRequest {
  question: string;
  answerText: string;
  role: string;
  experienceLevel: ExperienceLevel;
  /** The question's own metadata, when available, so the evaluator
   *  grades against what the question was actually testing rather than
   *  re-deriving it from the question text alone. */
  questionType?: string | null;
  modelAnswer?: string | null;
  keyPoints?: string[];
}

/**
 * A full, rubric-based evaluation of one answer. Four independently
 * meaningful sub-scores plus an overall holistic score — see the
 * rubric embedded in the evaluation prompt in
 * lib/ai/providers/gemini.ts for what each one means.
 */
export interface AnswerEvaluation {
  overallScore: number; // 0–10, holistic
  technicalScore: number; // 0–10, correctness of technical understanding
  communicationScore: number; // 0–10, structure/clarity
  accuracyScore: number; // 0–10, correctness of claims made
  confidenceScore: number; // 0–10, decisiveness/presentation
  strengths: string[];
  weaknesses: string[];
  /** Short, concrete coaching note — not a restatement of the scores. */
  feedback: string;
  improvementSuggestions: string[];
  /** True only when the answer leaves a genuine gap worth probing —
   *  never true just to extend the interview. */
  needsFollowUp: boolean;
  followUpQuestion: string | null;
}

/**
 * Input for the optional AI Coach summary on the analytics page. This is
 * deliberately *aggregated statistics only* — never raw interview
 * transcripts or full answer text — computed locally/server-side by
 * `services/analytics.ts::getCoachContext` before the AI is ever
 * called. Keeps the prompt small and keeps individual answers out of
 * the request entirely.
 */
export interface CoachSummaryRequest {
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

/** A short, holistic coaching note — not a restatement of the numbers
 *  already on the page. */
export interface CoachSummary {
  summary: string;
  focusArea: string;
  encouragement: string;
}

export interface AnalyzeResumeRequest {
  resumeText: string;
  targetRole: string;
}

export interface ResumeAnalysis {
  summary: string;
  suggestedTopics: string[];
  suggestedQuestions: GeneratedQuestion[];
}

/**
 * Every AI capability the product needs, independent of vendor. UI code
 * and server actions depend only on this interface — never on a specific
 * provider's SDK — so swapping or adding a provider later (see
 * lib/ai/index.ts) never touches route or component code.
 */
export interface AiProvider {
  generateQuestions(req: GenerateQuestionsRequest): Promise<GeneratedQuestion[]>;
  evaluateAnswer(req: EvaluateAnswerRequest): Promise<AnswerEvaluation>;
  generateFollowUp(req: EvaluateAnswerRequest): Promise<string | null>;
  analyzeResume(req: AnalyzeResumeRequest): Promise<ResumeAnalysis>;
  /** Optional higher-level coaching narrative built from aggregated,
   *  already-computed analytics — not a substitute for the deterministic
   *  numbers, which are always calculated locally regardless of whether
   *  this succeeds. */
  generateCoachSummary(req: CoachSummaryRequest): Promise<CoachSummary>;
}

export class AiProviderError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "AiProviderError";
  }
}

/**
 * -----------------------------------------------------------------
 * Zod contracts for provider output.
 * -----------------------------------------------------------------
 * A provider (Gemini today) returns JSON generated by a language
 * model — it is never trusted at the type level alone. Every response
 * is validated against these schemas before it reaches a service or
 * the database. Kept here (not inside the Gemini provider file) so the
 * *contract* a provider must satisfy is provider-agnostic, matching the
 * `AiProvider` interface above.
 */

export const generatedQuestionSchema = z.object({
  prompt: z.string().trim().min(10).max(600),
  topic: z.string().trim().min(1).max(80),
  questionType: questionCategorySchema,
  difficulty: questionDifficultySchema,
  modelAnswer: z.string().trim().min(1).max(2500),
  explanation: z.string().trim().min(1).max(800),
  whatItTests: z.string().trim().min(1).max(300),
  keyPoints: z.array(z.string().trim().min(1).max(200)).min(1).max(8),
});

export const generatedQuestionsResponseSchema = z.object({
  questions: z.array(z.unknown()).min(1),
});

export const answerEvaluationSchema = z
  .object({
    overallScore: z.number().min(0).max(10),
    technicalScore: z.number().min(0).max(10),
    communicationScore: z.number().min(0).max(10),
    accuracyScore: z.number().min(0).max(10),
    confidenceScore: z.number().min(0).max(10),
    strengths: z.array(z.string().trim().min(1).max(300)).max(6),
    weaknesses: z.array(z.string().trim().min(1).max(300)).max(6),
    feedback: z.string().trim().min(1).max(700),
    improvementSuggestions: z.array(z.string().trim().min(1).max(300)).max(6),
    needsFollowUp: z.boolean(),
    followUpQuestion: z.string().trim().min(5).max(400).nullable(),
  })
  .superRefine((val, ctx) => {
    if (val.needsFollowUp && !val.followUpQuestion) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "needsFollowUp is true but followUpQuestion is missing.",
        path: ["followUpQuestion"],
      });
    }
  });

export const coachSummarySchema = z.object({
  summary: z.string().trim().min(1).max(600),
  focusArea: z.string().trim().min(1).max(200),
  encouragement: z.string().trim().min(1).max(200),
});

export const resumeAnalysisSchema = z.object({
  summary: z.string().trim().min(1).max(700),
  suggestedTopics: z.array(z.string().trim().min(1).max(80)).min(1).max(8),
  suggestedQuestions: z.array(z.unknown()).min(1),
});
