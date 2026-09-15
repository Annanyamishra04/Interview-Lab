-- InterviewLab — Resume upload phase
-- Extends the `resumes` table with real upload/extraction metadata,
-- links interviews back to the resume they were generated from, and
-- provisions a private Storage bucket + policies for resume files.

-- ==========================================================
-- resumes: upload/extraction metadata
-- ==========================================================
alter table public.resumes
  add column if not exists file_type text,
  add column if not exists file_size integer,
  add column if not exists content_hash text,
  add column if not exists upload_status text not null default 'pending',
  add column if not exists error_message text;

alter table public.resumes
  drop constraint if exists resumes_upload_status_check;
alter table public.resumes
  add constraint resumes_upload_status_check
    check (upload_status in ('pending', 'uploaded', 'extracting', 'ready', 'failed'));

-- One row per distinct file per user. A retried upload of the exact same
-- bytes (same sha256) upserts this row instead of inserting a duplicate;
-- this is the "don't create duplicate resume records on retry" guard.
-- NULLs (rows created before a hash was computed) are exempt, since
-- Postgres treats each NULL as distinct — fine, since every new insert
-- always supplies a hash going forward.
create unique index if not exists resumes_user_content_hash_key
  on public.resumes (user_id, content_hash);

-- ==========================================================
-- interviews: provenance
-- ==========================================================
alter table public.interviews
  add column if not exists resume_id uuid references public.resumes (id) on delete set null;

create index if not exists interviews_resume_id_idx on public.interviews (resume_id);

-- ==========================================================
-- Storage: private "resumes" bucket
-- ==========================================================
insert into storage.buckets (id, name, public)
values ('resumes', 'resumes', false)
on conflict (id) do nothing;

-- Paths are always "users/{auth.uid()}/resumes/{file}" — written by the
-- server action using the caller's own session, never a client-supplied
-- user id. storage.foldername(name) splits the path into folder
-- segments, so index 2 is the user id segment for every object in this
-- bucket.
drop policy if exists "resumes_storage_select_own" on storage.objects;
create policy "resumes_storage_select_own" on storage.objects
  for select
  using (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = 'users'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

drop policy if exists "resumes_storage_insert_own" on storage.objects;
create policy "resumes_storage_insert_own" on storage.objects
  for insert
  with check (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = 'users'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

drop policy if exists "resumes_storage_update_own" on storage.objects;
create policy "resumes_storage_update_own" on storage.objects
  for update
  using (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = 'users'
    and (storage.foldername(name))[2] = auth.uid()::text
  )
  with check (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = 'users'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

drop policy if exists "resumes_storage_delete_own" on storage.objects;
create policy "resumes_storage_delete_own" on storage.objects
  for delete
  using (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = 'users'
    and (storage.foldername(name))[2] = auth.uid()::text
  );
