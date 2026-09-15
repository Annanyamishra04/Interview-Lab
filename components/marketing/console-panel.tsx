"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Tag } from "@/components/ui/tag";

const QUESTION =
  "Two services both write to the same orders table under load. Walk me through how you'd stop them from stepping on each other.";

const REVIEW = [
  { label: "Technical depth", verdict: "Strong" as const },
  { label: "Clarity", verdict: "Good" as const },
  { label: "Trade-off reasoning", verdict: "Needs work" as const },
];

const COACH_NOTE =
  "Your approach is directionally correct. Push it further by naming what you'd give up with row-level locking versus optimistic concurrency, and when you'd choose one over the other.";

const HINT =
  "Start by naming the failure mode (a race, not just \"a bug\"), then pick one concurrency-control strategy and defend it.";

/**
 * A studio console standing in for an actual InterviewLab session, not a
 * screenshot or a fake analytics dashboard. State moves forward on its
 * own — question, a filled-in answer, a hint if requested, feedback —
 * the way a real rehearsal would, so a visitor understands the product
 * by watching it rather than reading about it.
 */
export function ConsolePanel() {
  const reduceMotion = useReducedMotion();
  const [view, setView] = React.useState<"question" | "feedback">("question");
  const [hintShown, setHintShown] = React.useState(false);
  const [elapsed, setElapsed] = React.useState(74);

  React.useEffect(() => {
    if (view !== "question") return;
    const id = window.setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [view]);

  const minutes = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const seconds = String(elapsed % 60).padStart(2, "0");

  const submit = () => {
    setView("feedback");
  };

  const restart = () => {
    setElapsed(0);
    setHintShown(false);
    setView("question");
  };

  const fade = reduceMotion
    ? { initial: { opacity: 1 }, animate: { opacity: 1 }, exit: { opacity: 1 }, transition: { duration: 0 } }
    : { initial: { opacity: 0, y: 6 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -6 }, transition: { duration: 0.22, ease: "easeOut" } };

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-ink text-stone shadow-overlay">
      {/* Console header: recording state + running timer */}
      <div className="flex items-center justify-between gap-3 border-b border-ink-soft px-5 py-3.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="absolute h-2 w-2 rounded-full bg-brass animate-pulse-ring" />
          </span>
          <span className="truncate font-mono text-data text-stone/70">
            QUESTION 04 / 10 <span className="hidden sm:inline">· Backend Engineering</span>
          </span>
        </div>
        <span className="shrink-0 font-mono text-data tabular-nums text-stone/50">
          {minutes}:{seconds}
        </span>
      </div>

      {/* Progress rail */}
      <div className="flex h-[3px] w-full bg-ink-soft">
        <motion.div
          className="h-full bg-brass"
          initial={false}
          animate={{ width: "40%" }}
          transition={{ duration: reduceMotion ? 0 : 0.4, ease: "easeOut" }}
        />
      </div>

      <div className="p-6">
        <AnimatePresence mode="wait">
          {view === "question" ? (
            <motion.div key="question" {...fade}>
              <Tag tone="brass">Backend Engineering · Senior</Tag>
              <p className="mt-4 font-display text-display-sm italic text-stone">{QUESTION}</p>

              <div className="mt-5">
                <p className="text-meta text-stone/50">Your answer</p>
                <div className="mt-2 min-h-[6.5rem] rounded border border-ink-soft bg-ink-soft/40 p-3.5 text-body-sm text-stone/85 ring-1 ring-transparent transition-shadow focus-within:ring-brass">
                  I&rsquo;d start by identifying whether this is a write conflict or a true
                  race condition, then reach for row-level locking or an
                  optimistic-concurrency check depending on&nbsp;
                  <span className="inline-block w-[1px] animate-pulse bg-brass align-middle" style={{ height: "1em" }} />
                </div>
              </div>

              <AnimatePresence>
                {hintShown && (
                  <motion.p
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: reduceMotion ? 0 : 0.18 }}
                    className="mt-3 overflow-hidden rounded border border-teal/40 bg-teal-tint/10 px-3.5 py-2.5 text-body-sm text-stone/80"
                  >
                    <span className="text-meta font-medium text-teal-tint">Hint </span>
                    {HINT}
                  </motion.p>
                )}
              </AnimatePresence>

              <div className="mt-5 flex items-center gap-3">
                <button
                  onClick={submit}
                  className="rounded bg-brass px-4 py-2 text-body-sm font-medium text-ink transition-colors hover:bg-brass-dim active:translate-y-px"
                >
                  Submit answer
                </button>
                <button
                  onClick={() => setHintShown(true)}
                  disabled={hintShown}
                  className="text-body-sm text-stone/60 underline underline-offset-4 transition-colors hover:text-stone disabled:pointer-events-none disabled:text-stone/30"
                >
                  Get a hint
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div key="feedback" {...fade}>
              <div className="flex items-center justify-between">
                <Tag tone="teal">Answer reviewed</Tag>
                <span className="font-mono text-data text-stone/60">Score 7 / 10</span>
              </div>

              <dl className="mt-4 space-y-2.5">
                {REVIEW.map((row) => (
                  <div key={row.label} className="flex items-center justify-between border-b border-ink-soft pb-2.5">
                    <dt className="text-body-sm text-stone/70">{row.label}</dt>
                    <dd
                      className={`text-body-sm font-medium ${
                        row.verdict === "Needs work" ? "text-brass" : "text-teal-tint"
                      }`}
                    >
                      {row.verdict}
                    </dd>
                  </div>
                ))}
              </dl>

              <p className="mt-4 text-body-sm leading-relaxed text-stone/85">{COACH_NOTE}</p>

              <div className="mt-5 flex items-center gap-3">
                <button
                  onClick={restart}
                  className="rounded bg-brass px-4 py-2 text-body-sm font-medium text-ink transition-colors hover:bg-brass-dim active:translate-y-px"
                >
                  Next question
                </button>
                <span className="font-mono text-data text-stone/40">05 / 10 up next</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
