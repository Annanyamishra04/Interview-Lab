-- InterviewLab — Phase 3 schema
-- Foundation for auth-backed profiles + interview data. No AI generation
-- happens yet; this migration only creates the tables, relationships,
-- indexes, and Row Level Security policies that later phases will fill.
--
-- Apply with the Supabase CLI:
--   supabase db push
-- or paste into the SQL editor in the Supabase dashboard.

create extension if not exists "pgcrypto";

-- ==========================================================
-- updated_at helper
-- ==========================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ==========================================================
-- profiles
-- One row per auth user. `id` is the profile's own identifier;
-- `user_id` is the foreign key into auth.users and is what every
-- RLS policy checks against.
-- ==========================================================
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  full_name text,
  avatar_url text,
  target_role text,
  experience_level text,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_user_id_idx on public.profiles (user_id);

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auto-create a profile row whenever a new auth user is created, so the
-- app never has to race the client against the database for this.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'name')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ==========================================================
-- interviews
-- ==========================================================
create table if not exists public.interviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text,
  target_role text not null,
  experience_level text not null,
  interview_type text not null,
  difficulty text not null,
  topics text[] not null default '{}',
  question_count integer not null default 10,
  status text not null default 'draft'
    check (status in ('draft', 'in_progress', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists interviews_user_id_idx on public.interviews (user_id);
create index if not exists interviews_status_idx on public.interviews (status);

drop trigger if exists set_interviews_updated_at on public.interviews;
create trigger set_interviews_updated_at
  before update on public.interviews
  for each row execute function public.set_updated_at();

-- ==========================================================
-- interview_questions
-- Ready for Phase 4's AI generation — no rows are written yet.
-- ==========================================================
create table if not exists public.interview_questions (
  id uuid primary key default gen_random_uuid(),
  interview_id uuid not null references public.interviews (id) on delete cascade,
  question_text text not null,
  question_type text,
  topic text,
  difficulty text,
  question_order integer not null,
  model_answer text,
  explanation text,
  created_at timestamptz not null default now(),
  unique (interview_id, question_order)
);

create index if not exists interview_questions_interview_id_idx
  on public.interview_questions (interview_id);

-- ==========================================================
-- interview_answers
-- ==========================================================
create table if not exists public.interview_answers (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.interview_questions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  answer_text text not null,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (question_id, user_id)
);

create index if not exists interview_answers_question_id_idx
  on public.interview_answers (question_id);
create index if not exists interview_answers_user_id_idx
  on public.interview_answers (user_id);

drop trigger if exists set_interview_answers_updated_at on public.interview_answers;
create trigger set_interview_answers_updated_at
  before update on public.interview_answers
  for each row execute function public.set_updated_at();

-- ==========================================================
-- evaluations
-- Scores are relational columns (queried/sorted/aggregated later);
-- open-ended lists use text[] rather than a catch-all JSONB blob.
-- ==========================================================
create table if not exists public.evaluations (
  id uuid primary key default gen_random_uuid(),
  answer_id uuid not null unique references public.interview_answers (id) on delete cascade,
  overall_score numeric(4, 1),
  technical_score numeric(4, 1),
  communication_score numeric(4, 1),
  accuracy_score numeric(4, 1),
  confidence_score numeric(4, 1),
  strengths text[] not null default '{}',
  weaknesses text[] not null default '{}',
  feedback text,
  improvement_suggestions text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists evaluations_answer_id_idx on public.evaluations (answer_id);

-- ==========================================================
-- saved_questions
-- ==========================================================
create table if not exists public.saved_questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  question_id uuid not null references public.interview_questions (id) on delete cascade,
  note text,
  created_at timestamptz not null default now(),
  unique (user_id, question_id)
);

create index if not exists saved_questions_user_id_idx on public.saved_questions (user_id);

-- ==========================================================
-- resumes
-- Storage integration and parsing land in a later phase; this is just
-- the row that a future Storage upload will point at.
-- ==========================================================
create table if not exists public.resumes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  file_name text,
  storage_path text,
  extracted_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists resumes_user_id_idx on public.resumes (user_id);

drop trigger if exists set_resumes_updated_at on public.resumes;
create trigger set_resumes_updated_at
  before update on public.resumes
  for each row execute function public.set_updated_at();

-- ==========================================================
-- Row Level Security
-- Every user-owned table is scoped to auth.uid(). Nothing is ever
-- readable or writable across users, including via a join table.
-- ==========================================================
alter table public.profiles enable row level security;
alter table public.interviews enable row level security;
alter table public.interview_questions enable row level security;
alter table public.interview_answers enable row level security;
alter table public.evaluations enable row level security;
alter table public.saved_questions enable row level security;
alter table public.resumes enable row level security;

-- profiles: a user can only see/change their own profile row.
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = user_id);

create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = user_id);

create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- interviews: fully owned by the creating user.
create policy "interviews_select_own" on public.interviews
  for select using (auth.uid() = user_id);

create policy "interviews_insert_own" on public.interviews
  for insert with check (auth.uid() = user_id);

create policy "interviews_update_own" on public.interviews
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "interviews_delete_own" on public.interviews
  for delete using (auth.uid() = user_id);

-- interview_questions: visible/writable only through an interview the
-- caller owns — there is no direct user_id column on this table, so
-- ownership is always checked by joining back to `interviews`.
create policy "interview_questions_select_via_interview" on public.interview_questions
  for select using (
    exists (
      select 1 from public.interviews i
      where i.id = interview_questions.interview_id
        and i.user_id = auth.uid()
    )
  );

create policy "interview_questions_insert_via_interview" on public.interview_questions
  for insert with check (
    exists (
      select 1 from public.interviews i
      where i.id = interview_questions.interview_id
        and i.user_id = auth.uid()
    )
  );

create policy "interview_questions_update_via_interview" on public.interview_questions
  for update using (
    exists (
      select 1 from public.interviews i
      where i.id = interview_questions.interview_id
        and i.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.interviews i
      where i.id = interview_questions.interview_id
        and i.user_id = auth.uid()
    )
  );

create policy "interview_questions_delete_via_interview" on public.interview_questions
  for delete using (
    exists (
      select 1 from public.interviews i
      where i.id = interview_questions.interview_id
        and i.user_id = auth.uid()
    )
  );

-- interview_answers: the answer's own user_id must match the caller,
-- and the underlying question must belong to one of the caller's
-- interviews — both conditions are enforced, not just the cheaper one.
create policy "interview_answers_select_own" on public.interview_answers
  for select using (auth.uid() = user_id);

create policy "interview_answers_insert_own" on public.interview_answers
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.interview_questions q
      join public.interviews i on i.id = q.interview_id
      where q.id = interview_answers.question_id
        and i.user_id = auth.uid()
    )
  );

create policy "interview_answers_update_own" on public.interview_answers
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- evaluations: no user_id column — ownership is derived from the answer.
create policy "evaluations_select_via_answer" on public.evaluations
  for select using (
    exists (
      select 1 from public.interview_answers a
      where a.id = evaluations.answer_id
        and a.user_id = auth.uid()
    )
  );

create policy "evaluations_insert_via_answer" on public.evaluations
  for insert with check (
    exists (
      select 1 from public.interview_answers a
      where a.id = evaluations.answer_id
        and a.user_id = auth.uid()
    )
  );

-- saved_questions: fully owned by the saving user; the unique constraint
-- above already prevents duplicate saves at the database level.
create policy "saved_questions_select_own" on public.saved_questions
  for select using (auth.uid() = user_id);

create policy "saved_questions_insert_own" on public.saved_questions
  for insert with check (auth.uid() = user_id);

create policy "saved_questions_delete_own" on public.saved_questions
  for delete using (auth.uid() = user_id);

-- resumes: fully owned by the uploading user.
create policy "resumes_select_own" on public.resumes
  for select using (auth.uid() = user_id);

create policy "resumes_insert_own" on public.resumes
  for insert with check (auth.uid() = user_id);

create policy "resumes_update_own" on public.resumes
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "resumes_delete_own" on public.resumes
  for delete using (auth.uid() = user_id);
