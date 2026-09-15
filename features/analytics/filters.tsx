import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AnalyticsFilterOptions, AnalyticsFilters } from "@/services/analytics";

const TYPE_LABEL: Record<string, string> = {
  technical: "Technical",
  behavioral: "Behavioral",
  situational: "Situational",
  mixed: "Mixed",
};

const PERIOD_OPTIONS = [
  { value: "", label: "All time" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "365", label: "Last year" },
];

const selectClass =
  "h-11 rounded border border-line-strong bg-stone-panel px-3 text-body-sm text-ink transition-colors focus-visible:border-brass";

/**
 * A plain GET form — no client component needed. Submitting re-requests
 * `/analytics` with query params, which the page reads server-side and
 * passes straight into `getAnalyticsData`, so every number on the page
 * (trend, topics, difficulty, history, strongest/weakest, coach context)
 * updates together from one consistent query, never partially.
 */
export function AnalyticsFiltersForm({
  options,
  applied,
}: {
  options: AnalyticsFilterOptions;
  applied: AnalyticsFilters;
}) {
  if (options.roles.length <= 1 && options.interviewTypes.length <= 1) {
    // Not enough variety yet for filters to be useful — nothing to
    // narrow down, so don't clutter the page with a form that only
    // ever has one meaningful choice.
    return null;
  }

  const hasActiveFilters = Boolean(applied.role || applied.interviewType || applied.periodDays);

  return (
    <form method="get" className="mt-6 flex flex-wrap items-end gap-3">
      {options.roles.length > 1 && (
        <label className="flex flex-col gap-1.5">
          <span className="text-meta text-ink-muted">Role</span>
          <select name="role" defaultValue={applied.role ?? ""} className={selectClass}>
            <option value="">All roles</option>
            {options.roles.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </label>
      )}

      {options.interviewTypes.length > 1 && (
        <label className="flex flex-col gap-1.5">
          <span className="text-meta text-ink-muted">Interview type</span>
          <select name="type" defaultValue={applied.interviewType ?? ""} className={selectClass}>
            <option value="">All types</option>
            {options.interviewTypes.map((type) => (
              <option key={type} value={type}>
                {TYPE_LABEL[type] ?? type}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="flex flex-col gap-1.5">
        <span className="text-meta text-ink-muted">Time period</span>
        <select name="period" defaultValue={applied.periodDays ? String(applied.periodDays) : ""} className={selectClass}>
          {PERIOD_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>

      <button type="submit" className={cn(buttonVariants({ variant: "outline", size: "md" }))}>
        Apply
      </button>

      {hasActiveFilters && (
        <a href="/analytics" className="text-meta text-ink-muted hover:text-ink">
          Clear filters
        </a>
      )}
    </form>
  );
}
