-- InterviewLab — AI interview engine upgrade
-- Adds the two columns the upgraded question-generation prompt actually
-- needs beyond what already exists (model_answer, explanation were
-- already present from Phase 4) and constrains question_type/difficulty
-- to the taxonomy the AI is now instructed to use. Everything else the
-- upgraded evaluation flow needs (technical_score, communication_score,
-- accuracy_score, confidence_score, strengths, weaknesses, feedback,
-- improvement_suggestions on `evaluations`) already exists from the
-- Phase 3 schema — this migration does not touch that table.

-- ==========================================================
-- interview_questions: structured generation metadata
-- ==========================================================
alter table public.interview_questions
  add column if not exists what_it_tests text,
  add column if not exists key_points text[] not null default '{}';

-- Existing rows (generated under the old, unstructured prompt) have no
-- question_type/difficulty guarantees — the check constraints below are
-- intentionally permissive of NULL so historical rows are never
-- invalidated by this migration, while every newly-generated question
-- going forward is validated server-side (see lib/ai/types.ts) against
-- this exact taxonomy before insert.
alter table public.interview_questions
  drop constraint if exists interview_questions_question_type_check;
alter table public.interview_questions
  add constraint interview_questions_question_type_check
    check (
      question_type is null
      or question_type in (
        'technical', 'behavioral', 'system_design',
        'situational', 'conceptual', 'project_experience'
      )
    );

alter table public.interview_questions
  drop constraint if exists interview_questions_difficulty_check;
alter table public.interview_questions
  add constraint interview_questions_difficulty_check
    check (difficulty is null or difficulty in ('easy', 'medium', 'hard'));
