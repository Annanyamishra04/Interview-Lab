"use server";

import { revalidatePath } from "next/cache";
import { answerSubmissionSchema } from "@/lib/validation/interview";
import {
  getInterviewState,
  submitAndEvaluateAnswer,
  type InterviewState,
} from "@/services/interview-service";
import { markInterviewCompleted } from "@/services/interviews";
import type { ExperienceLevel } from "@/lib/validation/interview";

export interface GetInterviewStateResult {
  ok: boolean;
  state?: InterviewState;
  error?: string;
}

/**
 * The single read path the workspace uses on mount, after a refresh, and
 * when returning to an in-progress interview. `getInterviewState` returns
 * null for an interview that doesn't exist or doesn't belong to the
 * caller (enforced by RLS) — both are reported as a human-readable error
 * rather than a stack trace.
 */
export async function getInterviewStateAction(interviewId: string): Promise<GetInterviewStateResult> {
  if (!interviewId) {
    return { ok: false, error: "No interview specified." };
  }

  try {
    const state = await getInterviewState(interviewId);
    if (!state) {
      return { ok: false, error: "That interview doesn't exist or isn't yours." };
    }
    return { ok: true, state };
  } catch {
    return { ok: false, error: "Couldn't load that interview right now." };
  }
}

export interface SubmitAnswerActionResult {
  ok: boolean;
  /** The answer is saved even when `ok` is false due to an evaluation
   *  failure — the caller can offer "retry evaluation" without asking
   *  the user to retype anything. */
  answerSaved?: boolean;
  state?: InterviewState;
  error?: string;
}

/**
 * Persists the answer, evaluates it, persists the evaluation, and
 * persists any follow-up question the model produced — then returns the
 * full refreshed interview state so the client never has to reconcile
 * partial updates by hand.
 */
export async function submitAnswerAction(input: {
  interviewId: string;
  questionId: string;
  answerText: string;
  question: string;
  role: string;
  experienceLevel: ExperienceLevel;
  questionType?: string | null;
  modelAnswer?: string | null;
  keyPoints?: string[];
}): Promise<SubmitAnswerActionResult> {
  const parsed = answerSubmissionSchema.safeParse({
    questionId: input.questionId,
    answerText: input.answerText,
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Write an answer before submitting." };
  }

  try {
    const result = await submitAndEvaluateAnswer(input.interviewId, parsed.data, {
      question: input.question,
      role: input.role,
      experienceLevel: input.experienceLevel,
      questionType: input.questionType,
      modelAnswer: input.modelAnswer,
      keyPoints: input.keyPoints,
    });

    const state = await getInterviewState(input.interviewId);
    if (!state) {
      return { ok: false, error: "Couldn't reload the interview after saving your answer." };
    }

    if (result.evaluationFailed) {
      return {
        ok: false,
        answerSaved: true,
        state,
        error: "Your answer was saved, but evaluation failed. Try again.",
      };
    }

    return { ok: true, answerSaved: true, state };
  } catch {
    return { ok: false, error: "Couldn't save that answer right now. Try again." };
  }
}

export interface CompleteInterviewActionResult {
  ok: boolean;
  state?: InterviewState;
  error?: string;
}

/**
 * Marks the interview completed. Idempotent — see
 * services/interviews.ts::markInterviewCompleted — so calling this twice
 * (e.g. a double-click, or the results screen re-mounting after a
 * refresh) never overwrites the original completion time.
 */
export async function completeInterviewAction(
  interviewId: string
): Promise<CompleteInterviewActionResult> {
  try {
    await markInterviewCompleted(interviewId);
    const state = await getInterviewState(interviewId);
    if (!state) {
      return { ok: false, error: "Couldn't load the completed interview." };
    }
    revalidatePath("/dashboard");
    revalidatePath("/history");
    return { ok: true, state };
  } catch {
    return { ok: false, error: "Couldn't mark this interview complete. Try again." };
  }
}
