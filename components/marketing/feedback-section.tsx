const REVIEW = [
  { label: "Technical depth", verdict: "Strong" },
  { label: "Clarity", verdict: "Good" },
  { label: "Trade-off reasoning", verdict: "Needs work" },
] as const;

/**
 * Two columns joined by one hairline rule — an answer on the left, a
 * review on the right — rather than a scored report card. The tone is
 * a coach reading your answer back to you, not a grade.
 */
export function FeedbackSection() {
  return (
    <section className="border-t border-line bg-stone-panel">
      <div className="mx-auto max-w-studio px-6 py-20 lg:py-24">
        <div className="max-w-prose">
          <p className="font-mono text-data uppercase tracking-[0.16em] text-brass-dim">
            What feedback looks like
          </p>
          <h2 className="mt-4 font-display text-display-md text-ink">
            Coaching, not just a score.
          </h2>
        </div>

        <div className="mt-14 grid gap-10 border-t border-line-strong pt-10 lg:grid-cols-2 lg:gap-16">
          <div>
            <p className="text-meta text-ink-muted">Your answer</p>
            <p className="mt-3 font-display text-display-sm italic text-ink">
              &ldquo;I would start by identifying whether this is a write
              conflict or a true race condition, then reach for row-level
              locking…&rdquo;
            </p>
          </div>

          <div>
            <p className="text-meta text-ink-muted">AI review</p>
            <dl className="mt-3 divide-y divide-line">
              {REVIEW.map((row) => (
                <div key={row.label} className="flex items-center justify-between py-2.5 first:pt-0">
                  <dt className="text-body-sm text-ink-soft">{row.label}</dt>
                  <dd
                    className={`text-body-sm font-medium ${
                      row.verdict === "Needs work" ? "text-brass-dim" : "text-teal"
                    }`}
                  >
                    {row.verdict}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-5 text-body-sm leading-relaxed text-ink-soft">
              Your approach is directionally correct. Push the answer further
              by explaining what you&rsquo;d give up with row-level locking
              versus optimistic concurrency, and when you&rsquo;d choose one
              over the other.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
