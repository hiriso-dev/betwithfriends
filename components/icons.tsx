// Shared inline icons, drawn in the same lucide-style stroke as the nav icons
// (24×24 viewBox, currentColor stroke). Color/size via `className` + `size`.

type IconProps = { size?: number; className?: string };

const base = (size: number, className: string) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  className,
});

/**
 * Two people — used on match scores/rows to mean "see the other players'
 * predictions for this match". Clearer (and friendlier) than an eye.
 */
export function UsersIcon({ size = 18, className = "" }: IconProps) {
  return (
    <svg {...base(size, className)} aria-hidden="true">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
