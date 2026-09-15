import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

export type SavedQuestionRecord = Tables<"saved_questions">;

export async function listSavedQuestions(): Promise<SavedQuestionRecord[]> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("saved_questions")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

export interface SavedQuestionWithContext extends SavedQuestionRecord {
  question: {
    id: string;
    questionText: string;
    topic: string | null;
    difficulty: string | null;
    interviewId: string;
  } | null;
  interview: {
    id: string;
    targetRole: string;
    status: string;
  } | null;
}

/**
 * Same table as `listSavedQuestions`, joined through
 * `interview_questions` → `interviews` for display: the question text
 * and which interview it came from. RLS on both of those tables (via
 * `interview_id`'s ownership chain) applies to the join exactly as it
 * would to a direct query — this is a read, not a way around it.
 */
export async function listSavedQuestionsWithContext(): Promise<SavedQuestionWithContext[]> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("saved_questions")
    .select(
      "*, interview_questions(id, question_text, topic, difficulty, interview_id, interviews(id, target_role, status))"
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) throw error;

  interface JoinedRow extends SavedQuestionRecord {
    interview_questions: {
      id: string;
      question_text: string;
      topic: string | null;
      difficulty: string | null;
      interview_id: string;
      interviews: { id: string; target_role: string; status: string } | null;
    } | null;
  }

  return ((data ?? []) as unknown as JoinedRow[]).map((row) => ({
    ...row,
    question: row.interview_questions
      ? {
          id: row.interview_questions.id,
          questionText: row.interview_questions.question_text,
          topic: row.interview_questions.topic,
          difficulty: row.interview_questions.difficulty,
          interviewId: row.interview_questions.interview_id,
        }
      : null,
    interview: row.interview_questions?.interviews
      ? {
          id: row.interview_questions.interviews.id,
          targetRole: row.interview_questions.interviews.target_role,
          status: row.interview_questions.interviews.status,
        }
      : null,
  }));
}

/**
 * Which of a given interview's questions the user has already saved —
 * used by the workspace to render the bookmark button in the correct
 * initial state without a separate round trip per question.
 */
export async function getSavedQuestionIdsForInterview(interviewId: string): Promise<string[]> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("saved_questions")
    .select("question_id, interview_questions!inner(interview_id)")
    .eq("user_id", user.id)
    .eq("interview_questions.interview_id", interviewId);

  if (error) throw error;
  return ((data ?? []) as unknown as { question_id: string }[]).map((r) => r.question_id);
}

/**
 * The `saved_questions(user_id, question_id)` unique constraint is the
 * real guarantee against duplicate saves — `upsert` with `ignoreDuplicates`
 * just turns that constraint violation into a quiet no-op instead of an
 * error the UI would have to handle.
 */
export async function saveQuestion(questionId: string, note?: string): Promise<void> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated.");

  const { error } = await supabase
    .from("saved_questions")
    .upsert(
      { user_id: user.id, question_id: questionId, note: note ?? null },
      { onConflict: "user_id,question_id", ignoreDuplicates: true }
    );

  if (error) throw error;
}

export async function removeSavedQuestion(questionId: string): Promise<void> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated.");

  const { error } = await supabase
    .from("saved_questions")
    .delete()
    .eq("user_id", user.id)
    .eq("question_id", questionId);

  if (error) throw error;
}
