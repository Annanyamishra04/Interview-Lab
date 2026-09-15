import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ResumeUploadStatus, Tables } from "@/types/database";

export type ResumeRecord = Tables<"resumes">;

export interface CreateResumeInput {
  fileName?: string;
  storagePath?: string;
  extractedText?: string;
}

export async function listResumes(): Promise<ResumeRecord[]> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("resumes")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

export async function getResumeById(id: string): Promise<ResumeRecord | null> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.from("resumes").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Looks up a resume by its content hash before any upload happens, so a
 * retried upload of a file that's already fully processed (`ready`) can
 * skip re-uploading bytes and re-running extraction entirely — not just
 * avoid a duplicate row, but avoid the wasted work too.
 */
export async function getResumeByContentHash(contentHash: string): Promise<ResumeRecord | null> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("resumes")
    .select("*")
    .eq("user_id", user.id)
    .eq("content_hash", contentHash)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function createResumeRecord(input: CreateResumeInput): Promise<ResumeRecord> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated.");

  const { data, error } = await supabase
    .from("resumes")
    .insert({
      user_id: user.id,
      file_name: input.fileName ?? null,
      storage_path: input.storagePath ?? null,
      extracted_text: input.extractedText ?? null,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export interface UpsertUploadedResumeInput {
  fileName: string;
  storagePath: string;
  fileType: string;
  fileSize: number;
  contentHash: string;
}

/**
 * Upserts on `(user_id, content_hash)`. Re-uploading the exact same file
 * (a retried submit, a double-click) updates the one existing row rather
 * than creating a duplicate — the same idempotency pattern used for
 * answers and evaluations in the persistence phase.
 */
export async function upsertUploadedResume(
  input: UpsertUploadedResumeInput
): Promise<ResumeRecord> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated.");

  const { data, error } = await supabase
    .from("resumes")
    .upsert(
      {
        user_id: user.id,
        file_name: input.fileName,
        storage_path: input.storagePath,
        file_type: input.fileType,
        file_size: input.fileSize,
        content_hash: input.contentHash,
        upload_status: "uploaded",
        error_message: null,
      },
      { onConflict: "user_id,content_hash" }
    )
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function updateResumeStatus(
  id: string,
  status: ResumeUploadStatus,
  patch?: { extractedText?: string; errorMessage?: string | null }
): Promise<ResumeRecord> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("resumes")
    .update({
      upload_status: status,
      extracted_text: patch?.extractedText,
      error_message: patch?.errorMessage ?? null,
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}
