import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { Surface } from "@/components/ui/surface";
import { Tag } from "@/components/ui/tag";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getAnalyticsData, type AnalyticsFilters } from "@/services/analytics";
import { AnalyticsFiltersForm } from "@/features/analytics/filters";
import { TrendChart } from "@/features/analytics/trend-chart";
import { AiCoach } from "@/features/analytics/ai-coach";

const TYPE_LABEL: Record<string, string> = {
  technical: "Technical",
  behavioral: "Behavioral",
  situational: "Situational",
  mixed: "Mixed",
};

const DIMENSION_LABEL: Record<"technical" | "communication" | "accuracy" | "confidence", string> = {
  technical: "Technical",
  communication: "Communication",
  accuracy: "Accuracy",
  confidence: "Confidence",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function parseFilters(searchParams: { role?: string; type?: string; period?: string }): AnalyticsFilters {
  const filters: AnalyticsFilters = {};
  if (searchParams.role) filters.role = searchParams.role;
  if (searchParams.type) filters.interviewType = searchParams.type;
  if (searchParams.period) {
    const days = Number(searchParams.period);
    if (Number.isFinite(days) && days > 0) filters.periodDays = days;
  }
  return filters;
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: { role?: string; type?: string; period?: string };
}) {
  const filters = parseFilters(searchParams);
  const data = await getAnalyticsData(filters);

  return (
    <AppShell>
      <h1 className="font-display text-display-md text-ink">Analytics</h1>
      <p className="mt-2 max-w-prose text-body-sm text-ink-soft">
        How you&rsquo;re performing across completed interviews, and where to focus next — built
        entirely from your own scored answers.
      </p>

      {!data.hasData ? (
        <Surface inset="lg" className="mt-8 max-w-prose">
          <p className="text-body-sm text-ink">No analytics yet.</p>
          <p className="mt-1.5 text-body-sm text-ink-soft">
            Complete a mock interview and this page will fill in with your scores, a performance
            trend, and coaching notes — all built from your real, evaluated answers.
          </p>
          <Link
            href="/onboarding"
            className={cn(buttonVariants({ variant: "accent", size: "md" }), "mt-5 inline-flex")}
          >
            Start an interview
          </Link>
        </Surface>
      ) : (
        <>
          <AnalyticsFiltersForm options={data.filterOptions} applied={data.appliedFilters} />

          {data.filtersExcludeEverything ? (
            <Surface inset="lg" className="mt-8 max-w-prose">
              <p className="text-body-sm text-ink">No completed interviews match these filters.</p>
              <p className="mt-1.5 text-body-sm text-ink-soft">
                Try a broader role, interview type, or time period.
              </p>
              <a
                href="/analytics"
                className={cn(buttonVariants({ variant: "outline", size: "md" }), "mt-5 inline-flex")}
              >
                Clear filters
              </a>
            </Surface>
          ) : (
            <>
              {/* Overall performance */}
              {data.overall && (
                <Surface inset="lg" className="mt-8">
                  <p className="text-meta text-ink-muted">
                    Overall performance · {data.filteredInterviewsCount} completed interview
                    {data.filteredInterviewsCount === 1 ? "" : "s"}
                  </p>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="font-display text-display-lg text-ink">
                      {data.overall.overall ?? "—"}
                    </span>
                    <span className="text-body-sm text-ink-muted">/ 10 average</span>
                  </div>
                  <p className="mt-1 text-meta text-ink-muted">
                    Simple average of the overall score across all {data.overall.scoredAnswerCount}{" "}
                    evaluated answer{data.overall.scoredAnswerCount === 1 ? "" : "s"} — every answer
                    weighted equally.
                  </p>

                  <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-line pt-5 sm:grid-cols-4">
                    {(Object.keys(DIMENSION_LABEL) as Array<keyof typeof DIMENSION_LABEL>).map((dim) => {
                      const value = data.overall![dim];
                      return (
                        <div key={dim}>
                          <p className="text-meta text-ink-muted">{DIMENSION_LABEL[dim]}</p>
                          <p className="mt-1 font-mono text-data text-ink">
                            {value !== null ? `${value} / 10` : "—"}
                          </p>
                          <div className="mt-1.5 h-1 w-full rounded-full bg-stone-deep">
                            <div
                              className="h-1 rounded-full bg-brass"
                              style={{ width: `${((value ?? 0) / 10) * 100}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Surface>
              )}

              {/* Performance trend */}
              <Surface inset="lg" className="mt-6">
                <p className="text-meta text-ink-muted">Performance trend</p>
                {data.trend.length <= 1 ? (
                  <p className="mt-3 text-body-sm text-ink-soft">
                    {data.trend[0]?.score !== null && data.trend[0]?.score !== undefined
                      ? `Your one completed interview scored ${data.trend[0].score} / 10. `
                      : ""}
                    Complete another interview to start seeing a trend over time.
                  </p>
                ) : (
                  <div className="mt-4">
                    <TrendChart trend={data.trend} />
                  </div>
                )}
              </Surface>

              {/* Topic + difficulty performance */}
              <div className="mt-6 grid gap-6 lg:grid-cols-2">
                {data.topicPerformance.length > 0 && (
                  <Surface inset="lg">
                    <p className="text-meta text-ink-muted">Topic performance</p>
                    <ul className="mt-3 space-y-3">
                      {data.topicPerformance.map((t) => (
                        <li key={t.topic} className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-2">
                            <Tag tone={t.average < 6 ? "neutral" : "teal"}>{t.topic}</Tag>
                            <span className="text-meta text-ink-muted">
                              {t.count} answer{t.count === 1 ? "" : "s"}
                            </span>
                          </div>
                          <span className="font-mono text-data text-ink-muted">{t.average} / 10</span>
                        </li>
                      ))}
                    </ul>
                    {data.topicPerformance.length > 1 && (
                      <p className="mt-4 border-t border-line pt-3 text-meta text-ink-muted">
                        Strongest: {data.topicPerformance[0]?.topic} · Needs practice:{" "}
                        {data.topicPerformance[data.topicPerformance.length - 1]?.topic}
                      </p>
                    )}
                  </Surface>
                )}

                <Surface inset="lg">
                  <p className="text-meta text-ink-muted">Performance by difficulty</p>
                  {data.difficultyPerformance ? (
                    <ul className="mt-3 space-y-3">
                      {data.difficultyPerformance.map((d) => (
                        <li key={d.difficulty} className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-2">
                            <Tag tone="neutral" className="capitalize">
                              {d.difficulty}
                            </Tag>
                            <span className="text-meta text-ink-muted">
                              {d.count} answer{d.count === 1 ? "" : "s"}
                            </span>
                          </div>
                          <span className="font-mono text-data text-ink-muted">{d.average} / 10</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-body-sm text-ink-soft">
                      Not enough difficulty data yet — this fills in as you complete more questions.
                    </p>
                  )}
                </Surface>
              </div>

              {/* Strongest / weakest answer */}
              {(data.strongestAnswer || data.weakestAnswer) && (
                <div className="mt-6 grid gap-6 sm:grid-cols-2">
                  {data.strongestAnswer && (
                    <Surface inset="md">
                      <div className="flex items-center justify-between">
                        <p className="text-meta text-ink-muted">Strongest answer</p>
                        <span className="font-mono text-data text-ink-muted">
                          {data.strongestAnswer.score} / 10
                        </span>
                      </div>
                      <p className="mt-2 text-body-sm italic text-ink">{data.strongestAnswer.question}</p>
                      {data.strongestAnswer.topic && (
                        <Tag tone="teal" className="mt-2">
                          {data.strongestAnswer.topic}
                        </Tag>
                      )}
                      {data.strongestAnswer.feedback && (
                        <p className="mt-2 text-body-sm text-ink-soft">{data.strongestAnswer.feedback}</p>
                      )}
                      <Link
                        href={`/interview/${data.strongestAnswer.interviewId}`}
                        className="mt-3 inline-block text-meta text-ink-muted hover:text-ink"
                      >
                        View interview →
                      </Link>
                    </Surface>
                  )}
                  {data.weakestAnswer && (
                    <Surface inset="md">
                      <div className="flex items-center justify-between">
                        <p className="text-meta text-ink-muted">Weakest answer</p>
                        <span className="font-mono text-data text-ink-muted">
                          {data.weakestAnswer.score} / 10
                        </span>
                      </div>
                      <p className="mt-2 text-body-sm italic text-ink">{data.weakestAnswer.question}</p>
                      {data.weakestAnswer.topic && (
                        <Tag tone="neutral" className="mt-2">
                          {data.weakestAnswer.topic}
                        </Tag>
                      )}
                      {data.weakestAnswer.feedback && (
                        <p className="mt-2 text-body-sm text-ink-soft">{data.weakestAnswer.feedback}</p>
                      )}
                      <Link
                        href={`/interview/${data.weakestAnswer.interviewId}`}
                        className="mt-3 inline-block text-meta text-ink-muted hover:text-ink"
                      >
                        View interview →
                      </Link>
                    </Surface>
                  )}
                </div>
              )}

              {/* Improvement areas */}
              {data.improvementAreas.length > 0 && (
                <Surface inset="lg" className="mt-6">
                  <p className="text-meta text-ink-muted">Areas to work on</p>
                  <ul className="mt-3 list-disc space-y-1.5 pl-4 text-body-sm text-ink-soft">
                    {data.improvementAreas.map((area, i) => (
                      <li key={i}>{area}</li>
                    ))}
                  </ul>
                </Surface>
              )}

              {/* Time-based improvement */}
              {data.timeBasedImprovement && (
                <Surface inset="lg" className="mt-6">
                  <p className="text-meta text-ink-muted">Improvement over time</p>
                  {data.timeBasedImprovement.interviewCount === 1 ? (
                    <p className="mt-2 text-body-sm text-ink">
                      Complete another interview to see your improvement.
                    </p>
                  ) : (
                    <p className="mt-2 text-body-sm text-ink">
                      Your overall score went from {data.timeBasedImprovement.firstScore} / 10 on your
                      first completed interview to {data.timeBasedImprovement.recentScore} / 10 most
                      recently —{" "}
                      {data.timeBasedImprovement.absoluteImprovement >= 0 ? "up" : "down"}{" "}
                      {Math.abs(data.timeBasedImprovement.absoluteImprovement)} point
                      {Math.abs(data.timeBasedImprovement.absoluteImprovement) === 1 ? "" : "s"}
                      {data.timeBasedImprovement.percentImprovement !== null &&
                        ` (${data.timeBasedImprovement.percentImprovement >= 0 ? "+" : ""}${data.timeBasedImprovement.percentImprovement}%)`}
                      .
                    </p>
                  )}
                </Surface>
              )}

              {/* AI coach — generated only on explicit request */}
              <AiCoach filters={data.appliedFilters} />

              {/* History insights */}
              <div className="mt-10 border-t border-line pt-8">
                <h2 className="font-display text-display-sm text-ink">Completed interviews</h2>
                <ul className="mt-5 divide-y divide-line border-t border-line">
                  {data.historyInsights.map((h) => (
                    <li key={h.id}>
                      <Link
                        href={`/interview/${h.id}`}
                        className="flex flex-wrap items-center justify-between gap-3 py-4 transition-colors hover:bg-stone-deep"
                      >
                        <div>
                          <p className="text-body-sm font-medium text-ink">{h.title ?? h.role}</p>
                          <p className="mt-1 text-meta text-ink-muted">
                            {h.role} · {TYPE_LABEL[h.interviewType] ?? h.interviewType} · {formatDate(h.date)}
                            {" · "}
                            {h.questionCount} question{h.questionCount === 1 ? "" : "s"}
                            {h.followUpCount > 0 &&
                              ` (${h.followUpCount} follow-up${h.followUpCount === 1 ? "" : "s"})`}
                          </p>
                        </div>
                        <span className="font-mono text-data text-ink-muted">
                          {h.overallScore !== null ? `${h.overallScore} / 10` : "—"}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </>
      )}
    </AppShell>
  );
}
