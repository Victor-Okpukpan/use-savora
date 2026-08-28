import { OG_CONTENT_TYPE, OG_SIZE, brandCard, circleCard } from "@/lib/og";

import { getCircleMeta } from "./_meta";

export const alt = "A Savora circle";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const revalidate = 300;

export default async function Image({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = await params;
  const circle = await getCircleMeta(address);
  if (!circle) return brandCard();
  return circleCard({
    name: circle.name,
    contribution: circle.contribution,
    seats: circle.seats,
    state: circle.state,
  });
}
