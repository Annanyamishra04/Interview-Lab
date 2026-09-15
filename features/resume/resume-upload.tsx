"use client";

import * as React from "react";
import { FileText, UploadCloud, X, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { uploadResumeAction, extractResumeAction } from "@/app/resume/actions";
import type { ResumeRecord } from "@/services/resumes";
import { MAX_RESUME_FILE_BYTES, RESUME_ACCEPTED_EXTENSIONS } from "@/lib/resume/constants";

type Status = "idle" | "selecting" | "uploading" | "extracting" | "ready" | "failed";

const ACCEPTED_EXTENSIONS = RESUME_ACCEPTED_EXTENSIONS;
const ACCEPTED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isAcceptedFile(file: File): boolean {
  if (ACCEPTED_MIME_TYPES.includes(file.type)) return true;
  const lower = file.name.toLowerCase();
  return ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export function ResumeUpload({ onReady }: { onReady: (resume: ResumeRecord) => void }) {
  const [status, setStatus] = React.useState<Status>("idle");
  const [file, setFile] = React.useState<File | null>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [resume, setResume] = React.useState<ResumeRecord | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const pickFile = (candidate: File) => {
    setError(null);
    if (!isAcceptedFile(candidate)) {
      setError("Upload a PDF, DOCX, or TXT file.");
      return;
    }
    if (candidate.size > MAX_RESUME_FILE_BYTES) {
      setError("That file is too large — the limit is 5MB.");
      return;
    }
    setFile(candidate);
    setResume(null);
    setStatus("selecting");
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) pickFile(f);
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) pickFile(f);
  };

  const reset = () => {
    setFile(null);
    setResume(null);
    setStatus("idle");
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  // Two real, sequential server round trips — "uploading" and
  // "extracting" each reflect an actual await, not a timed simulation.
  const startUpload = async () => {
    if (!file) return;
    setStatus("uploading");
    setError(null);

    const formData = new FormData();
    formData.append("file", file);
    const uploadOutcome = await uploadResumeAction(formData);

    if (!uploadOutcome.ok || !uploadOutcome.resume) {
      setError(uploadOutcome.error ?? "Couldn't upload that file.");
      setStatus("failed");
      return;
    }
    setResume(uploadOutcome.resume);

    if (uploadOutcome.resume.upload_status === "ready" && uploadOutcome.resume.extracted_text) {
      setStatus("ready");
      onReady(uploadOutcome.resume);
      return;
    }

    setStatus("extracting");
    const extractOutcome = await extractResumeAction(uploadOutcome.resume.id);
    if (extractOutcome.resume) setResume(extractOutcome.resume);

    if (!extractOutcome.ok || !extractOutcome.resume) {
      setError(extractOutcome.error ?? "Couldn't read that file.");
      setStatus("failed");
      return;
    }

    setStatus("ready");
    onReady(extractOutcome.resume);
  };

  const retryExtraction = async () => {
    if (!resume) return;
    setStatus("extracting");
    setError(null);
    const outcome = await extractResumeAction(resume.id);
    if (outcome.resume) setResume(outcome.resume);
    if (!outcome.ok || !outcome.resume) {
      setError(outcome.error ?? "Couldn't read that file.");
      setStatus("failed");
      return;
    }
    setStatus("ready");
    onReady(outcome.resume);
  };

  if (status === "idle") {
    return (
      <div>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-3 rounded border-2 border-dashed px-6 py-14 text-center transition-colors",
            isDragging ? "border-brass bg-brass-tint/30" : "border-line-strong bg-stone-panel hover:border-brass"
          )}
        >
          <UploadCloud className="h-7 w-7 text-ink-muted" aria-hidden />
          <p className="text-body-sm text-ink">
            <span className="text-brass-dim underline">Choose a file</span> or drag it here
          </p>
          <p className="text-meta text-ink-muted">PDF, DOCX, or TXT · up to 5MB</p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_EXTENSIONS.join(",")}
          className="hidden"
          onChange={onInputChange}
        />
        {error && <p className="mt-2 text-body-sm text-signal-error">{error}</p>}
      </div>
    );
  }

  return (
    <div className="rounded border border-line-strong bg-stone-panel px-5 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <FileText className="mt-0.5 h-5 w-5 shrink-0 text-ink-muted" aria-hidden />
          <div>
            <p className="text-body-sm font-medium text-ink">{file?.name ?? resume?.file_name}</p>
            {file && <p className="mt-0.5 text-meta text-ink-muted">{formatFileSize(file.size)}</p>}
          </div>
        </div>
        {(status === "selecting" || status === "failed") && (
          <button
            type="button"
            onClick={reset}
            className="text-ink-muted hover:text-ink"
            aria-label="Remove file"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="mt-4">
        {status === "selecting" && (
          <Button type="button" variant="accent" onClick={startUpload}>
            Upload &amp; read resume
          </Button>
        )}

        {(status === "uploading" || status === "extracting") && (
          <p className="flex items-center gap-2 text-body-sm text-ink-soft">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            {status === "uploading" ? "Uploading…" : "Reading your resume…"}
          </p>
        )}

        {status === "ready" && (
          <p className="flex items-center gap-2 text-body-sm text-signal-success">
            <CheckCircle2 className="h-4 w-4" aria-hidden />
            Resume ready
          </p>
        )}

        {status === "failed" && (
          <div>
            <p className="flex items-center gap-2 text-body-sm text-signal-error">
              <AlertTriangle className="h-4 w-4" aria-hidden />
              {error ?? "Something went wrong."}
            </p>
            <div className="mt-3 flex gap-3">
              {resume?.upload_status === "uploaded" || resume?.upload_status === "failed" ? (
                <Button type="button" variant="outline" size="sm" onClick={retryExtraction}>
                  Try reading it again
                </Button>
              ) : (
                <Button type="button" variant="outline" size="sm" onClick={startUpload}>
                  Try again
                </Button>
              )}
              <Button type="button" variant="ghost" size="sm" onClick={reset}>
                Choose a different file
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
