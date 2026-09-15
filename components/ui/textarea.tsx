import * as React from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        aria-invalid={Boolean(error)}
        className={cn(
          "w-full rounded border bg-stone-panel px-3.5 py-3 text-body-sm text-ink placeholder:text-ink-muted",
          "border-line-strong transition-colors focus-visible:border-brass",
          "min-h-[10rem] resize-y",
          error && "border-signal-error",
          className
        )}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";
