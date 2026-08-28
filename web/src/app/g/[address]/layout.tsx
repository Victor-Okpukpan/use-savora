import type { Metadata } from "next";

import { getCircleMeta } from "./_meta";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ address: string }>;
}): Promise<Metadata> {
  const { address } = await params;
  const circle = await getCircleMeta(address);

  if (!circle) {
    return { title: "Circle", robots: { index: false, follow: false } };
  }

  // Kept short — details are on the OG card; names cap at 32 bytes onchain.
  const description = `${circle.name} — ${circle.contribution} USDC per round, ${circle.seats} seats. A non-custodial ajo circle on Savora.`;

  return {
    title: circle.name,
    description,
    robots: { index: false, follow: false },
    alternates: { canonical: `/g/${address}` },
    openGraph: {
      title: `${circle.name} · Savora`,
      description,
      url: `/g/${address}`,
    },
    twitter: { card: "summary_large_image", title: `${circle.name} · Savora`, description },
  };
}

export default function GroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
