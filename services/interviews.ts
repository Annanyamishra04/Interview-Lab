import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { InterviewStatus, Tables } from "@/types/database";

export type InterviewRecord = Tables<"interviews">;

/**
 * Persistence for interview *records* — the row that says "this user set
 * up a session with these parameters." This is deliberately separate
 * from `services/interview-service.ts`, which talks to the AI provider
 * to generate the actual questions (not implemented until Phase 4).
 * Nothing here calls an AI provider, and nothing in that file touches
 * the database — the split keeps "what did the user ask for" and "what
 * did the model produce" independently testable.
 */

export interface CreateInterviewInput {
  targetRole: string;
  experienceLevel: string;
  interviewType: string;
  difficulty: string;
  topics: string[];
  questionCount: number;
  title?: string;
  resumeId?: string;
}

export async function createInterview(input: CreateInterviewInput): Promise<InterviewRecord> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated.");

  const { data, error } = await supabase
    .from("interviews")
    .insert({
      user_id: user.id,
      title: input.title ?? input.targetRole,
      target_role: input.targetRole,
      experience_level: input.experienceLevel,
      interview_type: input.interviewType,
      difficulty: input.difficulty,
      topics: input.topics,
      question_count: input.questionCount,
      status: "draft",
      resume_id: input.resumeId ?? null,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function getUserInterviews(): Promise<InterviewRecord[]> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("interviews")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

export async function getInterviewById(id: string): Promise<InterviewRecord | null> {
  const supabase = createSupabaseServerClient();
  // No explicit `.eq("user_id", user.id)` needed for correctness — RLS
  // already guarantees this returns null instead of another user's row —
  // but a session check up front avoids a round trip for signed-out callers.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase.from("interviews").select("*").eq("id", id).maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * The single most recent interview still `in_progress`, for the
 * dashboard's "continue where you left off" card. Returns null rather
 * than an empty placeholder when there is none — the dashboard shows an
 * intentional "start a new session" CTA in that case instead of a fake
 * empty card.
 */
export async function getMostRecentInProgressInterview(): Promise<InterviewRecord | null> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("interviews")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "in_progress")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function updateInterviewStatus(
  id: string,
  status: InterviewStatus
): Promise<void> {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("interviews").update({ status }).eq("id", id);
  if (error) throw error;
}

/**
 * Moves a draft interview into in_progress the first time an answer is
 * submitted. Safe to call on every submission — it only ever writes when
 * the interview is still in `draft`, so it never clobbers `completed`.
 */
export async function markInterviewInProgress(id: string): Promise<void> {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("interviews")
    .update({ status: "in_progress" })
    .eq("id", id)
    .eq("status", "draft");
  if (error) throw error;
}

/**
 * Marks an interview completed and stamps `completed_at`. Idempotent: a
 * retried call (e.g. the user double-clicks "finish") only updates rows
 * that are not already completed, and `completed_at` is only ever set
 * once — a second call is a harmless no-op rather than overwriting the
 * original completion time.
 */
export async function markInterviewCompleted(id: string): Promise<InterviewRecord | null> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("interviews")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", id)
    .neq("status", "completed")
    .select("*")
    .maybeSingle();
  if (error) throw error;
  if (data) return data;

  // Already completed — return the existing row instead of treating this
  // as a failure, so a page refresh or a retried "finish" click is a
  // no-op rather than an error.
  return getInterviewById(id);
}

export async function deleteInterview(id: string): Promise<void> {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("interviews").delete().eq("id", id);
  if (error) throw error;
}
