import "server-only";
import { GoogleGenerativeAI } from "@google/generative-ai";
import type {
  AiProvider,
  AnalyzeResumeRequest,
  AnswerEvaluation,
  CoachSummary,
  CoachSummaryRequest,
  EvaluateAnswerRequest,
  GenerateQuestionsRequest,
  GeneratedQuestion,
  ResumeAnalysis,
} from "@/lib/ai/types";
import {
  AiProviderError,
  answerEvaluationSchema,
  coachSummarySchema,
  generatedQuestionSchema,
  generatedQuestionsResponseSchema,
  resumeAnalysisSchema,
} from "@/lib/ai/types";
import { dedupeGeneratedQuestions } from "@/lib/ai/dedupe";

/**
 * Default model, overridable via GEMINI_MODEL. `gemini-1.5-flash` (the
 * prior default) and every Gemini 1.x/2.0 model have been fully
 * retired by Google and now 404 on every request — this app was
 * silently non-functional until this was updated. `gemini-2.5-flash`
 * is also on a confirmed shutdown path (Oct 16, 2026), so rather than
 * pick another model that needs replacing again in a few weeks, the
 * default targets the current stable, free-tier-eligible Flash-Lite
 * line, which Google's own deprecation notices point migrators toward
 * and which has no shutdown date announced as of this writing. Revisit
 * this default periodically — Gemini model lifecycles move fast.
 */
const DEFAULT_MODEL = "gemini-3.1-flash-lite";
const REQUEST_TIMEOUT_MS = 30_000;

// Resumes can be long; this keeps prompts bounded and cheap without a
// truncation step reaching into resume-parsing logic that belongs to
// lib/resume. ~6000 characters is comfortably enough to cover a 1-2
// page resume's projects/skills/experience content.
const MAX_RESUME_CHARS_IN_PROMPT = 6000;

/**
 * Strips common wrapping (code fences, stray prose) and parses JSON.
 * Gemini is instructed to return only JSON via `responseMimeType`, but
 * this stays defensive since a model can still occasionally wrap or
 * prefix its output.
 */
function parseJsonResponse(raw: string): unknown {
  const cleaned = raw
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  if (!cleaned) {
    throw new AiProviderError("The AI returned an empty response.");
  }

  try {
    return JSON.parse(cleaned);
  } catch (error) {
    throw new AiProviderError("The AI response could not be parsed as JSON.", error);
  }
}

/**
 * Maps a raw SDK/network failure to a message safe to show a user.
 * Never surfaces the provider's raw error text (which can include
 * request internals) — only a stable, human-readable category.
 */
function classifyProviderError(error: unknown, action: string): AiProviderError {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  if (message.includes("429") || message.includes("resource_exhausted") || message.includes("quota")) {
    return new AiProviderError(
      `The AI service is rate-limited right now. Try ${action} again in a moment.`,
      error
    );
  }
  if (
    message.includes("503") ||
    message.includes("unavailable") ||
    message.includes("internal") ||
    message.includes("500")
  ) {
    return new AiProviderError(`The AI service is temporarily unavailable. Try ${action} again shortly.`, error);
  }
  if (message.includes("abort") || message.includes("timeout") || message.includes("timed out")) {
    return new AiProviderError(`The AI service took too long to respond while ${action}.`, error);
  }
  if (message.includes("api key") || message.includes("permission") || message.includes("401") || message.includes("403")) {
    return new AiProviderError("The AI service isn't configured correctly.", error);
  }
  return new AiProviderError(`Couldn't complete ${action} right now.`, error);
}

function truncateResumeText(text: string): string {
  if (text.length <= MAX_RESUME_CHARS_IN_PROMPT) return text;
  return `${text.slice(0, MAX_RESUME_CHARS_IN_PROMPT)}\n[resume truncated for length]`;
}

/**
 * Validates each element of a raw array against `generatedQuestionSchema`
 * individually rather than validating the whole array at once — one
 * malformed item (a missing field, a wrong type) drops only that item
 * instead of discarding an otherwise-usable batch. Returns only the
 * items that passed.
 */
function extractValidQuestions(rawArray: unknown[]): GeneratedQuestion[] {
  const valid: GeneratedQuestion[] = [];
  for (const raw of rawArray) {
    const parsed = generatedQuestionSchema.safeParse(raw);
    if (parsed.success) {
      valid.push(parsed.data);
    }
  }
  return valid;
}

const QUESTION_TYPE_GUIDANCE = `Question type definitions — the "questionType" you assign MUST match what the question actually asks:
- technical: hands-on coding, implementation, or tool/language-specific reasoning.
- conceptual: understanding of a concept or how something works, without asking for a live implementation.
- system_design: designing or scaling a system/service, architecture trade-offs.
- behavioral: "Tell me about a time...", past experience, soft skills, teamwork, conflict.
- situational: hypothetical scenario ("What would you do if...") requiring judgment, not personal history.
- project_experience: grounded in a specific project, technology choice, or measurable achievement the candidate has done.`;

const DIFFICULTY_GUIDANCE = `Difficulty definitions:
- easy: fundamentals, definitions, straightforward implementation reasoning.
- medium: practical application, trade-offs, debugging, scenario-based reasoning.
- hard: architecture, ambiguity, deep trade-offs, scalability, edge cases.
Do not make "hard" simply mean "longer" — it means genuinely harder reasoning.`;

const QUESTION_OBJECT_SHAPE = `{
  "prompt": string,
  "topic": string,
  "questionType": "technical" | "behavioral" | "system_design" | "situational" | "conceptual" | "project_experience",
  "difficulty": "easy" | "medium" | "hard",
  "modelAnswer": string,
  "explanation": string,
  "whatItTests": string,
  "keyPoints": string[]
}`;

const QUESTION_JSON_SHAPE = `{"questions": [${QUESTION_OBJECT_SHAPE}]}`;

export class GeminiProvider implements AiProvider {
  private readonly client: GoogleGenerativeAI;
  private readonly modelName: string;

  constructor(apiKey: string, modelName: string = DEFAULT_MODEL) {
    if (!apiKey) {
      throw new AiProviderError("GEMINI_API_KEY is not configured.");
    }
    this.client = new GoogleGenerativeAI(apiKey);
    this.modelName = modelName;
  }

  private model() {
    return this.client.getGenerativeModel({
      model: this.modelName,
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.9,
      },
    });
  }

  private async generate(prompt: string): Promise<string> {
    const result = await this.model().generateContent(prompt, { timeout: REQUEST_TIMEOUT_MS });
    const candidate = result.response.candidates?.[0];
    const text = result.response.text();
    if (!text || !text.trim()) {
      const blockReason = result.response.promptFeedback?.blockReason;
      const finishReason = candidate?.finishReason;
      throw new AiProviderError(
        blockReason
          ? "The AI declined to respond to this request."
          : finishReason && finishReason !== "STOP"
            ? "The AI response was cut off before completing."
            : "The AI returned an empty response."
      );
    }
    return text;
  }

  async generateQuestions(req: GenerateQuestionsRequest): Promise<GeneratedQuestion[]> {
    if (req.questionCount < 1) {
      throw new AiProviderError("At least one question must be requested.");
    }

    const avoidTexts = req.avoidQuestionTexts ?? [];
    const avoidBlock =
      avoidTexts.length > 0
        ? `\nThese questions were already asked in this interview — do not repeat them or ask a near-duplicate:\n${avoidTexts
            .slice(0, 30)
            .map((t) => `- ${t}`)
            .join("\n")}\n`
        : "";

    const prompt = `You are a senior, competent interviewer designing a real interview — not a textbook quiz.

Role: ${req.role}
Candidate experience level: ${req.experienceLevel}
Interview type selected by the candidate: ${req.interviewType}
Focus topics: ${req.topics.join(", ")}
Requested difficulty setting: ${req.difficulty}
Generate up to ${req.questionCount} questions (fewer is fine if that's all that's genuinely good — never pad with filler).
${avoidBlock}
${QUESTION_TYPE_GUIDANCE}

${DIFFICULTY_GUIDANCE}

Requirements:
- Every question must be specific to "${req.role}" at "${req.experienceLevel}" experience — never a generic question that could apply to any role.
- Ground questions in the selected focus topics.
- If the interview type is not "mixed", every question's questionType should be consistent with that selection (e.g. "technical" selection → technical/conceptual questions, not behavioral ones). If "mixed", vary the types deliberately.
- If the difficulty setting is not "mixed", every question's difficulty should match it. If "mixed", give the set intentional progression: start with an easier/fundamentals question, then practical application, then harder reasoning — do not put every question at the same difficulty.
- No two questions should test the same narrow thing.
- Concise enough to answer out loud in an interview — no multi-part essay prompts.
- Never invent a fake company name or fake product for the candidate to have worked on.
- "modelAnswer" is a strong, concrete answer to the question itself (not a description of what a good answer would contain).
- "explanation" says briefly why an interviewer would ask this.
- "whatItTests" is one sentence naming the specific skill/judgment being assessed.
- "keyPoints" are 2-5 concrete points a strong answer would hit (not restatements of the question).

Respond ONLY with JSON in this exact shape, no prose, no markdown code fences:
${QUESTION_JSON_SHAPE}`;

    let raw: unknown;
    try {
      const text = await this.generate(prompt);
      raw = parseJsonResponse(text);
    } catch (error) {
      if (error instanceof AiProviderError) throw error;
      throw classifyProviderError(error, "generating questions");
    }

    const envelope = generatedQuestionsResponseSchema.safeParse(raw);
    if (!envelope.success) {
      throw new AiProviderError("The AI's question response didn't match the expected shape.", envelope.error);
    }

    const validQuestions = extractValidQuestions(envelope.data.questions);
    if (validQuestions.length === 0) {
      throw new AiProviderError("The AI didn't return any usable questions.");
    }

    const deduped = dedupeGeneratedQuestions(validQuestions, avoidTexts);
    if (deduped.length === 0) {
      throw new AiProviderError("The AI only returned questions that duplicate existing ones.");
    }

    return deduped.slice(0, req.questionCount);
  }

  async evaluateAnswer(req: EvaluateAnswerRequest): Promise<AnswerEvaluation> {
    const keyPointsBlock =
      req.keyPoints && req.keyPoints.length > 0
        ? `Key points a strong answer should hit:\n${req.keyPoints.map((p) => `- ${p}`).join("\n")}\n`
        : "";
    const modelAnswerBlock = req.modelAnswer ? `Reference strong answer (for grading, not for the candidate):\n${req.modelAnswer}\n` : "";

    const prompt = `You are an experienced interview coach evaluating a single candidate answer. Be honest and specific — scores must actually differ based on answer quality, not cluster around the same number.

Role: ${req.role}
Experience level: ${req.experienceLevel}
Question type: ${req.questionType ?? "unspecified"}
Question: ${req.question}
${keyPointsBlock}${modelAnswerBlock}
Candidate answer: ${req.answerText}

Score each dimension 0-10 using this rubric:
- technicalScore: Does the answer demonstrate technically correct understanding relevant to the question?
- accuracyScore: Are the specific claims, facts, and reasoning in the answer correct?
- communicationScore: Is the answer structured, clear, and easy to follow?
- confidenceScore: Does the candidate communicate their decisions and reasoning directly, without hedging everything?
- overallScore: a holistic interview-quality score — not simply the average of the above.

Then give:
- strengths: concrete things the answer did well (empty array if genuinely none).
- weaknesses: concrete gaps or problems (empty array if genuinely none).
- feedback: 1-3 sentences of concise coaching, specific to this answer — not generic advice.
- improvementSuggestions: concrete, actionable suggestions.
- needsFollowUp: true ONLY if the answer leaves an important gap, makes an unsupported claim, skips a trade-off worth probing, or a clarifying question would meaningfully test understanding further. Do not set this true just to extend the interview — most complete, solid answers do not need one.
- followUpQuestion: if needsFollowUp is true, a short question that directly references something specific the candidate said (quote or paraphrase it) — never a generic definitional question like "What is X?". If needsFollowUp is false, this must be null.

Respond ONLY with JSON in this exact shape, no prose, no markdown code fences:
{"overallScore": number, "technicalScore": number, "communicationScore": number, "accuracyScore": number, "confidenceScore": number, "strengths": string[], "weaknesses": string[], "feedback": string, "improvementSuggestions": string[], "needsFollowUp": boolean, "followUpQuestion": string | null}`;

    let raw: unknown;
    try {
      const text = await this.generate(prompt);
      raw = parseJsonResponse(text);
    } catch (error) {
      if (error instanceof AiProviderError) throw error;
      throw classifyProviderError(error, "evaluating the answer");
    }

    const coerced = coerceEvaluationJson(raw);
    const parsed = answerEvaluationSchema.safeParse(coerced);
    if (!parsed.success) {
      throw new AiProviderError("The AI's evaluation response didn't match the expected shape.", parsed.error);
    }

    return parsed.data;
  }

  async generateFollowUp(req: EvaluateAnswerRequest): Promise<string | null> {
    const evaluation = await this.evaluateAnswer(req);
    return evaluation.needsFollowUp ? evaluation.followUpQuestion : null;
  }

  async analyzeResume(req: AnalyzeResumeRequest): Promise<ResumeAnalysis> {
    const resumeText = truncateResumeText(req.resumeText);

    const prompt = `You are preparing a resume-grounded interview for a candidate.

Target role: ${req.targetRole}
Resume text:
"""
${resumeText}
"""

Summarize the candidate in 2-3 sentences based only on what the resume actually says.
Suggest relevant topics for the interview based on the resume's content and the target role.

Then generate up to 8 interview questions grounded in the resume, prioritized in this order:
1. Specific projects mentioned
2. Specific technologies/tools mentioned
3. Responsibilities described
4. Measurable achievements/metrics
5. Architecture or technical decisions described
6. Claims that deserve deeper questioning

Rules:
- Only ask about technologies, projects, and claims that actually appear in the resume text above. Never invent or assume experience, a technology, or a company that isn't mentioned.
- If the resume mentions a specific project (e.g. "Built an AI application using Next.js, Supabase and Gemini"), you may ask about that project and those exact named technologies — nothing more.
- Follow the same question structure as a normal generated question (see shape below), including questionType, difficulty, modelAnswer, explanation, whatItTests, and keyPoints.
${QUESTION_TYPE_GUIDANCE}
Most resume-grounded questions will naturally be "project_experience", but use "technical" or "system_design" where the resume content calls for it.

Respond ONLY with JSON in this exact shape, no prose, no markdown code fences:
{"summary": string, "suggestedTopics": string[], "suggestedQuestions": [${QUESTION_OBJECT_SHAPE}]}`;

    let raw: unknown;
    try {
      const text = await this.generate(prompt);
      raw = parseJsonResponse(text);
    } catch (error) {
      if (error instanceof AiProviderError) throw error;
      throw classifyProviderError(error, "analyzing the resume");
    }

    const rawObject = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
    const coerced = {
      summary: typeof rawObject.summary === "string" ? rawObject.summary : "",
      suggestedTopics: Array.isArray(rawObject.suggestedTopics) ? rawObject.suggestedTopics : [],
      suggestedQuestions: Array.isArray(rawObject.suggestedQuestions) ? rawObject.suggestedQuestions : [],
    };

    const envelope = resumeAnalysisSchema.safeParse(coerced);
    if (!envelope.success) {
      throw new AiProviderError("The AI's resume analysis didn't match the expected shape.", envelope.error);
    }

    const validQuestions = dedupeGeneratedQuestions(extractValidQuestions(envelope.data.suggestedQuestions));
    if (validQuestions.length === 0) {
      throw new AiProviderError("The AI didn't return any usable resume-grounded questions.");
    }

    return {
      summary: envelope.data.summary,
      suggestedTopics: envelope.data.suggestedTopics,
      suggestedQuestions: validQuestions,
    };
  }

  /**
   * Optional higher-level coaching narrative for the analytics page.
   * The prompt is intentionally small: it receives only the already-
   * computed aggregate statistics (see CoachSummaryRequest), never raw
   * interview transcripts or full answer text, and is called only when
   * the user explicitly requests it — not on every analytics page load.
   */
  async generateCoachSummary(req: CoachSummaryRequest): Promise<CoachSummary> {
    const topicLines = req.topicBreakdown.map((t) => `- ${t.topic}: ${t.average}/10`).join("\n");
    const difficultyLines = req.difficultyBreakdown
      ? req.difficultyBreakdown.map((d) => `- ${d.difficulty}: ${d.average}/10`).join("\n")
      : "Not enough difficulty data yet.";
    const improvementLines =
      req.improvementAreas.length > 0
        ? req.improvementAreas.map((a) => `- ${a}`).join("\n")
        : "None recorded yet.";
    const trendLine = req.timeBasedImprovement
      ? `First interview scored ${req.timeBasedImprovement.firstScore}/10, most recent scored ${req.timeBasedImprovement.recentScore}/10 (${req.timeBasedImprovement.absoluteImprovement >= 0 ? "+" : ""}${req.timeBasedImprovement.absoluteImprovement}).`
      : "Not enough completed interviews yet to show a trend.";

    const prompt = `You are a concise, encouraging interview coach reviewing a candidate's aggregated mock-interview statistics — you were not given and must not invent any specific question or answer content.

Completed interviews analyzed: ${req.completedInterviewsCount}
Overall score: ${req.overallScore}/10
Technical: ${req.technicalScore ?? "n/a"}/10, Communication: ${req.communicationScore ?? "n/a"}/10, Accuracy: ${req.accuracyScore ?? "n/a"}/10, Confidence: ${req.confidenceScore ?? "n/a"}/10
Strongest topic: ${req.strongestTopic ? `${req.strongestTopic.topic} (${req.strongestTopic.average}/10)` : "n/a"}
Weakest topic: ${req.weakestTopic ? `${req.weakestTopic.topic} (${req.weakestTopic.average}/10)` : "n/a"}
Topic breakdown:
${topicLines || "n/a"}
Difficulty breakdown:
${difficultyLines}
Recurring improvement areas from past feedback:
${improvementLines}
Trend: ${trendLine}

Write:
- "summary": 2-3 sentences, holistic, grounded ONLY in the numbers above. No invented specifics.
- "focusArea": one sentence naming the single highest-leverage thing to practice next.
- "encouragement": one short, genuine, specific (not generic) sentence of encouragement.

Respond ONLY with JSON in this exact shape, no prose, no markdown code fences:
{"summary": string, "focusArea": string, "encouragement": string}`;

    let raw: unknown;
    try {
      const text = await this.generate(prompt);
      raw = parseJsonResponse(text);
    } catch (error) {
      if (error instanceof AiProviderError) throw error;
      throw classifyProviderError(error, "generating a coaching summary");
    }

    const parsed = coachSummarySchema.safeParse(raw);
    if (!parsed.success) {
      throw new AiProviderError("The AI's coaching summary didn't match the expected shape.", parsed.error);
    }

    return parsed.data;
  }
}

/**
 * Fills in safe defaults for optional-ish fields the model may have
 * omitted (an empty `weaknesses` array is a reasonable default; a
 * missing `overallScore` is not — that's left to fail Zod validation
 * rather than defaulted to a fabricated number) and clamps any
 * out-of-range scores instead of rejecting the whole evaluation over a
 * single field like `technicalScore: 11`.
 */
function coerceEvaluationJson(raw: unknown): Record<string, unknown> {
  const obj = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};

  const clampScore = (value: unknown): unknown => {
    if (typeof value !== "number" || Number.isNaN(value)) return value;
    return Math.max(0, Math.min(10, value));
  };

  return {
    ...obj,
    overallScore: clampScore(obj.overallScore),
    technicalScore: clampScore(obj.technicalScore),
    communicationScore: clampScore(obj.communicationScore),
    accuracyScore: clampScore(obj.accuracyScore),
    confidenceScore: clampScore(obj.confidenceScore),
    strengths: Array.isArray(obj.strengths) ? obj.strengths : [],
    weaknesses: Array.isArray(obj.weaknesses) ? obj.weaknesses : [],
    improvementSuggestions: Array.isArray(obj.improvementSuggestions) ? obj.improvementSuggestions : [],
    needsFollowUp: typeof obj.needsFollowUp === "boolean" ? obj.needsFollowUp : Boolean(obj.followUpQuestion),
    followUpQuestion: typeof obj.followUpQuestion === "string" ? obj.followUpQuestion : null,
  };
}
