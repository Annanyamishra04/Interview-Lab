import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Tables, TablesInsert } from "@/types/database";

export type EvaluationRecord = Tables<"evaluations">;

export interface CreateEvaluationInput {
  answerId: string;
  overallScore?: number;
  technicalScore?: number;
  communicationScore?: number;
  accuracyScore?: number;
  confidenceScore?: number;
  strengths?: string[];
  weaknesses?: string[];
  feedback?: string;
  improvementSuggestions?: string[];
}

export async function getEvaluationForAnswer(
  answerId: string
): Promise<EvaluationRecord | null> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("evaluations")
    .select("*")
    .eq("answer_id", answerId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * Upserts on the `unique(answer_id)` constraint. A retried evaluation
 * call (network hiccup, user re-triggering after a timeout) replaces the
 * previous result for that answer rather than creating a second row.
 */
export async function createEvaluation(input: CreateEvaluationInput): Promise<EvaluationRecord> {
  const supabase = createSupabaseServerClient();

  const row: TablesInsert<"evaluations"> = {
    answer_id: input.answerId,
    overall_score: input.overallScore ?? null,
    technical_score: input.technicalScore ?? null,
    communication_score: input.communicationScore ?? null,
    accuracy_score: input.accuracyScore ?? null,
    confidence_score: input.confidenceScore ?? null,
    strengths: input.strengths ?? [],
    weaknesses: input.weaknesses ?? [],
    feedback: input.feedback ?? null,
    improvement_suggestions: input.improvementSuggestions ?? [],
  };

  const { data, error } = await supabase
    .from("evaluations")
    .upsert(row, { onConflict: "answer_id" })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

/**
 * All evaluations for an interview, keyed by answer id, for the results
 * screen. Joins through interview_answers → interview_questions so RLS
 * (which has no direct user_id column on either evaluations or
 * interview_questions) still fully applies — this is a read, not a
 * bypass of it.
 */
export async function getEvaluationsForInterview(
  interviewId: string
): Promise<EvaluationRecord[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("evaluations")
    .select("*, interview_answers!inner(question_id, interview_questions!inner(interview_id))")
    .eq("interview_answers.interview_questions.interview_id", interviewId);

  if (error) throw error;
  return data as unknown as EvaluationRecord[];
}
