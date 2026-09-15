"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loginSchema, signUpSchema, type LoginInput, type SignUpInput } from "@/lib/validation/auth";
import { mapAuthError, safeRedirectPath } from "@/lib/supabase/errors";

export interface AuthActionResult {
  ok: boolean;
  error?: string;
  needsEmailConfirmation?: boolean;
}

/**
 * Auth runs entirely server-side: the form posts plain field values to a
 * Server Action, which is the only place that talks to Supabase Auth.
 * This keeps the session cookie write on the server (where `server.ts`'s
 * client can set it) and means a raw Supabase error never reaches the
 * browser unmapped. Redirects happen here, not in the client component,
 * so there's no window where a signed-in user is still looking at the
 * auth form.
 */
export async function signUpAction(input: SignUpInput): Promise<AuthActionResult> {
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Check the form for errors." };
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { name: parsed.data.name } },
  });

  if (error) {
    return { ok: false, error: mapAuthError(error) };
  }

  // If email confirmation is enabled on the project, `signUp` succeeds
  // but returns no session yet — the profile row still gets created (via
  // the `on_auth_user_created` trigger) as soon as the auth user exists,
  // but we can't redirect into the app until the session is real.
  if (!data.session) {
    return { ok: true, needsEmailConfirmation: true };
  }

  redirect("/onboarding");
}

export async function loginAction(
  input: LoginInput,
  redirectTo?: string
): Promise<AuthActionResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Enter a valid email and password." };
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return { ok: false, error: mapAuthError(error) };
  }

  redirect(safeRedirectPath(redirectTo));
}

export async function logoutAction(): Promise<void> {
  const supabase = createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/");
}
