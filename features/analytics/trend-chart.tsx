import type { TrendPoint } from "@/services/analytics";

/**
 * Hand-rolled SVG line chart rather than a charting library — the
 * dataset here is always small (one point per completed interview) and
 * a bespoke chart keeps the editorial visual identity (hairline strokes,
 * the brass accent, no gridlines/shadows) instead of a generic chart
 * library's default look. `viewBox` + `width="100%"` is what keeps this
 * legible on a phone screen without a separate mobile layout.
 */
export function TrendChart({ trend }: { trend: TrendPoint[] }) {
  const points = trend.filter((t): t is TrendPoint & { score: number } => t.score !== null);
  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];
  if (points.length < 2 || !firstPoint || !lastPoint) return null;

  const width = 640;
  const height = 180;
  const padX = 28;
  const padY = 24;
  const innerWidth = width - padX * 2;
  const innerHeight = height - padY * 2;

  const xFor = (i: number) => padX + (points.length === 1 ? innerWidth / 2 : (i / (points.length - 1)) * innerWidth);
  const yFor = (score: number) => padY + innerHeight - (score / 10) * innerHeight;

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${xFor(i).toFixed(1)},${yFor(p.score).toFixed(1)}`).join(" ");

  const firstDate = new Date(firstPoint.date).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const lastDate = new Date(lastPoint.date).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Overall score trend across ${points.length} completed interviews, from ${firstPoint.score} to ${lastPoint.score} out of 10`}
      >
        {/* Baseline only — no gridlines, consistent with the hairline-border,
            no-shadow surface language used everywhere else. */}
        <line
          x1={padX}
          y1={padY + innerHeight}
          x2={padX + innerWidth}
          y2={padY + innerHeight}
          stroke="#D9D6CB"
          strokeWidth={1}
        />

        <path d={linePath} fill="none" stroke="#C98A3E" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

        {points.map((p, i) => (
          <circle key={p.interviewId} cx={xFor(i)} cy={yFor(p.score)} r={3.5} fill="#C98A3E" />
        ))}
      </svg>
      <div className="mt-2 flex items-center justify-between text-meta text-ink-muted">
        <span>{firstDate}</span>
        <span>{lastDate}</span>
      </div>
    </div>
  );
}
