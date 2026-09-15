"use client";

import * as React from "react";
import { Bookmark, BookmarkCheck, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { saveQuestionAction, removeSavedQuestionAction } from "@/app/saved/actions";

type Status = "saved" | "unsaved" | "saving" | "unsaving";

export function SaveQuestionButton({
  questionId,
  initiallySaved,
  className,
}: {
  questionId: string;
  initiallySaved: boolean;
  className?: string;
}) {
  const [status, setStatus] = React.useState<Status>(initiallySaved ? "saved" : "unsaved");

  const toggle = async () => {
    if (status === "saving" || status === "unsaving") return;

    if (status === "saved") {
      setStatus("unsaving");
      const outcome = await removeSavedQuestionAction(questionId);
      setStatus(outcome.ok ? "unsaved" : "saved");
      return;
    }

    setStatus("saving");
    const outcome = await saveQuestionAction(questionId);
    setStatus(outcome.ok ? "saved" : "unsaved");
  };

  const isBusy = status === "saving" || status === "unsaving";
  const isSaved = status === "saved" || status === "unsaving";

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={isBusy}
      aria-pressed={isSaved}
      aria-label={isSaved ? "Remove from saved questions" : "Save this question"}
      className={cn(
        "inline-flex items-center gap-1.5 text-meta transition-colors disabled:opacity-60",
        isSaved ? "text-brass-dim" : "text-ink-muted hover:text-ink",
        className
      )}
    >
      {isBusy ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
      ) : isSaved ? (
        <BookmarkCheck className="h-3.5 w-3.5" aria-hidden />
      ) : (
        <Bookmark className="h-3.5 w-3.5" aria-hidden />
      )}
      {isSaved ? "Saved" : "Save"}
    </button>
  );
}
