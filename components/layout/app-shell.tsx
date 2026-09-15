import Link from "next/link";
import { logoutAction } from "@/features/auth/actions";
import { NavLinks } from "@/components/layout/nav-links";

/**
 * Deliberately a top studio bar rather than a left sidebar: the product's
 * working surface (a question, an answer, a resume) is naturally tall and
 * narrow, so a persistent left rail would fight it for width on laptop
 * screens where this product is mostly used.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-stone">
      <header className="border-b border-line bg-stone-panel">
        <div className="mx-auto flex h-16 max-w-studio items-center justify-between gap-6 px-6">
          <Link
            href="/dashboard"
            className="shrink-0 font-display text-display-sm text-ink"
          >
            InterviewLab
          </Link>
          <nav className="flex min-w-0 items-center gap-6 overflow-x-auto text-body-sm text-ink-soft [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <NavLinks />
            <form action={logoutAction} className="shrink-0">
              <button type="submit" className="transition-colors hover:text-ink">
                Log out
              </button>
            </form>
          </nav>
        </div>
      </header>
      <div className="mx-auto max-w-studio px-6 py-12">{children}</div>
    </div>
  );
}
