import Link from "next/link";
import { SetupWizard } from "@/features/onboarding/setup-form";

export default function OnboardingPage() {
  return (
    <main className="min-h-screen bg-stone">
      <header className="border-b border-line">
        <div className="mx-auto flex h-16 max-w-studio items-center justify-between px-6">
          <Link href="/" className="font-display text-display-sm text-ink">
            InterviewLab
          </Link>
          <Link href="/dashboard" className="text-body-sm text-ink-muted hover:text-ink">
            Cancel
          </Link>
        </div>
      </header>
      <div className="mx-auto max-w-studio px-6 py-14 lg:py-18">
        <SetupWizard />
      </div>
    </main>
  );
}
