import { AppShell } from "@/components/layout/app-shell";
import { ResumeForm } from "@/features/resume/resume-form";

export default function ResumePage() {
  return (
    <AppShell>
      <div className="max-w-prose">
        <h1 className="font-display text-display-md text-ink">Build a session from a resume</h1>
        <p className="mt-2 text-body-sm text-ink-soft">
          Upload a PDF, DOCX, or TXT résumé and InterviewLab reads it, then builds a session
          tailored to your background and the role you&rsquo;re targeting.
        </p>
      </div>
      <ResumeForm />
    </AppShell>
  );
}
