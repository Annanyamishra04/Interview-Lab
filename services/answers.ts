import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

export type AnswerRecord = Tables<"interview_answers">;

/**
 * Upserts on the `unique(question_id, user_id)` constraint rather than
 * inserting, so a page refresh, a retried submission, or the user
 * re-answering a question they already answered updates the one existing
 * row instead of creating a duplicate. This is the "prevent accidental
 * duplicate answer records" requirement — enforced at the database level,
 * not just by disabling the submit button.
 */
export async function submitAnswer(
  questionId: string,
  answerText: string
): Promise<AnswerRecord> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated.");

  const { data, error } = await supabase
    .from("interview_answers")
    .upsert(
      {
        question_id: questionId,
        user_id: user.id,
        answer_text: answerText,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "question_id,user_id" }
    )
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function getAnswerForQuestion(questionId: string): Promise<AnswerRecord | null> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("interview_answers")
    .select("*")
    .eq("question_id", questionId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getAnswersForInterview(interviewId: string): Promise<AnswerRecord[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("interview_answers")
    .select("*, interview_questions!inner(interview_id)")
    .eq("interview_questions.interview_id", interviewId);

  if (error) throw error;
  return data as unknown as AnswerRecord[];
}
