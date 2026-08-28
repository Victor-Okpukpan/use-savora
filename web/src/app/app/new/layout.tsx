import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "New circle",
  robots: { index: false, follow: false },
};

export default function NewCircleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
