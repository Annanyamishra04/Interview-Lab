"use server";

import { revalidatePath } from "next/cache";
import { saveQuestion, removeSavedQuestion } from "@/services/saved-questions";

export interface SavedQuestionActionResult {
  ok: boolean;
  error?: string;
}

/**
 * Thin wrapper around the existing saved-questions service — this file
 * adds no persistence logic of its own, just the server-action boundary
 * and the human-readable error handling the UI needs.
 */
export async function saveQuestionAction(questionId: string): Promise<SavedQuestionActionResult> {
  try {
    await saveQuestion(questionId);
    revalidatePath("/saved");
    return { ok: true };
  } catch {
    return { ok: false, error: "Couldn't save that question. Try again." };
  }
}

export async function removeSavedQuestionAction(questionId: string): Promise<SavedQuestionActionResult> {
  try {
    await removeSavedQuestion(questionId);
    revalidatePath("/saved");
    return { ok: true };
  } catch {
    return { ok: false, error: "Couldn't remove that question. Try again." };
  }
}
