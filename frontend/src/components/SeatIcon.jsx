// A simple seat/chair silhouette - Heroicons has no seat icon, so this is
// a small custom SVG matching their sizing conventions (24x24 viewBox,
// drop-in via className, currentColor). `solid` toggles filled vs outline,
// used as the primary (non-colour) way to tell an occupied seat from an
// empty one - CLAUDE.md: never colour alone.
export default function SeatIcon({ solid = false, className = "w-4 h-4" }) {
  const shapeProps = solid
    ? { fill: "currentColor" }
    : { fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinejoin: "round" };
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...shapeProps}>
      <rect x="8" y="2" width="8" height="4" rx="2" />
      <path d="M7 7h10a2 2 0 0 1 2 2v7H5V9a2 2 0 0 1 2-2z" />
      <rect x="4" y="17" width="16" height="5" rx="2" />
    </svg>
  );
}
