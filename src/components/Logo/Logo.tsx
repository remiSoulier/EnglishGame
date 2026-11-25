export interface LogoProps {
  /** Rendered width and height in px. */
  size?: number;
  className?: string;
}

/** Positions of the inner lines of the 3×3 grid (cells are 20 units wide, from 2 to 62). */
const LINES = [22, 42];

// Colours mirror src/styles/tokens.css (SILVA: forest board, lime wall, yellow goal, lavender
// start, light board border).

/** Decorative app logo: a 3×3 grid with a star (the goal) and a wall. Hidden from screen readers. */
export function Logo({ size = 96, className }: LogoProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="2" y="2" width="60" height="60" rx="8" fill="#1f5c4f" />
      {/* Inner cell lines. */}
      {LINES.map((at) => (
        <g key={at} stroke="#3d7a69" strokeWidth="1">
          <line x1={at} y1="2" x2={at} y2="62" />
          <line x1="2" y1={at} x2="62" y2={at} />
        </g>
      ))}
      {/* Wall between the middle and the right column. */}
      <rect x="40" y="20" width="4" height="24" rx="1.5" fill="#d9f26b" />
      {/* Goal star in the top-right cell. */}
      <path
        d="M52 15.5l2.35 4.76 5.25.76-3.8 3.7.9 5.23L52 27.48l-4.7 2.47.9-5.23-3.8-3.7 5.25-.76z"
        transform="translate(0 -9)"
        fill="#f5c84c"
      />
      {/* Start dot in the bottom-left cell. */}
      <circle cx="12" cy="52" r="5" fill="#c9b8f0" />
      {/* Outer border, drawn last so it covers the cell lines at the rounded corners. */}
      <rect
        x="2"
        y="2"
        width="60"
        height="60"
        rx="8"
        fill="none"
        stroke="#8cc4ad"
        strokeWidth="2"
      />
    </svg>
  );
}
