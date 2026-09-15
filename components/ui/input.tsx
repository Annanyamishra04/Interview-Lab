import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <input
        ref={ref}
        aria-invalid={Boolean(error)}
        className={cn(
          "h-11 w-full rounded border bg-stone-panel px-3.5 text-body-sm text-ink placeholder:text-ink-muted",
          "border-line-strong transition-colors focus-visible:border-brass",
          error && "border-signal-error",
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";
