import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { ConsolePanel } from "@/components/marketing/console-panel";

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* A single hairline rule set behind the headline stands in for the
          "studio" idea — a mark on the wall, not a decorative gradient. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-24 h-px bg-line md:top-32"
      />

      <div className="mx-auto grid max-w-studio gap-14 px-6 pb-20 pt-14 lg:grid-cols-[1.05fr_1fr] lg:gap-10 lg:pb-28 lg:pt-20">
        <div className="flex flex-col justify-center">
          <p className="font-mono text-data uppercase tracking-[0.16em] text-brass-dim">
            Interview rehearsal, not a quiz bank
          </p>

          <h1 className="mt-5 font-display text-display-lg text-ink lg:text-display-xl">
            Prepare for the
            <br />
            interview you
            <br />
            <span className="italic text-brass-dim">actually</span> want.
          </h1>

          <p className="mt-7 max-w-prose text-body text-ink-soft">
            Tell InterviewLab the role, and it builds a practice session
            around it — real questions, asked one at a time, with feedback
            on each answer before the next one comes up.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-4">
            <Link href="/auth/sign-up" className={buttonVariants({ variant: "accent", size: "lg" })}>
              Start practicing
            </Link>
            <Link href="#studio" className={buttonVariants({ variant: "outline", size: "lg" })}>
              See a session
            </Link>
          </div>

          <dl className="mt-16 grid max-w-md grid-cols-3 gap-6 border-t border-line pt-6">
            <div>
              <dt className="text-meta text-ink-muted">Set up</dt>
              <dd className="mt-1 font-display text-display-sm text-ink">Role-first</dd>
            </div>
            <div>
              <dt className="text-meta text-ink-muted">Practice</dt>
              <dd className="mt-1 font-display text-display-sm text-ink">One at a time</dd>
            </div>
            <div>
              <dt className="text-meta text-ink-muted">Feedback</dt>
              <dd className="mt-1 font-display text-display-sm text-ink">After every answer</dd>
            </div>
          </dl>
        </div>

        <div className="lg:pt-6">
          <ConsolePanel />
          <p className="mt-3 text-center font-mono text-meta text-ink-muted lg:text-left">
            An actual InterviewLab session — try the hint and submit buttons.
          </p>
        </div>
      </div>
    </section>
  );
}
