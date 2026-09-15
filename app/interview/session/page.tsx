import { AppShell } from "@/components/layout/app-shell";
import { InterviewWorkspace } from "@/features/interview/workspace";

export default function InterviewSessionPage({
  searchParams,
}: {
  searchParams: { interviewId?: string };
}) {
  return (
    <AppShell>
      <InterviewWorkspace interviewId={searchParams.interviewId ?? null} />
    </AppShell>
  );
}
