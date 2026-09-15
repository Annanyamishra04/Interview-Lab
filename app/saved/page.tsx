import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { Surface } from "@/components/ui/surface";
import { Tag } from "@/components/ui/tag";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { listSavedQuestionsWithContext } from "@/services/saved-questions";
import { RemoveSavedQuestionButton } from "@/features/saved/remove-saved-question-button";

export default async function SavedQuestionsPage() {
  const saved = await listSavedQuestionsWithContext();

  return (
    <AppShell>
      <h1 className="font-display text-display-md text-ink">Saved questions</h1>
      <p className="mt-2 max-w-prose text-body-sm text-ink-soft">
        A running library of questions worth revisiting — bookmarked from any session.
      </p>

      {saved.length === 0 ? (
        <Surface inset="lg" className="mt-8 max-w-prose">
          <p className="text-body-sm text-ink">No saved questions yet.</p>
          <p className="mt-1.5 text-body-sm text-ink-soft">
            Bookmark a question during a session and it&apos;ll show up here.
          </p>
        </Surface>
      ) : (
        <ol className="mt-8 space-y-5">
          {saved.map((item) => (
            <li key={item.id}>
              <Surface inset="lg">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex flex-wrap items-center gap-2">
                    {item.question?.topic && <Tag tone="brass">{item.question.topic}</Tag>}
                    {item.question?.difficulty && (
                      <Tag tone="neutral" className="capitalize">
                        {item.question.difficulty}
                      </Tag>
                    )}
                    {item.interview && (
                      <Tag tone={item.interview.status === "completed" ? "teal" : "neutral"}>
                        {item.interview.targetRole}
                      </Tag>
                    )}
                  </div>
                  <RemoveSavedQuestionButton questionId={item.question_id} />
                </div>

                {item.question ? (
                  <p className="mt-3 font-display text-display-sm italic text-ink">
                    {item.question.questionText}
                  </p>
                ) : (
                  <p className="mt-3 text-body-sm text-ink-muted">
                    This question is no longer available.
                  </p>
                )}

                {item.note && <p className="mt-3 text-body-sm text-ink-soft">{item.note}</p>}

                <div className="mt-4 flex items-center justify-between">
                  <p className="text-meta text-ink-muted">
                    Saved {new Date(item.created_at).toLocaleDateString()}
                  </p>
                  {item.interview && (
                    <Link
                      href={`/interview/${item.interview.id}`}
                      className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                    >
                      View interview
                    </Link>
                  )}
                </div>
              </Surface>
            </li>
          ))}
        </ol>
      )}
    </AppShell>
  );
}
