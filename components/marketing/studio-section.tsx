import { Tag } from "@/components/ui/tag";

const TOPICS = ["System design", "SQL", "Leadership", "Debugging", "Communication"];

const CRITERIA = [
  { label: "Structure", value: 85 },
  { label: "Specificity", value: 60 },
  { label: "Trade-off reasoning", value: 45 },
];

/**
 * A light-toned workspace card, deliberately distinct from the dark
 * console in the hero — the two previews together read as "the same
 * product, two moments," not a repeated component.
 */
export function StudioSection() {
  return (
    <section id="studio" className="border-t border-line bg-stone-panel">
      <div className="mx-auto grid max-w-studio gap-14 px-6 py-20 lg:grid-cols-2 lg:gap-16 lg:py-24">
        <div className="flex flex-col justify-center">
          <p className="font-mono text-data uppercase tracking-[0.16em] text-brass-dim">
            Inside the studio
          </p>
          <h2 className="mt-4 font-display text-display-md text-ink">
            Practice the parts that are actually hard to rehearse alone.
          </h2>
          <p className="mt-5 max-w-prose text-body text-ink-soft">
            Anyone can rehearse &ldquo;tell me about yourself&rdquo; in a mirror.
            It&rsquo;s harder to get useful practice on a system-design
            walkthrough, a behavioral question that needs a real story, or a
            follow-up you didn&rsquo;t expect. InterviewLab asks those, reads
            the whole answer, and tells you what a hiring panel would
            actually notice.
          </p>
          <div className="mt-8 flex flex-wrap gap-2">
            {TOPICS.map((topic) => (
              <Tag key={topic} tone="neutral">
                {topic}
              </Tag>
            ))}
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-line bg-stone">
          <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
            <span className="truncate text-meta text-ink-muted">Question 6 of 10</span>
            <span className="shrink-0 font-mono text-data text-ink-muted">
              <span className="hidden sm:inline">System Design · </span>Senior
            </span>
          </div>

          <div className="flex h-[3px] w-full bg-line">
            <div className="h-full w-3/5 bg-brass" />
          </div>

          <div className="p-6">
            <p className="font-display text-display-sm italic text-ink">
              How would you design a rate limiter for a public API with
              10,000 requests per second?
            </p>

            <div className="mt-4 rounded border border-line-strong bg-stone-panel px-3.5 py-3 text-body-sm text-ink-soft">
              I&rsquo;d use a token-bucket algorithm at the edge, backed by a
              shared store so limits hold across instances…
            </div>

            <div className="mt-5 flex items-center justify-between text-body-sm">
              <span className="text-brass-dim underline underline-offset-4">Get a hint</span>
              <span className="rounded bg-ink px-3.5 py-1.5 font-medium text-stone">
                Submit answer
              </span>
            </div>

            <div className="mt-6 border-t border-line pt-5">
              <p className="text-meta text-ink-muted">AI evaluation</p>
              <div className="mt-3 space-y-3">
                {CRITERIA.map((c) => (
                  <div key={c.label}>
                    <div className="flex items-center justify-between text-body-sm">
                      <span className="text-ink-soft">{c.label}</span>
                      <span className="text-ink-muted">{c.value}%</span>
                    </div>
                    <div className="mt-1.5 h-1 rounded-full bg-line">
                      <div
                        className="h-full rounded-full bg-teal"
                        style={{ width: `${c.value}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
