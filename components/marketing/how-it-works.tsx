const STEPS = [
  {
    n: "01",
    title: "Set your target",
    body: "Job title, experience level, and the interview type — behavioral, technical, or a mix.",
  },
  {
    n: "02",
    title: "Get a real question set",
    body: "Generated for that exact combination, at the difficulty you chose, not pulled from a generic bank.",
  },
  {
    n: "03",
    title: "Practice the questions",
    body: "Work through the session like a real interview: one question, your answer, then the next.",
  },
  {
    n: "04",
    title: "Get coached",
    body: "Feedback on each answer, with a follow-up question when your answer leaves something unresolved.",
  },
] as const;

export function HowItWorks() {
  return (
    <section id="how-it-works" className="border-t border-line">
      <div className="mx-auto max-w-studio px-6 py-20 lg:py-24">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="max-w-prose font-display text-display-md text-ink">
            A session works like a real interview, not a form.
          </h2>
          <p className="max-w-xs text-body-sm text-ink-muted">
            Four steps, one continuous rehearsal — not four separate features.
          </p>
        </div>

        <ol className="relative mt-16 grid gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-4">
          {/* A single rule running behind the numbers ties the four steps
              into one process rather than four unrelated cards. */}
          <div
            aria-hidden="true"
            className="absolute inset-x-0 top-0 hidden h-px bg-line lg:block"
          />
          {STEPS.map((step, i) => (
            <li key={step.n} className="relative pt-5">
              <div
                aria-hidden="true"
                className="absolute inset-x-0 top-0 h-px bg-line-strong lg:hidden"
              />
              <span className="font-mono text-data text-brass-dim">{step.n}</span>
              <h3 className="mt-3 font-display text-display-sm text-ink">{step.title}</h3>
              <p className="mt-2 text-body-sm text-ink-soft">{step.body}</p>
              {i < STEPS.length - 1 && (
                <span
                  aria-hidden="true"
                  className="absolute -right-4 top-5 hidden font-display text-display-sm text-line-strong lg:block"
                >
                  →
                </span>
              )}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
