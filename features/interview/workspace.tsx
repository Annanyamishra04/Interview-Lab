"use client";

import * as React from "react";
import Link from "next/link";
import type { Route } from "next";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Surface } from "@/components/ui/surface";
import { Textarea } from "@/components/ui/textarea";
import { Button, buttonVariants } from "@/components/ui/button";
import { Tag } from "@/components/ui/tag";
import { SaveQuestionButton } from "@/features/interview/save-question-button";
import { InterviewIntro } from "@/features/interview/intro-screen";
import { QuestionTimer } from "@/features/interview/timer";
import { cn } from "@/lib/utils";
import {
  getInterviewStateAction,
  submitAnswerAction,
  completeInterviewAction,
} from "@/app/interview/session/actions";
import type { InterviewState } from "@/services/interview-service";
import type { AnswerRecord } from "@/services/answers";
import type { EvaluationRecord } from "@/services/evaluations";
import type { QuestionRecord } from "@/services/questions";
import type { ExperienceLevel } from "@/lib/validation/interview";

type LoadStatus = "loading" | "ready" | "not-found" | "error";

const DIFFICULTY_LABEL: Record<string, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};

/**
 * Finds the question the user should see next: the first one (in
 * persisted order) that doesn't yet have an evaluation. A question can
 * have an answer but no evaluation after a failed AI call — that case is
 * treated as "current" too, with the saved answer text pre-filled, so a
 * refresh mid-failure resumes as a retry rather than losing the draft.
 */
function findCurrentQuestion(
  questions: QuestionRecord[],
  answers: AnswerRecord[],
  evaluations: EvaluationRecord[]
): { question: QuestionRecord; answer: AnswerRecord | null } | null {
  for (const question of questions) {
    const answer = answers.find((a) => a.question_id === question.id) ?? null;
    const evaluation = answer ? evaluations.find((e) => e.answer_id === answer.id) : undefined;
    if (!evaluation) {
      return { question, answer };
    }
  }
  return null;
}

export function InterviewWorkspace({ interviewId }: { interviewId: string | null }) {
  const reduceMotion = useReducedMotion();
  const [status, setStatus] = React.useState<LoadStatus>("loading");
  const [state, setState] = React.useState<InterviewState | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [answerText, setAnswerText] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [showLatestEvaluation, setShowLatestEvaluation] = React.useState(false);
  const [isCompleting, setIsCompleting] = React.useState(false);
  // Local-only: whether the interviewer intro has been dismissed this
  // mount. Not persisted — see features/interview/intro-screen.tsx.
  const [introDismissed, setIntroDismissed] = React.useState(false);

  const load = React.useCallback(async (id: string) => {
    setStatus("loading");
    const outcome = await getInterviewStateAction(id);
    if (!outcome.ok || !outcome.state) {
      setLoadError(outcome.error ?? "Couldn't load this interview.");
      setStatus("not-found");
      return;
    }
    setState(outcome.state);
    const current = findCurrentQuestion(
      outcome.state.questions,
      outcome.state.answers,
      outcome.state.evaluations
    );
    setAnswerText(current?.answer?.answer_text ?? "");
    setShowLatestEvaluation(false);
    setStatus("ready");
  }, []);

  React.useEffect(() => {
    if (!interviewId) {
      setStatus("not-found");
      return;
    }
    load(interviewId);
    // Recovery: re-check when the tab regains focus in case a previous
    // session on another tab (or a flaky network) advanced things in the
    // background — Postgres stays the single source of truth either way.
    // Only the underlying `state` is refreshed here; it never touches the
    // in-progress evaluation view or the answer draft, both of which are
    // managed explicitly by `submit`/`goToNext` below.
    const onFocus = async () => {
      const outcome = await getInterviewStateAction(interviewId);
      if (outcome.ok && outcome.state) setState(outcome.state);
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [interviewId, load]);

  if (status === "loading") {
    return (
      <Surface inset="lg" className="max-w-prose text-body-sm text-ink-soft">
        Setting up the room…
      </Surface>
    );
  }

  if (status === "not-found" || !interviewId || !state) {
    return (
      <EmptyState
        title="No session found"
        body={loadError ?? "Set up a new session to start practicing."}
        actionHref="/onboarding"
        actionLabel="Set up a session"
      />
    );
  }

  if (state.interview.status === "completed") {
    return <ResultsSummary state={state} />;
  }

  const answeredCount = state.evaluations.length;

  // Show the interviewer intro before the very first question of a
  // session that hasn't started yet (no answers persisted at all) — not
  // on every resume, and not mid-session after a follow-up.
  const isBrandNewSession = state.answers.length === 0 && state.interview.status === "draft";
  if (isBrandNewSession && !introDismissed) {
    return (
      <InterviewIntro
        interview={state.interview}
        questionCount={state.interview.question_count}
        onBegin={() => setIntroDismissed(true)}
      />
    );
  }

  const current = findCurrentQuestion(state.questions, state.answers, state.evaluations);

  if (!current) {
    return (
      <FinishScreen
        interviewId={interviewId}
        state={state}
        isCompleting={isCompleting}
        setIsCompleting={setIsCompleting}
        onCompleted={(next) => setState(next)}
      />
    );
  }

  const { question, answer } = current;
  const isRetry = Boolean(answer) && !isSubmitting;
  const role = state.interview.target_role;
  const experienceLevel = state.interview.experience_level as ExperienceLevel;

  // The most recently evaluated question, shown briefly after submitting
  // before advancing to the next one.
  const lastEvaluated = showLatestEvaluation
    ? [...state.questions]
        .reverse()
        .map((q) => {
          const a = state.answers.find((ans) => ans.question_id === q.id);
          const e = a ? state.evaluations.find((ev) => ev.answer_id === a.id) : undefined;
          return a && e ? { question: q, answer: a, evaluation: e } : null;
        })
        .find(Boolean)
    : null;

  const submit = async () => {
    if (!answerText.trim() || isSubmitting) return;
    setIsSubmitting(true);
    setSubmitError(null);

    const outcome = await submitAnswerAction({
      interviewId,
      questionId: question.id,
      answerText,
      question: question.question_text,
      role,
      experienceLevel,
      questionType: question.question_type,
      modelAnswer: question.model_answer,
      keyPoints: question.key_points,
    });

    setIsSubmitting(false);

    if (outcome.state) setState(outcome.state);

    if (!outcome.ok) {
      setSubmitError(outcome.error ?? "Something went wrong.");
      return;
    }

    setShowLatestEvaluation(true);
  };

  const onAnswerKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      submit();
    }
  };

  const goToNext = () => {
    setShowLatestEvaluation(false);
    const next = findCurrentQuestion(state.questions, state.answers, state.evaluations);
    setAnswerText(next?.answer?.answer_text ?? "");
  };

  const totalPlanned = state.interview.question_count;
  const progressDenominator = Math.max(totalPlanned, state.questions.length);
  const progressPct = Math.min(
    100,
    Math.round((answeredCount / Math.max(progressDenominator, 1)) * 100)
  );

  return (
    <div>
      <InterviewHeader
        role={role}
        answeredCount={answeredCount}
        totalQuestions={state.questions.length}
        totalPlanned={totalPlanned}
        progressPct={progressPct}
        timerKey={question.id}
        timerPaused={isSubmitting || Boolean(lastEvaluated)}
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div>
          <AnimatePresence mode="wait" initial={false}>
            {lastEvaluated ? (
              <motion.div
                key={`eval-${lastEvaluated.question.id}`}
                initial={reduceMotion ? undefined : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
              >
                <EvaluatedTurn
                  question={lastEvaluated.question}
                  answer={lastEvaluated.answer}
                  evaluation={lastEvaluated.evaluation}
                  onNext={goToNext}
                  isLast={!findCurrentQuestion(state.questions, state.answers, state.evaluations)}
                  isSaved={state.savedQuestionIds.includes(lastEvaluated.question.id)}
                />
              </motion.div>
            ) : (
              <motion.div
                key={`question-${question.id}`}
                initial={reduceMotion ? undefined : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
              >
                <QuestionPanel
                  question={question}
                  isSaved={state.savedQuestionIds.includes(question.id)}
                  answerText={answerText}
                  setAnswerText={setAnswerText}
                  onKeyDown={onAnswerKeyDown}
                  isSubmitting={isSubmitting}
                  isRetry={isRetry}
                  submitError={submitError}
                  onSubmit={submit}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <InterviewerRail
          role={role}
          experienceLevel={experienceLevel}
          interviewType={state.interview.interview_type}
          difficulty={question.difficulty}
        />
      </div>
    </div>
  );
}

function InterviewHeader({
  role,
  answeredCount,
  totalQuestions,
  totalPlanned,
  progressPct,
  timerKey,
  timerPaused,
}: {
  role: string;
  answeredCount: number;
  totalQuestions: number;
  totalPlanned: number;
  progressPct: number;
  timerKey: string;
  timerPaused: boolean;
}) {
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-meta text-ink-muted">
            Question {answeredCount + 1} of {totalQuestions}
            {totalPlanned > totalQuestions ? "+" : ""}
          </p>
          <p className="mt-0.5 font-mono text-data text-ink-muted">{role}</p>
        </div>
        <QuestionTimer resetKey={timerKey} paused={timerPaused} />
      </div>
      <div className="mt-3 h-1 w-full rounded-full bg-stone-deep">
        <div
          className="h-1 rounded-full bg-brass transition-[width] duration-300"
          style={{ width: `${progressPct}%` }}
        />
      </div>
    </div>
  );
}

function InterviewerRail({
  role,
  experienceLevel,
  interviewType,
  difficulty,
}: {
  role: string;
  experienceLevel: string;
  interviewType: string;
  difficulty: string | null;
}) {
  return (
    <Surface inset="md" className="h-fit lg:sticky lg:top-6">
      <div className="flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-brass" aria-hidden />
        <p className="text-meta uppercase tracking-wide text-ink-muted">Interviewer context</p>
      </div>
      <dl className="mt-4 space-y-3 text-body-sm">
        <div>
          <dt className="text-meta text-ink-muted">Role</dt>
          <dd className="text-ink">{role}</dd>
        </div>
        <div>
          <dt className="text-meta text-ink-muted">Experience level</dt>
          <dd className="text-ink">{experienceLevel}</dd>
        </div>
        <div>
          <dt className="text-meta text-ink-muted">Interview style</dt>
          <dd className="text-ink capitalize">{interviewType}</dd>
        </div>
        {difficulty && (
          <div>
            <dt className="text-meta text-ink-muted">This question</dt>
            <dd className="text-ink">{DIFFICULTY_LABEL[difficulty] ?? difficulty}</dd>
          </div>
        )}
      </dl>
      <p className="mt-5 border-t border-line pt-4 text-meta text-ink-muted">
        Answer as you would out loud. Specifics and trade-offs land better than a textbook
        definition.
      </p>
    </Surface>
  );
}

function QuestionPanel({
  question,
  isSaved,
  answerText,
  setAnswerText,
  onKeyDown,
  isSubmitting,
  isRetry,
  submitError,
  onSubmit,
}: {
  question: QuestionRecord;
  isSaved: boolean;
  answerText: string;
  setAnswerText: (v: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  isSubmitting: boolean;
  isRetry: boolean;
  submitError: string | null;
  onSubmit: () => void;
}) {
  return (
    <>
      <Surface inset="lg">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {question.topic && <Tag tone="brass">{question.topic}</Tag>}
            {question.is_follow_up && <Tag tone="neutral">Follow-up</Tag>}
          </div>
          <SaveQuestionButton questionId={question.id} initiallySaved={isSaved} />
        </div>
        {question.is_follow_up && (
          <p className="mt-4 text-meta uppercase tracking-wide text-ink-muted">Follow-up</p>
        )}
        <p
          className={cn(
            "font-display text-display-sm italic text-ink",
            question.is_follow_up ? "mt-2" : "mt-4"
          )}
        >
          {question.question_text}
        </p>
      </Surface>

      <div className="mt-6">
        <label htmlFor="answer" className="text-body-sm text-ink-soft">
          Your answer
        </label>
        <Textarea
          id="answer"
          className="mt-1.5 min-h-[14rem]"
          value={answerText}
          onChange={(e) => setAnswerText(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={isSubmitting}
          placeholder="Answer as you would out loud — specifics help the feedback."
        />
        {submitError && <p className="mt-2 text-body-sm text-signal-error">{submitError}</p>}

        <div className="mt-4 flex flex-wrap items-center gap-4">
          <Button variant="accent" onClick={onSubmit} disabled={isSubmitting || !answerText.trim()}>
            {isSubmitting ? "Reviewing…" : isRetry ? "Retry evaluation" : "Submit answer"}
          </Button>
          <p className="text-meta text-ink-muted">⌘/Ctrl + Enter to submit</p>
        </div>

        {isSubmitting && (
          <div className="mt-4 flex items-center gap-2.5 text-body-sm text-ink-soft">
            <span className="h-2 w-2 animate-pulse-ring rounded-full bg-brass" aria-hidden />
            Reviewing your answer…
          </div>
        )}
      </div>
    </>
  );
}

function EvaluatedTurn({
  question,
  answer,
  evaluation,
  onNext,
  isLast,
  isSaved,
}: {
  question: QuestionRecord;
  answer: AnswerRecord;
  evaluation: EvaluationRecord;
  onNext: () => void;
  isLast: boolean;
  isSaved: boolean;
}) {
  return (
    <>
      <Surface inset="lg">
        <div className="flex items-start justify-between gap-3">
          {question.topic && <Tag tone="brass">{question.topic}</Tag>}
          <SaveQuestionButton questionId={question.id} initiallySaved={isSaved} />
        </div>
        <p className="mt-4 font-display text-display-sm italic text-ink">{question.question_text}</p>
        <p className="mt-4 text-body-sm text-ink-soft">{answer.answer_text}</p>
      </Surface>
      <div className="mt-6">
        <Surface inset="lg">
          <div className="flex items-center justify-between">
            <Tag tone="teal">Reviewed</Tag>
            {evaluation.overall_score !== null && (
              <span className="font-mono text-data text-ink-muted">
                Score {evaluation.overall_score} / 10
              </span>
            )}
          </div>

          {(evaluation.technical_score !== null ||
            evaluation.communication_score !== null ||
            evaluation.accuracy_score !== null ||
            evaluation.confidence_score !== null) && (
            <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 border-y border-line py-3 sm:grid-cols-4">
              <ScoreStat label="Technical" value={evaluation.technical_score} />
              <ScoreStat label="Accuracy" value={evaluation.accuracy_score} />
              <ScoreStat label="Communication" value={evaluation.communication_score} />
              <ScoreStat label="Confidence" value={evaluation.confidence_score} />
            </div>
          )}

          <div className="mt-4 space-y-4">
            {evaluation.feedback && (
              <p className="text-body-sm italic text-ink">{evaluation.feedback}</p>
            )}
            {evaluation.strengths.length > 0 && (
              <div>
                <p className="text-meta text-ink-muted">What landed</p>
                <ul className="mt-1.5 list-disc space-y-1 pl-4 text-body-sm text-ink-soft">
                  {evaluation.strengths.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
            {evaluation.weaknesses.length > 0 && (
              <div>
                <p className="text-meta text-ink-muted">Gaps</p>
                <ul className="mt-1.5 list-disc space-y-1 pl-4 text-body-sm text-ink-soft">
                  {evaluation.weaknesses.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
            {evaluation.improvement_suggestions.length > 0 && (
              <div>
                <p className="text-meta text-ink-muted">What to sharpen</p>
                <ul className="mt-1.5 list-disc space-y-1 pl-4 text-body-sm text-ink-soft">
                  {evaluation.improvement_suggestions.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Surface>
        <Button variant="accent" className="mt-4" onClick={onNext}>
          {isLast ? "See results" : "Next question"}
        </Button>
      </div>
    </>
  );
}

function ScoreStat({ label, value }: { label: string; value: number | null }) {
  if (value === null) return null;
  return (
    <div>
      <p className="text-meta text-ink-muted">{label}</p>
      <p className="font-mono text-data text-ink">{value} / 10</p>
    </div>
  );
}

function FinishScreen({
  interviewId,
  state,
  isCompleting,
  setIsCompleting,
  onCompleted,
}: {
  interviewId: string;
  state: InterviewState;
  isCompleting: boolean;
  setIsCompleting: (v: boolean) => void;
  onCompleted: (state: InterviewState) => void;
}) {
  const [error, setError] = React.useState<string | null>(null);

  const finish = async () => {
    setIsCompleting(true);
    setError(null);
    const outcome = await completeInterviewAction(interviewId);
    setIsCompleting(false);
    if (!outcome.ok || !outcome.state) {
      setError(outcome.error ?? "Couldn't finish this interview right now.");
      return;
    }
    onCompleted(outcome.state);
  };

  return (
    <Surface inset="lg" className="mx-auto max-w-prose text-center">
      <div className="flex items-center justify-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-brass" aria-hidden />
        <p className="text-meta uppercase tracking-wide text-ink-muted">Interviewer</p>
      </div>
      <p className="mt-3 text-meta text-ink-muted">{state.interview.target_role}</p>
      <h1 className="mt-2 font-display text-display-sm text-ink">
        That&rsquo;s all the questions I have for you today.
      </h1>
      <p className="mt-2 text-body-sm text-ink-soft">
        {state.questions.length} question{state.questions.length === 1 ? "" : "s"} answered and
        reviewed. Your report is ready whenever you are — this session stays saved either way.
      </p>
      {error && <p className="mt-3 text-body-sm text-signal-error">{error}</p>}
      <Button variant="accent" className="mt-5" onClick={finish} disabled={isCompleting}>
        {isCompleting ? "Preparing your report…" : "See my report"}
      </Button>
    </Surface>
  );
}

type Dimension = "technical_score" | "communication_score" | "accuracy_score" | "confidence_score";

const DIMENSION_LABEL: Record<Dimension, string> = {
  technical_score: "Technical",
  communication_score: "Communication",
  accuracy_score: "Accuracy",
  confidence_score: "Confidence",
};

function average(values: (number | null)[]): number | null {
  const nums = values.filter((v): v is number => v !== null).map(Number);
  if (nums.length === 0) return null;
  return Math.round((nums.reduce((s, v) => s + v, 0) / nums.length) * 10) / 10;
}

function ResultsSummary({ state }: { state: InterviewState }) {
  const { interview, questions, answers, evaluations } = state;

  const turns = questions.map((question) => {
    const answer = answers.find((a) => a.question_id === question.id) ?? null;
    const evaluation = answer ? evaluations.find((e) => e.answer_id === answer.id) ?? null : null;
    return { question, answer, evaluation };
  });

  const scoredTurns = turns.filter(
    (t): t is typeof t & { evaluation: EvaluationRecord } =>
      t.evaluation !== null && t.evaluation.overall_score !== null
  );

  const hasEnoughData = scoredTurns.length > 0;

  const overallAverage = average(evaluations.map((e) => e.overall_score));
  const dimensionAverages: Record<Dimension, number | null> = {
    technical_score: average(evaluations.map((e) => e.technical_score)),
    communication_score: average(evaluations.map((e) => e.communication_score)),
    accuracy_score: average(evaluations.map((e) => e.accuracy_score)),
    confidence_score: average(evaluations.map((e) => e.confidence_score)),
  };

  const allStrengths = evaluations.flatMap((e) => e.strengths);
  const allWeaknesses = evaluations.flatMap((e) => e.weaknesses);
  const allImprovements = evaluations.flatMap((e) => e.improvement_suggestions);

  // Topic performance breakdown — grouped from real persisted scores
  // only, no invented aggregate.
  const topicMap = new Map<string, number[]>();
  for (const t of scoredTurns) {
    const topic = t.question.topic ?? "General";
    const list = topicMap.get(topic) ?? [];
    list.push(Number(t.evaluation.overall_score));
    topicMap.set(topic, list);
  }
  const topicBreakdown = [...topicMap.entries()]
    .map(([topic, scores]) => ({
      topic,
      average: Math.round((scores.reduce((s, v) => s + v, 0) / scores.length) * 10) / 10,
      count: scores.length,
    }))
    .sort((a, b) => a.average - b.average);

  const strongestTurn = hasEnoughData
    ? [...scoredTurns].sort(
        (a, b) => Number(b.evaluation.overall_score) - Number(a.evaluation.overall_score)
      )[0]
    : null;
  const weakestTurn = hasEnoughData
    ? [...scoredTurns].sort(
        (a, b) => Number(a.evaluation.overall_score) - Number(b.evaluation.overall_score)
      )[0]
    : null;

  // Coaching recommendation: derived deterministically from the lowest
  // average dimension — never fabricated, and omitted entirely when
  // there isn't enough data to support it.
  const lowestDimension = hasEnoughData
    ? (Object.entries(dimensionAverages)
        .filter(([, v]) => v !== null)
        .sort((a, b) => (a[1] as number) - (b[1] as number))[0]?.[0] as Dimension | undefined)
    : undefined;

  return (
    <div>
      <div className="flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-brass" aria-hidden />
        <p className="text-meta uppercase tracking-wide text-ink-muted">Interview complete</p>
      </div>
      <p className="mt-3 text-meta text-ink-muted">{interview.target_role}</p>
      <h1 className="mt-2 font-display text-display-md text-ink">Your report</h1>
      <p className="mt-2 text-body-sm text-ink-soft">
        {answers.length} of {questions.length} question{questions.length === 1 ? "" : "s"} answered
      </p>

      {!hasEnoughData ? (
        <Surface inset="lg" className="mt-8 max-w-prose">
          <p className="text-body-sm text-ink">
            There isn&rsquo;t enough scored data yet to build a report — no answers were evaluated
            in this session.
          </p>
        </Surface>
      ) : (
        <>
          {/* Overall performance + score breakdown */}
          <Surface inset="lg" className="mt-8">
            <p className="text-meta text-ink-muted">Overall performance</p>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-display text-display-lg text-ink">{overallAverage}</span>
              <span className="text-body-sm text-ink-muted">/ 10 average</span>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-line pt-5 sm:grid-cols-4">
              {(Object.keys(DIMENSION_LABEL) as Dimension[]).map((dim) => (
                <div key={dim}>
                  <p className="text-meta text-ink-muted">{DIMENSION_LABEL[dim]}</p>
                  <p className="mt-1 font-mono text-data text-ink">
                    {dimensionAverages[dim] !== null ? `${dimensionAverages[dim]} / 10` : "—"}
                  </p>
                  <div className="mt-1.5 h-1 w-full rounded-full bg-stone-deep">
                    <div
                      className="h-1 rounded-full bg-brass"
                      style={{ width: `${((dimensionAverages[dim] ?? 0) / 10) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Surface>

          {/* What you did well / where you struggled */}
          {(allStrengths.length > 0 || allWeaknesses.length > 0) && (
            <div className="mt-6 grid gap-6 sm:grid-cols-2">
              {allStrengths.length > 0 && (
                <Surface inset="md">
                  <p className="text-meta text-ink-muted">What you did well</p>
                  <ul className="mt-2 list-disc space-y-1 pl-4 text-body-sm text-ink-soft">
                    {allStrengths.slice(0, 6).map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </Surface>
              )}
              {allWeaknesses.length > 0 && (
                <Surface inset="md">
                  <p className="text-meta text-ink-muted">Where you struggled</p>
                  <ul className="mt-2 list-disc space-y-1 pl-4 text-body-sm text-ink-soft">
                    {allWeaknesses.slice(0, 6).map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </Surface>
              )}
            </div>
          )}

          {/* Topic performance */}
          {topicBreakdown.length > 0 && (
            <Surface inset="lg" className="mt-6">
              <p className="text-meta text-ink-muted">Topic performance</p>
              <ul className="mt-3 space-y-3">
                {topicBreakdown.map((t) => (
                  <li key={t.topic} className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <Tag tone={t.average < 6 ? "neutral" : "teal"}>{t.topic}</Tag>
                      <span className="text-meta text-ink-muted">
                        {t.count} question{t.count === 1 ? "" : "s"}
                      </span>
                    </div>
                    <span className="font-mono text-data text-ink-muted">{t.average} / 10</span>
                  </li>
                ))}
              </ul>
              {topicBreakdown[0] && topicBreakdown[0].average < 6 && (
                <p className="mt-4 border-t border-line pt-3 text-meta text-ink-muted">
                  Needs more practice: {topicBreakdown[0].topic}
                </p>
              )}
            </Surface>
          )}

          {/* Strongest / weakest answer */}
          {(strongestTurn || weakestTurn) && (
            <div className="mt-6 grid gap-6 sm:grid-cols-2">
              {strongestTurn && (
                <Surface inset="md">
                  <div className="flex items-center justify-between">
                    <p className="text-meta text-ink-muted">Strongest answer</p>
                    <span className="font-mono text-data text-ink-muted">
                      {strongestTurn.evaluation.overall_score} / 10
                    </span>
                  </div>
                  <p className="mt-2 text-body-sm italic text-ink">
                    {strongestTurn.question.question_text}
                  </p>
                </Surface>
              )}
              {weakestTurn && (
                <Surface inset="md">
                  <div className="flex items-center justify-between">
                    <p className="text-meta text-ink-muted">Weakest answer</p>
                    <span className="font-mono text-data text-ink-muted">
                      {weakestTurn.evaluation.overall_score} / 10
                    </span>
                  </div>
                  <p className="mt-2 text-body-sm italic text-ink">
                    {weakestTurn.question.question_text}
                  </p>
                </Surface>
              )}
            </div>
          )}

          {/* Coach's recommendation */}
          {(lowestDimension || allImprovements.length > 0) && (
            <Surface inset="lg" className="mt-6 border-l-2 border-l-brass">
              <p className="text-meta text-ink-muted">Coach&rsquo;s recommendation</p>
              {lowestDimension && (
                <p className="mt-2 text-body-sm text-ink">
                  {DIMENSION_LABEL[lowestDimension]} scored lowest on average (
                  {dimensionAverages[lowestDimension]} / 10). That&rsquo;s the highest-leverage
                  place to focus next.
                </p>
              )}
              {allImprovements.length > 0 && (
                <ul className="mt-3 list-disc space-y-1 pl-4 text-body-sm text-ink-soft">
                  {allImprovements.slice(0, 4).map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              )}
            </Surface>
          )}
        </>
      )}

      {/* Full question/topic breakdown */}
      <ol className="mt-10 space-y-6">
        {turns.map(({ question, answer, evaluation }) => (
          <li key={question.id} className="border-t border-line pt-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {question.topic && <Tag tone="brass">{question.topic}</Tag>}
                {question.is_follow_up && <Tag tone="neutral">Follow-up</Tag>}
              </div>
              <div className="flex items-center gap-4">
                {evaluation?.overall_score != null && (
                  <span className="font-mono text-data text-ink-muted">
                    {evaluation.overall_score} / 10
                  </span>
                )}
                <SaveQuestionButton
                  questionId={question.id}
                  initiallySaved={state.savedQuestionIds.includes(question.id)}
                />
              </div>
            </div>
            <p className="mt-3 font-display text-display-sm italic text-ink">{question.question_text}</p>
            {answer ? (
              <p className="mt-3 text-body-sm text-ink-soft">{answer.answer_text}</p>
            ) : (
              <p className="mt-3 text-body-sm text-ink-muted">Not answered.</p>
            )}
          </li>
        ))}
      </ol>

      <div className="mt-10 flex gap-3">
        <Link href="/dashboard" className={buttonVariants({ variant: "accent", size: "md" })}>
          Back to sessions
        </Link>
      </div>
    </div>
  );
}

function EmptyState({
  title,
  body,
  actionHref,
  actionLabel,
}: {
  title: string;
  body: string;
  actionHref: string;
  actionLabel: string;
}) {
  return (
    <Surface inset="lg" className="max-w-prose">
      <h1 className="font-display text-display-sm text-ink">{title}</h1>
      <p className="mt-2 text-body-sm text-ink-soft">{body}</p>
      <Link href={actionHref as Route} className={cn(buttonVariants({ variant: "accent" }), "mt-5 inline-flex")}>
        {actionLabel}
      </Link>
    </Surface>
  );
}
