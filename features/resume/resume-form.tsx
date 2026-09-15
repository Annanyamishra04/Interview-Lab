"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { Tag } from "@/components/ui/tag";
import { ResumeUpload } from "@/features/resume/resume-upload";
import {
  analyzeResumeAction,
  beginResumeSessionAction,
  type AnalyzeResumeActionResult,
} from "@/app/resume/actions";
import type { ResumeRecord } from "@/services/resumes";

export function ResumeForm() {
  const router = useRouter();
  const [targetRole, setTargetRole] = React.useState("");
  const [resume, setResume] = React.useState<ResumeRecord | null>(null);
  const [isAnalyzing, setIsAnalyzing] = React.useState(false);
  const [isStarting, setIsStarting] = React.useState(false);
  const [startError, setStartError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<AnalyzeResumeActionResult | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resume || isAnalyzing) return;
    setIsAnalyzing(true);
    const outcome = await analyzeResumeAction({ resumeId: resume.id, targetRole });
    setResult(outcome);
    setIsAnalyzing(false);
  };

  const beginSession = async () => {
    if (!result?.ok || !result.analysis || !resume || isStarting) return;
    setIsStarting(true);
    setStartError(null);
    const outcome = await beginResumeSessionAction({
      resumeId: resume.id,
      targetRole,
      analysis: result.analysis,
    });
    setIsStarting(false);
    if (!outcome.ok || !outcome.interviewId) {
      setStartError(outcome.error ?? "Couldn't start that session.");
      return;
    }
    router.push(`/interview/session?interviewId=${outcome.interviewId}`);
  };

  return (
    <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_1fr]">
      <form onSubmit={onSubmit} className="space-y-5">
        <div>
          <label htmlFor="targetRole" className="text-body-sm text-ink-soft">
            Target role
          </label>
          <Input
            id="targetRole"
            className="mt-1.5"
            value={targetRole}
            onChange={(e) => setTargetRole(e.target.value)}
            placeholder="e.g. Product Manager"
            required
          />
        </div>
        <div>
          <p className="text-body-sm text-ink-soft">Resume</p>
          <div className="mt-1.5">
            <ResumeUpload onReady={setResume} />
          </div>
        </div>
        {result?.error && <p className="text-body-sm text-signal-error">{result.error}</p>}
        <Button
          type="submit"
          variant="accent"
          disabled={isAnalyzing || !resume || resume.upload_status !== "ready" || !targetRole.trim()}
        >
          {isAnalyzing ? "Reading resume…" : "Analyze resume"}
        </Button>
      </form>

      <Surface inset="lg" className="h-fit">
        <p className="text-meta text-ink-muted">Session preview</p>
        {!result?.ok && (
          <p className="mt-3 text-body-sm text-ink-soft">
            A summary and question set will appear here once your resume is analyzed.
          </p>
        )}
        {result?.ok && result.analysis && (
          <>
            <p className="mt-3 text-body-sm text-ink-soft">{result.analysis.summary}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {result.analysis.suggestedTopics.map((topic) => (
                <Tag key={topic} tone="neutral">
                  {topic}
                </Tag>
              ))}
            </div>
            <ol className="mt-5 space-y-4">
              {result.analysis.suggestedQuestions.map((q, i) => (
                <li key={i} className="border-t border-line pt-3">
                  <Tag tone="teal">{q.topic}</Tag>
                  <p className="mt-1.5 text-body-sm text-ink">{q.prompt}</p>
                </li>
              ))}
            </ol>
            {startError && <p className="mt-3 text-body-sm text-signal-error">{startError}</p>}
            <Button
              type="button"
              variant="accent"
              className="mt-6 w-full"
              onClick={beginSession}
              disabled={isStarting}
            >
              {isStarting ? "Starting…" : "Begin session"}
            </Button>
          </>
        )}
      </Surface>
    </div>
  );
}
