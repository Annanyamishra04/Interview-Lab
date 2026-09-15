# InterviewLab — AI Interview Studio

Personalized AI interview practice: set up a role once, work through a
real Gemini-generated question set one question at a time, get scored
feedback (with adaptive follow-ups) after each answer, and track how
your performance changes across sessions.

## What it does

- **Auth** — email/password sign-up, login, and logout against real
  Supabase Auth. A profile row is created automatically via a database
  trigger the moment an auth user exists. Sessions are cookie-based so
  server components, middleware, and server actions all see the same
  signed-in user.
- **Interview setup** — a step-by-step wizard (role, experience level,
  interview type, topics, difficulty, question count) that generates a
  real question set via Gemini and persists everything to Postgres.
- **Mock interview workspace** — question-by-question flow: write an
  answer, get AI-scored feedback (overall/technical/communication/
  accuracy/confidence, strengths, weaknesses, suggestions), and get an
  adaptive follow-up question inserted automatically when the AI flags
  something worth probing further. Answers are saved independently of
  evaluation, so a failed AI call never loses what you wrote — just
  offers a retry.
- **Resume-based sessions** — upload a PDF, DOCX, or TXT résumé (real
  drag-and-drop upload to Supabase Storage, with genuine
  uploading/extracting/ready/failed states — no simulated progress),
  and get a question set grounded in what's actually on it.
- **Continue interview** — an in-progress session picks up exactly where
  you left off, from Postgres, not client-side storage.
- **History** — every past interview, with real score/question/follow-up
  counts pulled from persisted evaluations.
- **Saved questions** — bookmark any question during a session; see the
  library later with its topic, difficulty, and source interview.
- **Analytics** — overall performance, a trend across completed
  interviews, topic and difficulty breakdowns, strongest/weakest
  answers, deduplicated improvement areas, and an optional on-demand AI
  coaching summary — every number computed from real persisted
  evaluations, never mocked or randomly generated.
- **Editorial frontend** — a deliberately non-generic visual identity
  (ink/stone/brass palette, serif display type, hairline borders, no
  gradients/glassmorphism), consistent across marketing, auth, and app
  screens, with real loading/empty/error/retry states throughout.

## Tech stack

- **Framework**: Next.js 14 (App Router, Server Components, Server
  Actions — no separate API layer)
- **Database/Auth/Storage**: Supabase (Postgres + Row Level Security,
  Supabase Auth, private Storage bucket for résumés)
- **AI**: Google Gemini (`@google/generative-ai`), behind a small
  provider-agnostic interface (`lib/ai/types.ts`) so swapping providers
  means writing one new class, not touching call sites
- **Validation**: Zod, for both form input and AI structured output
- **UI**: Tailwind CSS + a small hand-rolled component set
  (`components/ui/`), `framer-motion` for restrained transitions,
  self-hosted fonts via `@fontsource/*` (no runtime dependency on
  Google's font CDN)
- **Resume parsing**: `pdfjs-dist` (PDF) and `mammoth` (DOCX) — both
  pure JS, no native binaries, safe on Vercel's serverless runtime

## File structure

```
app/
  page.tsx                       Landing page
  auth/login, auth/sign-up       Auth routes (server actions in features/auth/actions.ts)
  onboarding/                    Interview setup wizard route + server action
  interview/session/             Mock interview workspace route + server actions
  interview/[id]/                Ownership-checked redirect into the workspace (view/resume/results)
  resume/                        Resume upload + resume-grounded generation route + actions
  dashboard/                     Continue / start new / performance snapshot / recent / saved
  history/                       Full interview list with real per-interview metrics
  analytics/                     Performance intelligence page
  saved/                         Saved-question library
components/
  ui/                            Button, Input, Textarea, Surface, Tag
  marketing/                     Landing page sections
  layout/                        Authenticated app shell + nav (incl. logout)
features/
  auth/                          Login/sign-up forms + server actions
  onboarding/                    Setup wizard UI
  interview/                     Workspace UI (question, evaluation, results, timer)
  resume/                        Upload UI + form
  saved/                         Remove-saved-question control
  analytics/                     Filters, trend chart, AI coach UI + server action
lib/
  ai/                            Provider-agnostic AI interface + Gemini implementation + dedupe
  resume/                        File-type/size constants + PDF/DOCX/TXT text extraction
  supabase/
    client.ts                    Browser client (anon key only; currently unused — see Known limitations)
    server.ts                    Server client, bound to request cookies
    middleware.ts                Session refresh + route-protection logic
    errors.ts                    Auth-error → user-facing message mapping, open-redirect guard
  validation/                    Zod schemas (auth, interview setup/answers)
  utils.ts
services/
  profiles.ts                    Profile reads/updates
  interviews.ts                  Interview record CRUD (DB persistence only)
  interview-service.ts           Question generation / answer evaluation orchestration (calls Gemini)
  questions.ts, answers.ts,      Typed, RLS-backed data access for each table
  evaluations.ts, resumes.ts,
  saved-questions.ts
  analytics.ts                   Aggregation service — the only place analytics numbers are computed
types/
  database.ts                    Hand-authored Supabase DB types (see header comment to regenerate)
supabase/
  migrations/                    SQL schema + RLS + Storage policies, applied via the Supabase CLI
middleware.ts                    Root Next.js middleware wiring lib/supabase/middleware.ts in
```

## Database schema

Authoritative source is `supabase/migrations/` (four migrations, applied
in filename order). Summary of the resulting schema:

```
profiles            (user_id → auth.users, full_name, target_role, experience_level, onboarding_completed, ...)
interviews           (user_id, target_role, experience_level, interview_type, difficulty, topics[],
                      question_count, status, resume_id → resumes, completed_at, ...)
interview_questions  (interview_id, question_text, question_type, topic, difficulty, question_order,
                      is_follow_up, parent_question_id, model_answer, explanation, what_it_tests, key_points[])
interview_answers    (question_id, user_id, answer_text, ...) — unique(question_id, user_id)
evaluations          (answer_id, overall/technical/communication/accuracy/confidence_score,
                      strengths[], weaknesses[], feedback, improvement_suggestions[]) — unique(answer_id)
saved_questions       (user_id, question_id, note) — unique(user_id, question_id)
resumes               (user_id, file_name, storage_path, file_type, file_size, content_hash,
                      upload_status, error_message) — unique(user_id, content_hash)
```

A trigger (`on_auth_user_created`) creates the `profiles` row
automatically when a new `auth.users` row is created.

### Row Level Security

RLS is enabled on every table. Ownership is always checked against
`auth.uid()` — directly where a `user_id` column exists, or via a join
back to `interviews`/`interview_answers` for the tables that don't
(`interview_questions`, `evaluations`). There is no "authenticated users
can read everything" policy anywhere. The private `resumes` Storage
bucket has matching path-scoped policies (`users/{auth.uid()}/resumes/...`)
so a user can only read/write objects under their own folder. Full
policy definitions are in the migration files — see
`supabase/migrations/20250101000000_init_schema.sql` for the base
schema and `20250103000000_resume_upload.sql` for the Storage policies.

`types/database.ts` is hand-written to match the migrations exactly.
Once a real Supabase project exists, you can instead regenerate it with:

```bash
npx supabase gen types typescript --project-id <project-id> > types/database.ts
```

## Environment variables

See `.env.example`. All Supabase/AI configuration is read server-side
except the two `NEXT_PUBLIC_*` values, which are Supabase's public
anon key and project URL — safe to expose by design (RLS is what
actually protects data, not keeping this key secret).

| Variable | Required | Server-only | Purpose |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | No | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | No | Supabase public anon key (safe for the browser; RLS enforces access) |
| `SUPABASE_SERVICE_ROLE_KEY` | No | Yes | Reserved — not read by any code today. Do not set this in any client-reachable context if you do add a use for it later. |
| `AI_PROVIDER` | No | Yes | Defaults to `gemini` if unset |
| `GEMINI_API_KEY` | Yes (for AI features) | Yes | Question generation, answer evaluation, resume analysis, AI coach summary. Never referenced outside `lib/ai/`, which is `import "server-only"` guarded. |
| `GEMINI_MODEL` | No | Yes | Overrides the default model — see the comment above `DEFAULT_MODEL` in `lib/ai/providers/gemini.ts` for why this needs occasional review (Gemini model lifecycles are short) |

Without `GEMINI_API_KEY` set, everything that doesn't touch Gemini still
works (auth, dashboard, history, saved questions); interview setup will
save the interview record but report that question generation isn't
available, rather than faking a question set.

## Local setup

```bash
npm install
cp .env.example .env.local     # fill in the values above

# Apply the schema to a Supabase project, in order (all four required):
supabase db push
# — or, in the Supabase dashboard SQL editor, run each file in
# supabase/migrations/ in filename order —

npm run dev                    # http://localhost:3000
```

## Production deployment (Vercel + Supabase + Gemini)

1. Create a Supabase project, run all four migrations in
   `supabase/migrations/` in order (this also creates the private
   `resumes` Storage bucket and its policies).
2. Set the environment variables above in the Vercel project settings
   (Production **and** Preview, if you use preview deployments).
3. Deploy. No build-time secrets are required beyond the env vars —
   fonts are self-hosted (`@fontsource/*`), so there's no dependency on
   an external font CDN at build time, and nothing else in the build
   step reaches the network.
4. `next.config.mjs` already sets `serverActions.bodySizeLimit: "5mb"`
   to match the resume upload cap, and marks `pdfjs-dist`/`mammoth` as
   external server packages so Vercel's serverless functions run them
   as real Node modules instead of bundling them.

## Known limitations

- **Next.js dependency advisories**: `npm audit` currently reports
  advisories against Next.js 14.2.x (this project's major version) with
  fixes only available starting at 15.5.x — Next has not backported
  fixes into the 14.x line. Upgrading is a deliberate, separate task
  (a major-version bump, not a patch bump) and hasn't been done as part
  of this phase. See the audit output for the current list before
  deploying anything handling sensitive data.
- **`SUPABASE_SERVICE_ROLE_KEY`** is declared in `.env.example` but not
  read anywhere in code — reserved for a future admin/Storage operation,
  not required to run the app today.
- **`lib/supabase/client.ts`** (the browser Supabase client) is defined
  but not currently imported anywhere — every read/write in the app
  goes through a server action or server component instead. Harmless,
  but worth knowing before assuming it's wired into something.
- **No automated tests.** Verification today is `npm run lint`,
  `npm run typecheck`, `npm run build`, plus manual/code-inspection
  review of the main flows.
- **ESLint 8** (via `eslint-config-next@14.2.35`) is past its own
  upstream support window; this tracks Next 14's supported tooling and
  would move together with a future Next upgrade.

## Commands

```bash
npm install
npm run dev
npm run lint
npm run typecheck
npm run build
```
