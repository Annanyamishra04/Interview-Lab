import "server-only";
import {
  type SupportedResumeFileType,
  resolveResumeFileType,
  MAX_RESUME_FILE_BYTES,
} from "@/lib/resume/constants";

/**
 * Text extraction for the three supported resume formats. Kept separate
 * from services/resumes.ts (which only talks to the DB) and from the
 * upload action (which only talks to Storage) — this module's only job
 * is turning bytes into text. Re-exports the shared constants so callers
 * only need one import path for the extraction pipeline.
 */
export { resolveResumeFileType, MAX_RESUME_FILE_BYTES };
export type { SupportedResumeFileType };

export class ResumeExtractionError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "ResumeExtractionError";
  }
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  // Dynamic import: pdfjs-dist's Node build ships as ESM-only, and this
  // module is otherwise consumed from CJS-compiled server actions.
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const data = new Uint8Array(buffer);

  let doc;
  try {
    doc = await pdfjsLib.getDocument({ data, verbosity: 0 }).promise;
  } catch (error) {
    throw new ResumeExtractionError("This PDF couldn't be read — it may be corrupted or scanned images only.", error);
  }

  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
    const page = await doc.getPage(pageNumber);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");
    pages.push(pageText);
  }

  return pages.join("\n\n").trim();
}

async function extractDocxText(buffer: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  try {
    const result = await mammoth.extractRawText({ buffer });
    return result.value.trim();
  } catch (error) {
    throw new ResumeExtractionError("This Word document couldn't be read — it may be corrupted.", error);
  }
}

function extractTxtText(buffer: Buffer): string {
  return buffer.toString("utf-8").trim();
}

export async function extractResumeText(
  buffer: Buffer,
  fileType: SupportedResumeFileType
): Promise<string> {
  const text =
    fileType === "pdf"
      ? await extractPdfText(buffer)
      : fileType === "docx"
        ? await extractDocxText(buffer)
        : extractTxtText(buffer);

  if (!text || text.length < 20) {
    throw new ResumeExtractionError(
      "This file didn't contain readable text — it may be empty, a scanned image, or password-protected."
    );
  }

  return text;
}
