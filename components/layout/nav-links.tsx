"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Sessions" },
  { href: "/history", label: "History" },
  { href: "/analytics", label: "Analytics" },
  { href: "/saved", label: "Saved" },
] as const;

export function NavLinks() {
  const pathname = usePathname();

  return (
    <>
      {NAV_ITEMS.map((item) => {
        const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "relative flex h-16 shrink-0 items-center whitespace-nowrap transition-colors hover:text-ink",
              isActive ? "text-ink" : "text-ink-soft"
            )}
          >
            {item.label}
            {isActive && <span className="absolute inset-x-0 bottom-0 h-px bg-brass" aria-hidden />}
          </Link>
        );
      })}
    </>
  );
}
