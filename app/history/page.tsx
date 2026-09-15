import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { Surface } from "@/components/ui/surface";
import { Tag } from "@/components/ui/tag";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getUserInterviews } from "@/services/interviews";
import { getAnalyticsData } from "@/services/analytics";

export default async function HistoryPage() {
  const [interviews, analytics] = await Promise.all([getUserInterviews(), getAnalyticsData({})]);

  const insightsByInterviewId = new Map(analytics.historyInsights.map((h) => [h.id, h]));

  return (
    <AppShell>
      <h1 className="font-display text-display-md text-ink">History</h1>

      {interviews.length === 0 ? (
        <Surface inset="lg" className="mt-6 max-w-prose">
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
        <ul className="mt-6 divide-y divide-line border-t border-line">
          {interviews.map((interview) => {
            const insight = insightsByInterviewId.get(interview.id);
            return (
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
                      {new Date(interview.created_at).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}{" "}
                      · {interview.difficulty}
                      {insight &&
                        ` · ${insight.questionCount} question${insight.questionCount === 1 ? "" : "s"}${
                          insight.followUpCount > 0
                            ? ` (${insight.followUpCount} follow-up${insight.followUpCount === 1 ? "" : "s"})`
                            : ""
                        }`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {insight?.overallScore !== undefined && insight?.overallScore !== null && (
                      <span className="font-mono text-data text-ink-muted">
                        {insight.overallScore} / 10
                      </span>
                    )}
                    <Tag tone={interview.status === "completed" ? "teal" : "neutral"}>
                      {interview.status.replace("_", " ")}
                    </Tag>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </AppShell>
  );
}

