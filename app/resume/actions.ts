"use server";

import crypto from "node:crypto";
import { z } from "zod";
import { getAiProvider } from "@/lib/ai";
import type { ResumeAnalysis } from "@/lib/ai/types";
import { createInterview } from "@/services/interviews";
import { createQuestions, type QuestionRecord } from "@/services/questions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getResumeById,
  getResumeByContentHash,
  upsertUploadedResume,
  updateResumeStatus,
  type ResumeRecord,
} from "@/services/resumes";
import {
  extractResumeText,
  resolveResumeFileType,
  ResumeExtractionError,
  MAX_RESUME_FILE_BYTES,
} from "@/lib/resume/extract-text";

export interface UploadResumeResult {
  ok: boolean;
  resume?: ResumeRecord;
  error?: string;
}

/**
 * Stage one of the pipeline: validate → upload bytes to Storage → upsert
 * the DB record as "uploaded". Deliberately does not extract text —
 * extraction is a separate action (`extractResumeAction`) so the client
 * can show a genuine "uploading" state for this network round trip and a
 * genuine "extracting" state for the next one, rather than faking a
 * progress transition partway through one combined call.
 */
export async function uploadResumeAction(formData: FormData): Promise<UploadResumeResult> {
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { ok: false, error: "No file was selected." };
  }
  if (file.size === 0) {
    return { ok: false, error: "That file is empty." };
  }
  if (file.size > MAX_RESUME_FILE_BYTES) {
    return { ok: false, error: "That file is too large — the limit is 5MB." };
  }

  const fileType = resolveResumeFileType(file.type, file.name);
  if (!fileType) {
    return { ok: false, error: "Upload a PDF, DOCX, or TXT file." };
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Log in again to upload a resume." };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  // Content hash is the idempotency key: re-submitting the exact same
  // bytes (a retried click, a flaky connection) writes to the same
  // storage path and upserts the same DB row instead of duplicating
  // either.
  const contentHash = crypto.createHash("sha256").update(buffer).digest("hex");

  // If this exact file was already uploaded and successfully extracted,
  // skip re-uploading and re-processing it entirely rather than just
  // avoiding a duplicate row.
  const existing = await getResumeByContentHash(contentHash);
  if (existing && existing.upload_status === "ready" && existing.extracted_text) {
    return { ok: true, resume: existing };
  }

  const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100);
  const storagePath = `users/${user.id}/resumes/${contentHash}-${safeFileName}`;

  const { error: uploadError } = await supabase.storage
    .from("resumes")
    .upload(storagePath, buffer, { contentType: file.type || undefined, upsert: true });

  if (uploadError) {
    return { ok: false, error: "Couldn't upload that file right now. Try again." };
  }

  try {
    const resume = await upsertUploadedResume({
      fileName: file.name,
      storagePath,
      fileType,
      fileSize: file.size,
      contentHash,
    });
    return { ok: true, resume };
  } catch {
    return { ok: false, error: "Couldn't save this upload. Try again." };
  }
}

export interface ExtractResumeResult {
  ok: boolean;
  resume?: ResumeRecord;
  error?: string;
}

/**
 * Stage two: download the just-uploaded bytes back from Storage
 * server-side and extract text from them. Re-downloading (rather than
 * threading the original bytes through from the client) is what keeps
 * "Upload → Storage → server-side extraction" an honest description of
 * the actual flow instead of the file just passing through memory once.
 */
export async function extractResumeAction(resumeId: string): Promise<ExtractResumeResult> {
  const resume = await getResumeById(resumeId);
  if (!resume) {
    return { ok: false, error: "That upload couldn't be found." };
  }

  // Already extracted (e.g. re-uploading a file whose hash matched an
  // existing ready resume) — nothing left to do.
  if (resume.upload_status === "ready" && resume.extracted_text) {
    return { ok: true, resume };
  }

  if (!resume.storage_path || !resume.file_type) {
    return { ok: false, error: "This upload is missing file data — try uploading again." };
  }

  const supabase = createSupabaseServerClient();
  const { data: blob, error: downloadError } = await supabase.storage
    .from("resumes")
    .download(resume.storage_path);
  if (downloadError || !blob) {
    return { ok: false, error: "Couldn't read that file back from storage. Try uploading again." };
  }

  const buffer = Buffer.from(await blob.arrayBuffer());
  const fileType = resume.file_type as "pdf" | "docx" | "txt";

  try {
    await updateResumeStatus(resume.id, "extracting");
    const text = await extractResumeText(buffer, fileType);
    const updated = await updateResumeStatus(resume.id, "ready", { extractedText: text });
    return { ok: true, resume: updated };
  } catch (error) {
    const message =
      error instanceof ResumeExtractionError
        ? error.message
        : "Couldn't extract text from that file.";
    const updated = await updateResumeStatus(resume.id, "failed", { errorMessage: message });
    return { ok: false, resume: updated, error: message };
  }
}

const analyzeResumeSchema = z.object({
  resumeId: z.string().uuid(),
  targetRole: z.string().min(2, "Enter a target role."),
});

export interface AnalyzeResumeActionResult {
  ok: boolean;
  analysis?: ResumeAnalysis;
  error?: string;
}

export async function analyzeResumeAction(input: unknown): Promise<AnalyzeResumeActionResult> {
  const parsed = analyzeResumeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form and try again." };
  }

  const resume = await getResumeById(parsed.data.resumeId);
  if (!resume || resume.upload_status !== "ready" || !resume.extracted_text) {
    return { ok: false, error: "This resume isn't ready yet — try uploading it again." };
  }

  try {
    const analysis = await getAiProvider().analyzeResume({
      resumeText: resume.extracted_text,
      targetRole: parsed.data.targetRole,
    });
    return { ok: true, analysis };
  } catch {
    return { ok: false, error: "Couldn't analyze that resume right now. Try again in a moment." };
  }
}

export interface BeginResumeSessionResult {
  ok: boolean;
  interviewId?: string;
  questions?: QuestionRecord[];
  error?: string;
}

/**
 * Turns a resume analysis the user has already seen into a real,
 * persisted interview — same destination shape as the role-first setup
 * flow (services/interviews.ts + services/questions.ts), so the
 * workspace and recovery logic don't need to know which path produced
 * the interview.
 */
export async function beginResumeSessionAction(input: {
  resumeId: string;
  targetRole: string;
  analysis: ResumeAnalysis;
}): Promise<BeginResumeSessionResult> {
  if (!input.targetRole.trim() || input.analysis.suggestedQuestions.length === 0) {
    return { ok: false, error: "Nothing to start a session with yet." };
  }

  try {
    const interview = await createInterview({
      targetRole: input.targetRole,
      experienceLevel: "3-5",
      interviewType: "mixed",
      difficulty: "medium",
      topics: input.analysis.suggestedTopics.length > 0 ? input.analysis.suggestedTopics : ["Resume"],
      questionCount: input.analysis.suggestedQuestions.length,
      title: `${input.targetRole} (from resume)`,
      resumeId: input.resumeId,
    });

    const questions = await createQuestions(
      interview.id,
      input.analysis.suggestedQuestions.map((q, i) => ({
        questionText: q.prompt,
        topic: q.topic,
        questionType: q.questionType,
        difficulty: q.difficulty,
        modelAnswer: q.modelAnswer,
        explanation: q.explanation,
        whatItTests: q.whatItTests,
        keyPoints: q.keyPoints,
        order: i + 1,
      }))
    );

    return { ok: true, interviewId: interview.id, questions };
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    return {
      ok: false,
      error:
        message === "Not authenticated."
          ? "Log in again to build an interview."
          : "Couldn't save this interview. Try again in a moment.",
    };
  }
}
