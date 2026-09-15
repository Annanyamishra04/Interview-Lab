"use server";

import { getAiProvider } from "@/lib/ai";
import type { CoachSummary } from "@/lib/ai/types";
import { getCoachContext, type AnalyticsFilters } from "@/services/analytics";

export interface GenerateCoachSummaryResult {
  ok: boolean;
  summary?: CoachSummary;
  error?: string;
}

/**
 * Called only when the user clicks "Generate coaching summary" on the
 * analytics page — never automatically on page load or page refresh.
 * The deterministic statistics are always computed first, with zero AI
 * calls; Gemini is only used for the short narrative on top, and a
 * failure here never blocks or breaks the rest of the analytics page,
 * since every other number was already rendered before this is called.
 */
export async function generateCoachSummaryAction(
  filters: AnalyticsFilters = {}
): Promise<GenerateCoachSummaryResult> {
  try {
    const context = await getCoachContext(filters);
    if (!context) {
      return {
        ok: false,
        error: "Not enough scored data yet to generate a coaching summary.",
      };
    }

    const summary = await getAiProvider().generateCoachSummary(context);
    return { ok: true, summary };
  } catch {
    return {
      ok: false,
      error: "Couldn't generate a coaching summary right now. Try again shortly.",
    };
  }
}
