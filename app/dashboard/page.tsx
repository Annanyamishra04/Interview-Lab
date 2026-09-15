import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { Surface } from "@/components/ui/surface";
import { Tag } from "@/components/ui/tag";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getUserInterviews } from "@/services/interviews";
import { getContinueInterviewSummary } from "@/services/interview-service";
import { getDashboardPerformanceSummary } from "@/services/analytics";
import { listSavedQuestionsWithContext } from "@/services/saved-questions";

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  in_progress: "In progress",
  completed: "Completed",
};

const RECENT_INTERVIEWS_LIMIT = 5;
const SAVED_GLANCE_LIMIT = 3;

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default async function DashboardPage() {
  const [interviews, continueSummary, performance, savedQuestions] = await Promise.all([
    getUserInterviews(),
    getContinueInterviewSummary(),
    getDashboardPerformanceSummary(),
    listSavedQuestionsWithContext(),
  ]);

  const recentInterviews = interviews.slice(0, RECENT_INTERVIEWS_LIMIT);

  return (
    <AppShell>
      <h1 className="font-display text-display-md text-ink">Start a mock interview</h1>
      <p className="mt-2 max-w-prose text-body-sm text-ink-soft">
        Set up a role and question set, then work through it question by question with an AI
        interviewer scoring each answer as you go.
      </p>

      {/* Priority 1 — pick up an in-progress session. The single most
          useful thing the dashboard can surface, so it leads. */}
      {continueSummary && (
        <Surface inset="lg" className="mt-8 border-l-2 border-l-brass">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <p className="text-meta text-ink-muted">Continue your interview</p>
              <h2 className="mt-2 font-display text-display-sm text-ink">
                {continueSummary.interview.title ?? continueSummary.interview.target_role}
              </h2>
              <p className="mt-1.5 text-body-sm text-ink-soft">
                {continueSummary.interview.target_role} · {continueSummary.interview.interview_type}
                {" · "}
                {continueSummary.questionsCompleted} of {continueSummary.questionsTotal} questions
                completed
              </p>
              <p className="mt-1 text-meta text-ink-muted">
                Last activity {formatRelativeTime(continueSummary.lastActivityAt)}
              </p>
              <div className="mt-4 h-1.5 w-56 rounded-full bg-stone-deep">
                <div
                  className="h-1.5 rounded-full bg-brass"
                  style={{
                    width: `${
                      continueSummary.questionsTotal > 0
                        ? Math.round(
                            (continueSummary.questionsCompleted / continueSummary.questionsTotal) * 100
                          )
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>
            <Link
              href={`/interview/${continueSummary.interview.id}`}
              className={cn(buttonVariants({ variant: "accent", size: "md" }), "shrink-0 self-center")}
            >
              Continue
            </Link>
          </div>
        </Surface>
      )}

      {/* Priority 2 — start something new. */}
      <div className={cn("grid gap-6 sm:grid-cols-2", continueSummary ? "mt-6" : "mt-8")}>
        <Surface inset="lg" className="flex flex-col justify-between">
          <div>
            <p className="text-meta text-ink-muted">Role-first</p>
            <h2 className="mt-2 font-display text-display-sm text-ink">New mock interview</h2>
            <p className="mt-2 text-body-sm text-ink-soft">
              Choose a role, level, interview type, and topics — then step into the interview
              room.
            </p>
          </div>
          <Link
            href="/onboarding"
            className={cn(buttonVariants({ variant: "accent", size: "md" }), "mt-6 self-start")}
          >
            Set up a mock interview
          </Link>
        </Surface>

        <Surface inset="lg" className="flex flex-col justify-between">
          <div>
            <p className="text-meta text-ink-muted">Resume-based</p>
            <h2 className="mt-2 font-display text-display-sm text-ink">From a resume</h2>
            <p className="mt-2 text-body-sm text-ink-soft">
              Upload a resume and get questions grounded in what&apos;s on it.
            </p>
          </div>
          <Link
            href="/resume"
            className={cn(buttonVariants({ variant: "outline", size: "md" }), "mt-6 self-start")}
          >
            Use a resume
          </Link>
        </Surface>
      </div>

      {/* Priority 3 — performance snapshot, a glance not a dashboard. */}
      {performance.hasData && (
        <Surface inset="lg" className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div>
              <p className="text-meta text-ink-muted">Your performance</p>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="font-display text-display-sm text-ink">
                  {performance.overallScore ?? "—"}
                </span>
                <span className="text-body-sm text-ink-muted">/ 10 average</span>
                {performance.trendDirection && (
                  <span className="text-meta text-ink-muted">
                    ·{" "}
                    {performance.trendDirection === "up"
                      ? "Trending up"
                      : performance.trendDirection === "down"
                        ? "Trending down"
                        : "Holding steady"}
                  </span>
                )}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-meta text-ink-muted">
                {performance.topStrength && (
                  <span>
                    Top strength: <Tag tone="teal">{performance.topStrength.topic}</Tag>
                  </span>
                )}
                {performance.needsPractice &&
                  performance.needsPractice.topic !== performance.topStrength?.topic && (
                    <span>
                      Needs practice: <Tag tone="neutral">{performance.needsPractice.topic}</Tag>
                    </span>
                  )}
              </div>
            </div>
            <Link href="/analytics" className={cn(buttonVariants({ variant: "outline", size: "md" }), "shrink-0")}>
              View analytics
            </Link>
          </div>
        </Surface>
      )}

      {/* Priority 4 — recent interviews, trimmed; full list lives on /history. */}
      <div className="mt-14 border-t border-line pt-8">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-display-sm text-ink">Recent interviews</h2>
          {interviews.length > 0 && (
            <Link href="/history" className="text-meta text-ink-muted hover:text-ink">
              View all →
            </Link>
          )}
        </div>

        {interviews.length === 0 ? (
          <Surface inset="lg" className="mt-5 max-w-prose">
            <p className="text-body-sm text-ink">No interviews yet.</p>
            <p className="mt-1.5 text-body-sm text-ink-soft">
              Build your first interview session and start practicing.
            </p>
            <Link
              href="/onboarding"
              className={cn(buttonVariants({ variant: "accent", size: "md" }), "mt-5 inline-flex")}
            >
              Create an interview
            </Link>
          </Surface>
        ) : (
          <ul className="mt-5 divide-y divide-line border-t border-line">
            {recentInterviews.map((interview) => (
              <li key={interview.id}>
                <Link
                  href={`/interview/${interview.id}`}
                  className="flex items-center justify-between gap-4 py-4 transition-colors hover:bg-stone-deep"
                >
                  <div>
                    <p className="text-body-sm font-medium text-ink">
                      {interview.title ?? interview.target_role}
                    </p>
                    <p className="mt-1 text-meta text-ink-muted">
                      {interview.experience_level} · {interview.interview_type} ·{" "}
                      {interview.question_count} questions
                    </p>
                  </div>
                  <Tag tone={interview.status === "completed" ? "teal" : "neutral"}>
                    {STATUS_LABEL[interview.status] ?? interview.status}
                  </Tag>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Priority 5 — saved questions, a glance; full library on /saved. */}
      {savedQuestions.length > 0 && (
        <div className="mt-14 border-t border-line pt-8">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-display-sm text-ink">Saved questions</h2>
            <Link href="/saved" className="text-meta text-ink-muted hover:text-ink">
              View all →
            </Link>
          </div>
          <ul className="mt-5 divide-y divide-line border-t border-line">
            {savedQuestions.slice(0, SAVED_GLANCE_LIMIT).map((item) => (
              <li key={item.id} className="py-4">
                <div className="flex flex-wrap items-center gap-2">
                  {item.question?.topic && <Tag tone="brass">{item.question.topic}</Tag>}
                </div>
                <p className="mt-2 text-body-sm italic text-ink">
                  {item.question?.questionText ?? "This question is no longer available."}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </AppShell>
  );
}
