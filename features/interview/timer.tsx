"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * A lightweight, visible-but-not-stressful timer for the current
 * question. Deliberately UI state only — see the product brief: adding
 * persistence here would mean writing on every tick, which is out of
 * proportion to what the timer is for (a sense of pace, not a graded
 * constraint). It never submits anything on its own; it just counts.
 *
 * Resetting is driven entirely by `resetKey` (the current question's id)
 * changing, so it survives normal re-renders within the same question
 * but starts clean the moment the question changes — including after a
 * follow-up is inserted, since that's a new question id.
 */
export function QuestionTimer({
  resetKey,
  paused = false,
  className,
}: {
  resetKey: string;
  paused?: boolean;
  className?: string;
}) {
  const [seconds, setSeconds] = React.useState(0);

  React.useEffect(() => {
    setSeconds(0);
  }, [resetKey]);

  React.useEffect(() => {
    if (paused) return;
    const interval = setInterval(() => {
      setSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [paused, resetKey]);

  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const display = `${minutes}:${secs.toString().padStart(2, "0")}`;

  return (
    <div
      className={cn("flex items-center gap-2", className)}
      aria-label="Time on this question"
    >
      <span
        className={`inline-block h-1.5 w-1.5 rounded-full ${
          paused ? "bg-ink-muted" : "bg-brass animate-pulse-ring"
        }`}
        aria-hidden
      />
      <span className="font-mono text-data tabular-nums text-ink-muted">{display}</span>
    </div>
  );
}
