import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Tag marks a piece of metadata (skill, difficulty, status) — sentence
 * case, never tracked-out caps. Teal is the default; brass is reserved
 * for a tag that means "active" or "in progress."
 */
export function Tag({
  className,
  tone = "teal",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: "teal" | "brass" | "neutral" }) {
  const toneClasses = {
    teal: "bg-teal-tint text-teal",
    brass: "bg-brass-tint text-brass-dim",
    neutral: "bg-stone-deep text-ink-muted",
  }[tone];

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm px-2 py-0.5 text-meta font-medium",
        toneClasses,
        className
      )}
      {...props}
    />
  );
}
