import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

/**
 * Server-side Supabase client, bound to the request's cookies so auth
 * state is available in server components, route handlers, and server
 * actions. Call this fresh per request — never module-level singleton it,
 * since it's tied to the current request's cookie jar.
 *
 * Uses the current `getAll`/`setAll` cookie contract (the `get`/`set`/
 * `remove` shape is deprecated in @supabase/ssr). `setAll` is wrapped in
 * a try/catch because Server Components can't write cookies — that's
 * fine as long as `middleware.ts` is refreshing the session on every
 * request, which it does (see middleware.ts).
 */
export function createSupabaseServerClient() {
  const cookieStore = cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Called from a Server Component — middleware refreshes the
            // session cookie on the next request, so this is safe to skip.
          }
        },
      },
    }
  );
}
