"use server";

import { interviewSetupSchema } from "@/lib/validation/interview";
import { generateAndPersistQuestions } from "@/services/interview-service";
import { createInterview } from "@/services/interviews";
import { updateProfile, markOnboardingCompleted } from "@/services/profiles";
import type { QuestionRecord } from "@/services/questions";

export interface SetupActionResult {
  ok: boolean;
  interviewId?: string;
  questions?: QuestionRecord[];
  /** True when the interview record was saved but AI question generation
   *  isn't available (no provider configured yet, or the call failed) —
   *  distinct from `ok: false`, since the user's setup was NOT lost. */
  aiUnavailable?: boolean;
  error?: string;
}

/**
 * Persisting the interview record to Supabase is the required part of
 * this step (Phase 3) — it happens first and any failure here is a real
 * error. Generating the actual question set via the AI provider is
 * best-effort on top of that: if it's unavailable, the setup itself is
 * still saved and reported back as such, not silently discarded.
 */
export async function createInterviewAction(formData: unknown): Promise<SetupActionResult> {
  const parsed = interviewSetupSchema.safeParse(formData);

  if (!parsed.success) {
    return { ok: false, error: "Check the setup form for missing fields." };
  }

  let interviewId: string;
  try {
    const interview = await createInterview({
      targetRole: parsed.data.role,
      experienceLevel: parsed.data.experienceLevel,
      interviewType: parsed.data.interviewType,
      difficulty: parsed.data.difficulty,
      topics: parsed.data.topics,
      questionCount: parsed.data.questionCount,
    });
    interviewId = interview.id;

    await Promise.all([
      updateProfile({
        targetRole: parsed.data.role,
        experienceLevel: parsed.data.experienceLevel,
      }),
      markOnboardingCompleted(),
    ]);
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    return {
      ok: false,
      error:
        message === "Not authenticated."
          ? "Log in again to build an interview."
          : "Couldn't save your setup. Try again in a moment.",
    };
  }

  try {
    const questions = await generateAndPersistQuestions(interviewId, parsed.data);
    return { ok: true, interviewId, questions };
  } catch {
    return { ok: true, interviewId, aiUnavailable: true };
  }
}
