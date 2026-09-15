import { Tag } from "@/components/ui/tag";
import { ArrowRight } from "lucide-react";

const RESUME_LINES = [
  { text: "Led the checkout redesign end-to-end", highlight: true },
  { text: "React, Node.js, PostgreSQL", highlight: true },
  { text: "Reduced page load time by 34%", highlight: true },
  { text: "Mentored two junior engineers", highlight: false },
];

/**
 * The resume and the resulting question sit side by side as two plain
 * documents connected by one arrow — the point is the transformation,
 * not an upload widget, so there's no dropzone or file-picker chrome here.
 */
export function ResumeSection() {
  return (
    <section id="resume" className="border-t border-line">
      <div className="mx-auto max-w-studio px-6 py-20 lg:py-24">
        <div className="max-w-prose">
          <p className="font-mono text-data uppercase tracking-[0.16em] text-brass-dim">
            Coming next — resume-based practice
          </p>
          <h2 className="mt-4 font-display text-display-md text-ink">
            Your resume shouldn&rsquo;t be invisible after you upload it.
          </h2>
          <p className="mt-5 text-body text-ink-soft">
            InterviewLab will read the projects, technologies, and
            responsibilities already on your resume and build questions
            around them specifically — not a generic bank, a session that
            already knows what you&rsquo;ve done.
          </p>
        </div>

        <div className="mt-14 grid items-center gap-6 lg:grid-cols-[1fr_auto_1fr]">
          <div className="rounded-lg border border-line bg-stone-panel p-6">
            <p className="text-meta text-ink-muted">Your resume</p>
            <ul className="mt-4 space-y-3">
              {RESUME_LINES.map((line) => (
                <li
                  key={line.text}
                  className={`text-body-sm ${
                    line.highlight
                      ? "border-l-2 border-brass pl-3 text-ink"
                      : "border-l-2 border-transparent pl-3 text-ink-muted"
                  }`}
                >
                  {line.text}
                </li>
              ))}
            </ul>
          </div>

          <div
            aria-hidden="true"
            className="flex items-center justify-center text-line-strong lg:rotate-0"
          >
            <ArrowRight className="hidden h-6 w-6 lg:block" strokeWidth={1.5} />
            <div className="h-6 w-px bg-line-strong lg:hidden" />
          </div>

          <div className="rounded-lg border border-line bg-ink p-6 text-stone">
            <Tag tone="brass">Generated from your resume</Tag>
            <p className="mt-4 font-display text-display-sm italic text-stone">
              &ldquo;You led the checkout redesign — walk me through a decision
              on that project you&rsquo;d make differently today.&rdquo;
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
