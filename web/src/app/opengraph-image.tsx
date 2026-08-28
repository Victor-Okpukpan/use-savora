import { BRAND } from "@/lib/brand";
import { OG_CONTENT_TYPE, OG_SIZE, brandCard } from "@/lib/og";

export const alt = `${BRAND.name} — ${BRAND.tagline}`;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return brandCard();
}
