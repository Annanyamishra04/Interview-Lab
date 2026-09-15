import { notFound, redirect } from "next/navigation";
import { getInterviewById } from "@/services/interviews";

/**
 * Reopening an interview from history or the dashboard lands here first
 * so ownership is checked server-side (via RLS through
 * `getInterviewById`) before anything renders. The workspace at
 * /interview/session already knows how to render a completed interview's
 * results or resume an in-progress one from the same persisted state, so
 * this route hands off to it rather than duplicating that rendering.
 */
export default async function InterviewDetailPage({ params }: { params: { id: string } }) {
  const interview = await getInterviewById(params.id);
  if (!interview) notFound();

  redirect(`/interview/session?interviewId=${interview.id}`);
}
