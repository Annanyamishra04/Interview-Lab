"use client";

import * as React from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#studio", label: "Inside the studio" },
  { href: "#resume", label: "Resume practice" },
] as const;

/**
 * A single hairline-bordered bar, not a floating pill or a blurred glass
 * strip — the nav should read as part of the page's structure, the same
 * way a masthead sits at the top of a printed page.
 */
export function MarketingNav() {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-stone/95 backdrop-blur-sm">
      <div className="mx-auto flex h-18 max-w-studio items-center justify-between px-6">
        <Link href="/" className="font-display text-display-sm text-ink">
          InterviewLab
        </Link>

        <nav className="hidden items-center gap-9 text-body-sm text-ink-soft md:flex">
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="group relative py-1">
              {link.label}
              <span className="absolute inset-x-0 -bottom-0.5 h-px origin-left scale-x-0 bg-brass transition-transform duration-200 group-hover:scale-x-100" />
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Link href="/auth/login" className="text-body-sm text-ink-soft hover:text-ink">
            Log in
          </Link>
          <Link href="/auth/sign-up" className={buttonVariants({ variant: "accent", size: "sm" })}>
            Start practicing
          </Link>
        </div>

        <button
          type="button"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="-mr-2 flex h-10 w-10 items-center justify-center text-ink md:hidden"
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      <div
        className={cn(
          "grid overflow-hidden border-t border-line transition-[grid-template-rows] duration-200 ease-out md:hidden",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
      >
        <div className="min-h-0">
          <nav className="flex flex-col gap-1 px-6 py-4 text-body-sm">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="border-b border-line py-3 text-ink-soft last:border-b-0"
              >
                {link.label}
              </Link>
            ))}
            <div className="mt-4 flex flex-col gap-3">
              <Link
                href="/auth/login"
                onClick={() => setOpen(false)}
                className={buttonVariants({ variant: "outline", size: "md" })}
              >
                Log in
              </Link>
              <Link
                href="/auth/sign-up"
                onClick={() => setOpen(false)}
                className={buttonVariants({ variant: "accent", size: "md" })}
              >
                Start practicing
              </Link>
            </div>
          </nav>
        </div>
      </div>
    </header>
  );
}
