import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export function ClosingCta() {
  return (
    <section className="border-t border-line">
      <div className="mx-auto flex max-w-studio flex-col items-start gap-8 px-6 py-24 lg:flex-row lg:items-center lg:justify-between lg:py-28">
        <h2 className="max-w-prose font-display text-display-lg text-ink">
          Walk into your next interview prepared.
        </h2>
        <Link href="/auth/sign-up" className={buttonVariants({ variant: "accent", size: "lg" })}>
          Start practicing
        </Link>
      </div>
    </section>
  );
}

export function MarketingFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-studio flex-col gap-4 px-6 py-10 text-meta text-ink-muted sm:flex-row sm:items-center sm:justify-between">
        <span className="font-display text-body-sm text-ink">InterviewLab</span>
        <span>Built for practice, not proctoring.</span>
      </div>
    </footer>
  );
}
