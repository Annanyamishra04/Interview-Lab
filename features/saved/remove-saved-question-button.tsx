"use client";

import * as React from "react";
import { X, Loader2 } from "lucide-react";
import { removeSavedQuestionAction } from "@/app/saved/actions";

export function RemoveSavedQuestionButton({ questionId }: { questionId: string }) {
  const [status, setStatus] = React.useState<"idle" | "removing" | "removed" | "error">("idle");

  if (status === "removed") return null;

  const remove = async () => {
    setStatus("removing");
    const outcome = await removeSavedQuestionAction(questionId);
    setStatus(outcome.ok ? "removed" : "error");
  };

  return (
    <button
      type="button"
      onClick={remove}
      disabled={status === "removing"}
      className="inline-flex shrink-0 items-center gap-1.5 text-meta text-ink-muted transition-colors hover:text-signal-error disabled:opacity-60"
    >
      {status === "removing" ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
      ) : (
        <X className="h-3.5 w-3.5" aria-hidden />
      )}
      Remove
      {status === "error" && <span className="text-signal-error">· couldn&apos;t remove</span>}
    </button>
  );
}
