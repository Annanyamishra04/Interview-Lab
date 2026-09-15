import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

/**
 * Browser-side Supabase client. Only ever holds the public anon key —
 * never the service role key, which stays server-only (see server.ts).
 * Session tokens are stored in cookies (not localStorage), which is what
 * lets server components and middleware read the same session.
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""
  );
}
