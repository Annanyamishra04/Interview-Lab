-- InterviewLab — Phase 4 schema
-- Extends the Phase 3 tables to support real persistence of generated
-- questions, follow-up questions, answers, evaluations, and interview
-- completion — replacing the sessionStorage handoff used until now.

-- ==========================================================
-- interview_questions: follow-up support
-- ==========================================================
-- Follow-ups are inserted "between" an existing question and the next
-- one, so question_order needs to support fractional values instead of
-- only whole integers. The existing unique(interview_id, question_order)
-- constraint is preserved — it's still what stops a retried generation
-- call from writing duplicate rows.
alter table public.interview_questions
  alter column question_order type numeric(10, 4) using question_order::numeric(10, 4);

alter table public.interview_questions
  add column if not exists is_follow_up boolean not null default false;

alter table public.interview_questions
  add column if not exists parent_question_id uuid
    references public.interview_questions (id) on delete cascade;

create index if not exists interview_questions_parent_question_id_idx
  on public.interview_questions (parent_question_id);

-- ==========================================================
-- interviews: completion tracking
-- ==========================================================
alter table public.interviews
  add column if not exists completed_at timestamptz;

-- ==========================================================
-- interview_answers: idempotent submission
-- ==========================================================
-- Already unique(question_id, user_id) from the Phase 3 migration, which
-- is what services/answers.ts upserts against. Nothing to add here — this
-- comment documents why no new constraint is needed.

-- ==========================================================
-- evaluations: idempotent evaluation
-- ==========================================================
-- Already unique on answer_id via the column-level `unique` in Phase 3.
-- services/evaluations.ts upserts on that constraint so a retried
-- evaluation call replaces the previous result instead of duplicating it.
