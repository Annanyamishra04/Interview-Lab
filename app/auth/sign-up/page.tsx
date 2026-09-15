import Link from "next/link";
import { SignUpForm } from "@/features/auth/sign-up-form";

export default function SignUpPage() {
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between border-r border-line bg-ink px-14 py-12 text-stone lg:flex">
        <Link href="/" className="font-display text-display-sm text-stone">
          InterviewLab
        </Link>
        <div className="max-w-sm">
          <p className="font-mono text-data uppercase tracking-[0.16em] text-brass-tint">
            Start rehearsing
          </p>
          <p className="mt-4 font-display text-display-md italic text-stone">
            Prepare for the interview you actually want.
          </p>
        </div>
        <p className="max-w-sm text-body-sm text-stone/50">
          Set a role once, and InterviewLab builds a full practice session
          around it.
        </p>
      </div>

      <div className="flex flex-col justify-center px-6 py-16 sm:px-12 lg:px-20">
        <Link href="/" className="font-display text-display-sm text-ink lg:hidden">
          InterviewLab
        </Link>
        <div className="mx-auto w-full max-w-sm">
          <h1 className="mt-8 font-display text-display-md text-ink lg:mt-0">
            Create your account
          </h1>
          <p className="mt-2 text-body-sm text-ink-soft">
            Your sessions and answers stay private to your account.
          </p>
          <SignUpForm />
          <p className="mt-6 text-body-sm text-ink-muted">
            Already have an account?{" "}
            <Link href="/auth/login" className="text-ink underline underline-offset-4">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
