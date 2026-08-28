/**
 * Single source of truth for the Savora mark and the values the social cards
 * and icons render. Change the mark or the palette here and the favicon, the
 * Apple icon, and every OG image follow.
 */

export const BRAND = {
  name: "Savora",
  tagline: "Your savings circle, without someone holding the money.",
  shortTagline: "Rotating savings, onchain.",
  footer: "Non-custodial · Solana",
  /* OG cards render on the warm-paper light palette regardless of theme. */
  paper: "#f7f4ec",
  ink: "#191712",
  inkMuted: "#605b51",
  accent: "#1f5741",
  line: "#e7e1d3",
} as const;

/**
 * The ring + dot. Plain inline SVG so it renders identically in the DOM and in
 * satori (@vercel/og). DOM callers pass a CSS variable for `color` so it stays
 * theme-reactive; icon/OG callers pass a literal hex.
 */
export function SavoraMark({
  size = 32,
  color = BRAND.accent,
  strokeWidth = 2.6,
}: {
  size?: number;
  color?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle cx="16" cy="16" r="12.9" stroke={color} strokeWidth={strokeWidth} />
      <circle cx="16" cy="3.1" r="3.1" fill={color} />
    </svg>
  );
}
