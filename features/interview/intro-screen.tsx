"use client";

import { Surface } from "@/components/ui/surface";
import { Button } from "@/components/ui/button";
import { Tag } from "@/components/ui/tag";
import type { InterviewRecord } from "@/services/interviews";

const TYPE_LABEL: Record<string, string> = {
  technical: "Technical",
  behavioral: "Behavioral",
  situational: "Situational",
  mixed: "Mixed",
};

const DIFFICULTY_LABEL: Record<string, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
  mixed: "Mixed",
};

/**
 * A short, one-screen interviewer introduction shown before the first
 * question of a session — not a chatbot greeting, just the handful of
 * facts a candidate would want before an interview starts. Shown once
 * per session (gated by the caller on the session having no answers
 * yet); dismissing it is local UI state, not persisted, since seeing it
 * twice after a refresh is a non-issue.
 */
export function InterviewIntro({
  interview,
  questionCount,
  onBegin,
}: {
  interview: InterviewRecord;
  questionCount: number;
  onBegin: () => void;
}) {
  return (
    <Surface inset="lg" className="mx-auto max-w-prose">
      <div className="flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-brass" aria-hidden />
        <p className="text-meta uppercase tracking-wide text-ink-muted">Interviewer</p>
      </div>

      <h1 className="mt-3 font-display text-display-md text-ink">
        Interviewing for {interview.target_role}
      </h1>

      <p className="mt-4 text-body-sm text-ink-soft">
        We&rsquo;ll go through {questionCount} question{questionCount === 1 ? "" : "s"}, one at a
        time. Answer as you would out loud — I&rsquo;ll review each answer and may ask a follow-up
        when it&rsquo;s worth probing further.
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        <Tag tone="brass">{TYPE_LABEL[interview.interview_type] ?? interview.interview_type}</Tag>
        <Tag tone="neutral">{DIFFICULTY_LABEL[interview.difficulty] ?? interview.difficulty}</Tag>
        <Tag tone="neutral">{interview.experience_level} experience</Tag>
      </div>

      <ul className="mt-6 space-y-2 border-t border-line pt-5 text-body-sm text-ink-soft">
        <li>Every answer is scored and reviewed before the next question.</li>
        <li>Follow-ups happen only when an answer leaves something worth probing.</li>
        <li>Nothing is lost if you refresh or step away — pick up right where you left off.</li>
      </ul>

      <Button variant="accent" className="mt-7" onClick={onBegin}>
        Begin interview
      </Button>
    </Surface>
  );
}
