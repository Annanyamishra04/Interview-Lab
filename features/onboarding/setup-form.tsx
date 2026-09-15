"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { Tag } from "@/components/ui/tag";
import type { InterviewSetupInput } from "@/lib/validation/interview";
import { createInterviewAction, type SetupActionResult } from "@/app/onboarding/actions";

const ROLE_OPTIONS = [
  "Software Engineer",
  "Frontend Engineer",
  "Backend Engineer",
  "Data Analyst",
  "Product Manager",
  "Other",
] as const;

const EXPERIENCE_OPTIONS = [
  { value: "fresher", label: "Fresher" },
  { value: "1-3", label: "1–3 years" },
  { value: "3-5", label: "3–5 years" },
  { value: "5+", label: "5+ years" },
] as const;

const TYPE_OPTIONS = [
  { value: "technical", label: "Technical" },
  { value: "behavioral", label: "Behavioral" },
  { value: "situational", label: "Situational" },
  { value: "mixed", label: "Mixed" },
] as const;

const FOCUS_OPTIONS = [
  "DSA",
  "SQL",
  "React",
  "JavaScript",
  "Node.js",
  "System Design",
  "APIs",
  "Databases",
  "Other",
] as const;

const DIFFICULTY_OPTIONS = [
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
  { value: "mixed", label: "Mixed" },
] as const;

const QUESTION_COUNT_OPTIONS = [5, 10, 15, 20] as const;

type WizardState = InterviewSetupInput;

const STEP_META = [
  { key: "role", title: "What role are you interviewing for?" },
  { key: "experienceLevel", title: "How much experience do you have?" },
  { key: "interviewType", title: "What kind of interview is it?" },
  { key: "topics", title: "What should we focus on?" },
  { key: "difficulty", title: "How hard should it be?" },
  { key: "questionCount", title: "How many questions?" },
] as const;

const TOTAL_STEPS = STEP_META.length;

/**
 * One question per screen, not one long form. Each step commits to
 * `state` and advances immediately on selection — the setup should feel
 * like configuring a session, not filling out paperwork.
 */
export function SetupWizard() {
  const router = useRouter();
  const reduceMotion = useReducedMotion();

  const [step, setStep] = React.useState(0);
  const [state, setState] = React.useState<WizardState>({
    role: "",
    experienceLevel: "3-5",
    interviewType: "technical",
    topics: [],
    difficulty: "medium",
    questionCount: 10,
  });
  const [customRole, setCustomRole] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [result, setResult] = React.useState<SetupActionResult | null>(null);

  const goNext = () => setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  const goBack = () => setStep((s) => Math.max(s - 1, 0));

  const update = <K extends keyof WizardState>(key: K, value: WizardState[K]) => {
    setState((prev) => ({ ...prev, [key]: value }));
  };

  const buildInterview = async () => {
    const finalRole = state.role === "Other" ? customRole.trim() : state.role;
    const payload: WizardState = { ...state, role: finalRole };
    setIsSubmitting(true);
    setResult(null);
    const outcome = await createInterviewAction(payload);
    setResult(outcome);
    setIsSubmitting(false);
    if (outcome.ok) {
      setState(payload);
      goNext();
    }
  };

  const beginSession = () => {
    if (!result?.ok || !result.interviewId || !result.questions) return;
    router.push(`/interview/session?interviewId=${result.interviewId}`);
  };

  const isReview = step === TOTAL_STEPS;
  const roleReady = state.role === "Other" ? customRole.trim().length > 1 : state.role.length > 1;

  const fade = reduceMotion
    ? { initial: { opacity: 1 }, animate: { opacity: 1 }, exit: { opacity: 1 } }
    : { initial: { opacity: 0, x: 12 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -12 } };

  return (
    <div className="mx-auto max-w-xl">
      {/* Progress */}
      <div className="flex items-center gap-1.5">
        {STEP_META.map((s, i) => (
          <div
            key={s.key}
            className={`h-[3px] flex-1 rounded-full transition-colors ${
              i <= step || isReview ? "bg-brass" : "bg-line"
            }`}
          />
        ))}
      </div>
      <p className="mt-3 font-mono text-data text-ink-muted">
        {isReview ? "Ready" : `Step ${step + 1} of ${TOTAL_STEPS}`}
      </p>

      <AnimatePresence mode="wait">
        {!isReview ? (
          <motion.div
            key={step}
            {...fade}
            transition={{ duration: reduceMotion ? 0 : 0.2, ease: "easeOut" }}
            className="mt-4"
          >
            <h1 className="font-display text-display-md text-ink">{STEP_META[step]?.title}</h1>

            {step === 0 && (
              <div className="mt-8">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {ROLE_OPTIONS.map((role) => (
                    <ChoiceCard
                      key={role}
                      label={role}
                      selected={state.role === role}
                      onClick={() => update("role", role)}
                    />
                  ))}
                </div>
                {state.role === "Other" && (
                  <Input
                    autoFocus
                    className="mt-4"
                    placeholder="Type the role you're preparing for"
                    value={customRole}
                    onChange={(e) => setCustomRole(e.target.value)}
                  />
                )}
              </div>
            )}

            {step === 1 && (
              <div className="mt-8 grid grid-cols-2 gap-3">
                {EXPERIENCE_OPTIONS.map((opt) => (
                  <ChoiceCard
                    key={opt.value}
                    label={opt.label}
                    selected={state.experienceLevel === opt.value}
                    onClick={() => update("experienceLevel", opt.value)}
                  />
                ))}
              </div>
            )}

            {step === 2 && (
              <div className="mt-8 grid grid-cols-2 gap-3">
                {TYPE_OPTIONS.map((opt) => (
                  <ChoiceCard
                    key={opt.value}
                    label={opt.label}
                    selected={state.interviewType === opt.value}
                    onClick={() => update("interviewType", opt.value)}
                  />
                ))}
              </div>
            )}

            {step === 3 && (
              <div className="mt-8">
                <div className="flex flex-wrap gap-2.5">
                  {FOCUS_OPTIONS.map((topic) => {
                    const checked = state.topics.includes(topic);
                    return (
                      <button
                        type="button"
                        key={topic}
                        aria-pressed={checked}
                        onClick={() =>
                          update(
                            "topics",
                            checked
                              ? state.topics.filter((t) => t !== topic)
                              : [...state.topics, topic]
                          )
                        }
                        className={`rounded-sm border px-3.5 py-2 text-body-sm transition-colors ${
                          checked
                            ? "border-brass bg-brass-tint text-brass-dim"
                            : "border-line-strong text-ink-soft hover:bg-stone-deep"
                        }`}
                      >
                        {topic}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-3 text-meta text-ink-muted">Choose at least one.</p>
              </div>
            )}

            {step === 4 && (
              <div className="mt-8 grid grid-cols-2 gap-3">
                {DIFFICULTY_OPTIONS.map((opt) => (
                  <ChoiceCard
                    key={opt.value}
                    label={opt.label}
                    selected={state.difficulty === opt.value}
                    onClick={() => update("difficulty", opt.value)}
                  />
                ))}
              </div>
            )}

            {step === 5 && (
              <div className="mt-8 grid grid-cols-4 gap-3">
                {QUESTION_COUNT_OPTIONS.map((n) => (
                  <ChoiceCard
                    key={n}
                    label={String(n)}
                    selected={state.questionCount === n}
                    onClick={() => update("questionCount", n)}
                  />
                ))}
              </div>
            )}

            <div className="mt-10 flex items-center justify-between">
              <button
                type="button"
                onClick={goBack}
                disabled={step === 0}
                className="text-body-sm text-ink-muted underline underline-offset-4 hover:text-ink disabled:pointer-events-none disabled:opacity-0"
              >
                Back
              </button>

              {step < TOTAL_STEPS - 1 ? (
                <Button
                  variant="accent"
                  onClick={goNext}
                  disabled={
                    (step === 0 && !roleReady) || (step === 3 && state.topics.length === 0)
                  }
                >
                  Continue
                </Button>
              ) : (
                <Button variant="accent" onClick={buildInterview} disabled={isSubmitting}>
                  {isSubmitting ? "Building your interview…" : "Build my interview"}
                </Button>
              )}
            </div>
            {result?.error && (
              <p className="mt-4 text-body-sm text-signal-error">{result.error}</p>
            )}
          </motion.div>
        ) : (
          <motion.div key="review" {...fade} transition={{ duration: reduceMotion ? 0 : 0.2 }} className="mt-6">
            <Surface inset="lg">
              <p className="text-meta text-ink-muted">Session preview</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Tag tone="brass">{state.role}</Tag>
                <Tag tone="neutral">
                  {EXPERIENCE_OPTIONS.find((o) => o.value === state.experienceLevel)?.label}
                </Tag>
                <Tag tone="neutral">
                  {TYPE_OPTIONS.find((o) => o.value === state.interviewType)?.label}
                </Tag>
                <Tag tone="neutral">
                  {DIFFICULTY_OPTIONS.find((o) => o.value === state.difficulty)?.label}
                </Tag>
                <Tag tone="neutral">{state.questionCount} questions</Tag>
              </div>

              {result?.ok && result.questions && (
                <ol className="mt-6 space-y-4">
                  {result.questions.slice(0, 3).map((q) => (
                    <li key={q.id} className="border-t border-line pt-3 first:border-t-0 first:pt-0">
                      <Tag tone="teal">{q.topic}</Tag>
                      <p className="mt-1.5 text-body-sm text-ink">{q.question_text}</p>
                    </li>
                  ))}
                  {result.questions.length > 3 && (
                    <li className="text-meta text-ink-muted">
                      + {result.questions.length - 3} more once the session starts
                    </li>
                  )}
                </ol>
              )}

              {result?.ok && result.aiUnavailable && (
                <p className="mt-6 border-t border-line pt-4 text-body-sm text-ink-muted">
                  Your interview setup is saved. Question generation isn&rsquo;t connected in
                  this build yet, so there&rsquo;s nothing to preview here — check your
                  dashboard once it&rsquo;s live.
                </p>
              )}

              <div className="mt-7 flex items-center gap-4">
                {result?.questions ? (
                  <Button type="button" variant="accent" onClick={beginSession}>
                    Begin session
                  </Button>
                ) : (
                  <Button type="button" variant="accent" onClick={() => router.push("/dashboard")}>
                    Go to dashboard
                  </Button>
                )}
                <button
                  type="button"
                  onClick={() => setStep(TOTAL_STEPS - 1)}
                  className="text-body-sm text-ink-muted underline underline-offset-4 hover:text-ink"
                >
                  Edit setup
                </button>
              </div>
            </Surface>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ChoiceCard({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`rounded-md border px-4 py-3.5 text-left text-body-sm font-medium transition-colors ${
        selected
          ? "border-brass bg-brass-tint text-brass-dim"
          : "border-line-strong text-ink-soft hover:bg-stone-deep"
      }`}
    >
      {label}
    </button>
  );
}
