"use client";

import { useState, useTransition } from "react";
import { Surface } from "@/components/ui/surface";
import { Button } from "@/components/ui/button";
import { generateCoachSummaryAction } from "@/features/analytics/actions";
import type { CoachSummary } from "@/lib/ai/types";
import type { AnalyticsFilters } from "@/services/analytics";

/**
 * Deliberately opt-in: the deterministic analytics above this card are
 * always computed on every page load, but this AI narrative is only
 * generated when the person clicks the button — never automatically, so
 * a page refresh never triggers a new Gemini call.
 */
export function AiCoach({ filters }: { filters: AnalyticsFilters }) {
  const [summary, setSummary] = useState<CoachSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function generate() {
    setError(null);
    startTransition(async () => {
      const result = await generateCoachSummaryAction(filters);
      if (result.ok && result.summary) {
        setSummary(result.summary);
      } else {
        setError(result.error ?? "Couldn't generate a coaching summary right now.");
      }
    });
  }

  return (
    <Surface inset="lg" className="mt-6 border-l-2 border-l-brass">
      <p className="text-meta text-ink-muted">AI coach</p>

      {!summary && !error && (
        <>
          <p className="mt-2 text-body-sm text-ink-soft">
            Get a short, holistic read on your performance — generated on demand from your
            aggregated stats above, not on every visit.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={generate}
            disabled={isPending}
          >
            {isPending ? "Thinking…" : "Generate coaching summary"}
          </Button>
        </>
      )}

      {error && (
        <>
          <p className="mt-2 text-body-sm text-signal-error">{error}</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={generate} disabled={isPending}>
            {isPending ? "Thinking…" : "Try again"}
          </Button>
        </>
      )}

      {summary && (
        <div className="mt-3 space-y-3">
          <p className="text-body-sm text-ink">{summary.summary}</p>
          <p className="text-body-sm text-ink-soft">
            <span className="font-medium text-ink">Focus next: </span>
            {summary.focusArea}
          </p>
          <p className="text-body-sm italic text-ink-soft">{summary.encouragement}</p>
        </div>
      )}
    </Surface>
  );
}
