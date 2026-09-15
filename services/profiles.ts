import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Tables, TablesUpdate } from "@/types/database";

export type Profile = Tables<"profiles">;

/**
 * Every function here re-derives the caller's identity from the current
 * Supabase session (`auth.getUser()`) rather than accepting a user id as
 * an argument — a caller can never ask this layer for someone else's
 * profile, even by mistake, and Row Level Security backs that up at the
 * database level regardless.
 */
export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export interface UpdateProfileInput {
  fullName?: string;
  avatarUrl?: string;
  targetRole?: string;
  experienceLevel?: string;
}

export async function updateProfile(input: UpdateProfileInput): Promise<Profile> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated.");

  const patch: TablesUpdate<"profiles"> = {};
  if (input.fullName !== undefined) patch.full_name = input.fullName;
  if (input.avatarUrl !== undefined) patch.avatar_url = input.avatarUrl;
  if (input.targetRole !== undefined) patch.target_role = input.targetRole;
  if (input.experienceLevel !== undefined) patch.experience_level = input.experienceLevel;

  const { data, error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function markOnboardingCompleted(): Promise<void> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated.");

  const { error } = await supabase
    .from("profiles")
    .update({ onboarding_completed: true })
    .eq("user_id", user.id);

  if (error) throw error;
}
