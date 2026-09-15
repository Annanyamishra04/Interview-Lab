import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Surface is the one container primitive used across the product in place
 * of "floating cards." It is distinguished from the page by a hairline
 * border and a slightly lighter fill — never a drop shadow or radius
 * bigger than the design system's `lg`.
 */
export function Surface({
  className,
  inset = "md",
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { inset?: "none" | "sm" | "md" | "lg" }) {
  const padding = {
    none: "",
    sm: "p-4",
    md: "p-6",
    lg: "p-8",
  }[inset];

  return (
    <div
      className={cn(
        "rounded-md border border-line bg-stone-panel",
        padding,
        className
      )}
      {...props}
    />
  );
}
