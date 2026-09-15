Interview Lab — AI Interview Studio

🔗 Live: https://interview-lab-orpin.vercel.app/

I built this because most "interview prep" tools I tried felt like static flashcards — a generic question, no follow-up, no memory of what I'd actually said. Interview Lab is my attempt at something closer to a real mock interview: you set up a role once, work through a Gemini-generated question set one question at a time, get real scored feedback after every answer, and the AI throws in an adaptive follow-up question if your answer leaves something unresolved — the same way a real interviewer would push back.

What it actually does
Real auth, not a demo login — email/password sign-up and login backed by Supabase Auth. The moment a user signs up, a database trigger creates their profile row automatically. Sessions are cookie-based so the server components, middleware, and server actions are all reading the same signed-in user — no client-side token juggling.
A setup wizard that actually generates a tailored session — role, experience level, interview type, topics, difficulty, question count — all fed into Gemini to build a real question set, persisted straight to Postgres.
A mock interview workspace that feels like one question at a time — write an answer, get AI-scored feedback across overall/technical/communication/accuracy/confidence, plus strengths, weaknesses, and concrete suggestions. If the AI flags something worth digging into, it inserts a follow-up question on its own. Answers save independently of the AI evaluation call, so a failed Gemini request never wipes out what you wrote — you just get a retry.
Resume-grounded sessions — drag-and-drop a PDF, DOCX, or TXT résumé (real upload to Supabase Storage, with genuine uploading → extracting → ready/failed states, not a fake progress bar), and the question set is generated from what's actually on it.
Pick up where you left off — an in-progress interview resumes exactly where you stopped, pulled from Postgres, not local storage.
History that's actually real data — every past interview with real score, question, and follow-up counts from persisted evaluations, not placeholders.
Saved questions — bookmark anything mid-session, come back to a library of them later with topic, difficulty, and source interview attached.
Analytics that don't lie — overall performance, a trend line across completed interviews, topic/difficulty breakdowns, your strongest and weakest answers, deduplicated improvement areas, and an optional on-demand AI coaching summary. Every number here comes from a real persisted evaluation — nothing here is mocked or randomly generated to look good in a demo.
A visual identity I actually put thought into — ink/stone/brass palette, serif display type, hairline borders, deliberately no gradients or glassmorphism, consistent across marketing, auth, and app screens, with real loading/empty/error/retry states everywhere instead of blank screens.
Tech stack
Next.js 14 (App Router, Server Components, Server Actions — I skipped a separate API layer entirely)
Supabase for Postgres, Auth, and Storage — Row Level Security enabled on every single table, no "authenticated users can read everything" shortcuts anywhere
Google Gemini (@google/generative-ai) behind a small provider-agnostic interface, so swapping providers later means writing one new class, not touching every call site
Zod for validation — both form input and AI structured output
Tailwind CSS with a small hand-rolled component set, framer-motion for restrained transitions, self-hosted fonts via @fontsource/* so there's zero runtime dependency on Google's font CDN
pdfjs-dist and mammoth for résumé parsing — both pure JS, no native binaries, safe on Vercel's serverless runtime
Database schema

Source of truth is supabase/migrations/ — four migrations, applied in filename order:

profiles             user_id → auth.users, target_role, experience_level, onboarding_completed
interviews           target_role, experience_level, interview_type, difficulty, topics[], status
interview_questions  question_text, topic, difficulty, is_follow_up, parent_question_id, model_answer
interview_answers    question_id, user_id, answer_text
evaluations          scores across 5 dimensions, strengths[], weaknesses[], suggestions[]
saved_questions      user_id, question_id, note
resumes              file_name, storage_path, upload_status, content_hash

A trigger (on_auth_user_created) creates the profiles row automatically the moment a new auth.users row exists. RLS on every table checks ownership against auth.uid(), either directly or via a join back to interviews/interview_answers where a table doesn't have its own user_id column. The private resumes Storage bucket has matching path-scoped policies so nobody can read another user's uploaded file.

Environment variables

See .env.example for the full list. Quick reference:

Variable	Required	Notes
NEXT_PUBLIC_SUPABASE_URL	Yes	Your Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY	Yes	Public anon key — safe to expose, RLS does the actual access control
SUPABASE_SERVICE_ROLE_KEY	No	Reserved for a future admin operation, not read by any code yet
AI_PROVIDER	No	Defaults to gemini
GEMINI_API_KEY	Yes (for AI features)	Server-only, never touches the browser
GEMINI_MODEL	No	Leave blank to use the current default model

Without a Gemini key, everything that doesn't need AI still works fine — auth, dashboard, history, saved questions. Interview setup will save the interview record but tell you honestly that question generation isn't available, instead of faking a question set.

Running it locally
bash
npm install
cp .env.example .env.local     # fill in your own values

# Apply the schema to your Supabase project, in order:
# run each file in supabase/migrations/ via the SQL Editor,
# or: supabase db push

npm run dev                    # http://localhost:3000
Deploying
Create a Supabase project and run all four migrations in supabase/migrations/, in order.
Push this repo to GitHub.
Import it into Vercel, add the environment variables above (Production and Preview if you use preview deployments), and deploy.
That's it — fonts are self-hosted so there's no external network dependency at build time.
Known limitations (being upfront about these)
No automated test suite yet — verification today is npm run lint, npm run typecheck, npm run build, plus manual testing of every flow end to end.
npm audit currently flags advisories against Next.js 14.2.x with fixes only shipped in the 15.x line. A major-version upgrade is a deliberate separate task, not something I've folded into this pass.
SUPABASE_SERVICE_ROLE_KEY is declared in .env.example but not read anywhere yet — reserved for a future feature, not required to run the app today.
Commands
bash
npm install
npm run dev
npm run lint
npm run typecheck
npm run build