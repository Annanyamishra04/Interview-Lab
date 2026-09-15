import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

export type QuestionRecord = Tables<"interview_questions">;

/**
 * No AI provider is called from this file. `createQuestions` exists so
 * Phase 4 has somewhere to persist model output — it takes plain data,
 * not a prompt or a provider response.
 */

export interface CreateQuestionInput {
  questionText: string;
  questionType?: string;
  topic?: string;
  difficulty?: string;
  order: number;
  modelAnswer?: string;
  explanation?: string;
  whatItTests?: string;
  keyPoints?: string[];
  isFollowUp?: boolean;
  parentQuestionId?: string | null;
}

export async function getQuestionById(id: string): Promise<QuestionRecord | null> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("interview_questions")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getQuestionsForInterview(interviewId: string): Promise<QuestionRecord[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("interview_questions")
    .select("*")
    .eq("interview_id", interviewId)
    .order("question_order", { ascending: true });

  if (error) throw error;
  return data;
}

/**
 * Bulk insert used for freshly-generated question sets. Callers are
 * responsible for idempotency here — see
 * `interview-service.ts::generateAndPersistQuestions`, which only calls
 * this when the interview has no questions yet, so a page refresh or a
 * retried generation request never reaches this function twice for the
 * same interview.
 */
export async function createQuestions(
  interviewId: string,
  questions: CreateQuestionInput[]
): Promise<QuestionRecord[]> {
  if (questions.length === 0) return [];

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("interview_questions")
    .insert(
      questions.map((q) => ({
        interview_id: interviewId,
        question_text: q.questionText,
        question_type: q.questionType ?? null,
        topic: q.topic ?? null,
        difficulty: q.difficulty ?? null,
        question_order: q.order,
        model_answer: q.modelAnswer ?? null,
        explanation: q.explanation ?? null,
        what_it_tests: q.whatItTests ?? null,
        key_points: q.keyPoints ?? [],
        is_follow_up: q.isFollowUp ?? false,
        parent_question_id: q.parentQuestionId ?? null,
      }))
    )
    .select("*");

  if (error) throw error;
  return data;
}

/**
 * Inserts a single AI-generated follow-up question, ordered immediately
 * after its parent. The `unique(interview_id, question_order)` constraint
 * is the real duplicate guard: if this is ever called twice for the same
 * parent with the same computed order (e.g. a double-submit), the second
 * insert fails the constraint and the caller's upstream retry logic
 * (submitAnswer's own idempotency) means it's never actually attempted
 * twice for the same answer in practice.
 */
export async function createFollowUpQuestion(
  interviewId: string,
  parent: QuestionRecord,
  questionText: string
): Promise<QuestionRecord> {
  const supabase = createSupabaseServerClient();

  const { data: siblings, error: siblingsError } = await supabase
    .from("interview_questions")
    .select("question_order")
    .eq("interview_id", interviewId)
    .eq("parent_question_id", parent.id);

  if (siblingsError) throw siblingsError;

  // Fit the new follow-up between the parent and the next full question,
  // stacking additional follow-ups for the same parent slightly further
  // along so ordering stays stable no matter how many are generated.
  const existingFollowUps = siblings?.length ?? 0;
  const order = Number(parent.question_order) + 0.001 * (existingFollowUps + 1);

  const { data, error } = await supabase
    .from("interview_questions")
    .insert({
      interview_id: interviewId,
      question_text: questionText,
      question_type: parent.question_type,
      topic: parent.topic,
      difficulty: parent.difficulty,
      question_order: order,
      is_follow_up: true,
      parent_question_id: parent.id,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}
