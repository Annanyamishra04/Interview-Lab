/**
 * Constants shared between the client-side upload widget (file picker
 * validation, size limit display) and the server-side extraction module.
 * Deliberately has no `server-only` import so the client bundle can pull
 * it in directly instead of reaching into `extract-text.ts`.
 */

export const SUPPORTED_RESUME_MIME_TYPES = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "text/plain": "txt",
} as const;

export type SupportedResumeFileType =
  (typeof SUPPORTED_RESUME_MIME_TYPES)[keyof typeof SUPPORTED_RESUME_MIME_TYPES];

export const MAX_RESUME_FILE_BYTES = 5 * 1024 * 1024; // 5MB — comfortably under
// Vercel/serverless request body limits, generous for a text resume.

export const RESUME_ACCEPTED_EXTENSIONS = [".pdf", ".docx", ".txt"] as const;

/**
 * Resolves a supported file type from its MIME type, falling back to the
 * file extension for browsers/OSes that send a generic
 * "application/octet-stream" for DOCX or TXT.
 */
export function resolveResumeFileType(mimeType: string, fileName: string): SupportedResumeFileType | null {
  const byMime = SUPPORTED_RESUME_MIME_TYPES[mimeType as keyof typeof SUPPORTED_RESUME_MIME_TYPES];
  if (byMime) return byMime;

  const extension = fileName.toLowerCase().split(".").pop();
  if (extension === "pdf") return "pdf";
  if (extension === "docx") return "docx";
  if (extension === "txt") return "txt";
  return null;
}
