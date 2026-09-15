import "server-only";
import type { GeneratedQuestion } from "@/lib/ai/types";

/**
 * Lightweight server-side anti-repetition check shared by every AI
 * provider implementation and by the service layer that persists
 * follow-up questions. Deliberately just word-overlap on the question
 * text — no embeddings or vector store, per the free-tier requirement.
 * Lives under lib/ai/ (not inside a specific provider file) so
 * services/interview-service.ts can use it without importing a vendor
 * SDK directly, preserving the AiProvider abstraction.
 */

const DUPLICATE_SIMILARITY_THRESHOLD = 0.6;

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 2)
  );
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection += 1;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/** Filters `candidates` down to the ones that aren't near-duplicates of
 *  something already in `avoidTexts` or of each other (in list order —
 *  the first occurrence of a near-duplicate pair is kept). */
export function dedupeGeneratedQuestions(
  candidates: GeneratedQuestion[],
  avoidTexts: string[] = []
): GeneratedQuestion[] {
  const kept: GeneratedQuestion[] = [];
  const keptTokens: Set<string>[] = avoidTexts.map(tokenize);

  for (const candidate of candidates) {
    const tokens = tokenize(candidate.prompt);
    const isDuplicate = keptTokens.some(
      (existing) => jaccardSimilarity(tokens, existing) >= DUPLICATE_SIMILARITY_THRESHOLD
    );
    if (!isDuplicate) {
      kept.push(candidate);
      keptTokens.push(tokens);
    }
  }

  return kept;
}

/** True if `candidateText` is a near-duplicate of any text in
 *  `existingTexts` — used when persisting a single ad hoc follow-up
 *  question against an interview's full existing question set. */
export function isNearDuplicateQuestion(candidateText: string, existingTexts: string[]): boolean {
  const candidateTokens = tokenize(candidateText);
  return existingTexts.some(
    (text) => jaccardSimilarity(candidateTokens, tokenize(text)) >= DUPLICATE_SIMILARITY_THRESHOLD
  );
}
