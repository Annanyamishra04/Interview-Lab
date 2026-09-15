import { z } from "zod";

export const experienceLevelSchema = z.enum(["fresher", "1-3", "3-5", "5+"]);
export type ExperienceLevel = z.infer<typeof experienceLevelSchema>;

export const interviewTypeSchema = z.enum(["technical", "behavioral", "situational", "mixed"]);
export type InterviewType = z.infer<typeof interviewTypeSchema>;

export const difficultySchema = z.enum(["easy", "medium", "hard", "mixed"]);
export type DifficultyLevel = z.infer<typeof difficultySchema>;

/**
 * Per-question difficulty, assigned by the AI to each individual
 * question it generates. Distinct from `difficultySchema` above, which
 * is the session-level *selection* the user makes (and which includes
 * "mixed" — meaningless for a single question, since a single question
 * cannot itself be "mixed" difficulty).
 */
export const questionDifficultySchema = z.enum(["easy", "medium", "hard"]);
export type QuestionDifficulty = z.infer<typeof questionDifficultySchema>;

/**
 * The interviewer-style category of a single generated question.
 * Distinct from `interviewTypeSchema` above, which is the session-level
 * *selection* the user makes ("mixed" included). Every question the AI
 * produces — regardless of which session type it was generated under —
 * must be classified as exactly one of these, and the classification
 * must match what the question actually asks (see the generation
 * prompt in lib/ai/providers/gemini.ts).
 */
export const questionCategorySchema = z.enum([
  "technical",
  "behavioral",
  "system_design",
  "situational",
  "conceptual",
  "project_experience",
]);
export type QuestionCategory = z.infer<typeof questionCategorySchema>;

/**
 * Setup schema for a new interview session. This is the contract between
 * the onboarding UI and the interview-generation service — the service
 * layer (see services/interview-service.ts) accepts exactly this shape.
 */
export const interviewSetupSchema = z.object({
  role: z.string().min(2, "Enter a target role.").max(120),
  experienceLevel: experienceLevelSchema,
  interviewType: interviewTypeSchema,
  topics: z.array(z.string().min(1)).min(1, "Choose at least one topic.").max(8),
  difficulty: difficultySchema,
  questionCount: z.number().int().min(5).max(20).default(10),
});

export type InterviewSetupInput = z.infer<typeof interviewSetupSchema>;

export const answerSubmissionSchema = z.object({
  questionId: z.string().uuid(),
  answerText: z.string().min(1, "Write an answer before submitting.").max(6000),
});

export type AnswerSubmissionInput = z.infer<typeof answerSubmissionSchema>;
