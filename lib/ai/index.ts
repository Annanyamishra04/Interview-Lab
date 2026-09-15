import "server-only";
import type { AiProvider } from "@/lib/ai/types";
import { GeminiProvider } from "@/lib/ai/providers/gemini";

let cachedProvider: AiProvider | null = null;

/**
 * Returns the configured AI provider. Gemini is the default and only
 * provider today; adding a second one means writing a new class that
 * implements `AiProvider` and adding a branch here — no other file in
 * the app imports a vendor SDK directly.
 */
export function getAiProvider(): AiProvider {
  if (cachedProvider) return cachedProvider;

  const providerName = process.env.AI_PROVIDER ?? "gemini";

  switch (providerName) {
    case "gemini":
      cachedProvider = new GeminiProvider(process.env.GEMINI_API_KEY ?? "", process.env.GEMINI_MODEL || undefined);
      break;
    default:
      throw new Error(`Unknown AI_PROVIDER "${providerName}".`);
  }

  return cachedProvider;
}

export * from "@/lib/ai/types";
