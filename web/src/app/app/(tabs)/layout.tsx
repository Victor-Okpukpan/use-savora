import type { Metadata } from "next";
import Link from "next/link";

import { RequirePrivy } from "@/components/require-privy";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui";
import { TabNav } from "./tab-nav";

export const metadata: Metadata = {
  title: "Dashboard",
  robots: { index: false, follow: false },
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader wide={false} />
      <main className="mx-auto w-full max-w-reading flex-1 px-6 py-10 sm:px-8">
        <div className="flex items-center justify-between gap-4 border-b border-line">
          <TabNav />
          <Link href="/app/new" className="mb-2.5 shrink-0">
            <Button variant="secondary">New circle</Button>
          </Link>
        </div>
        <div className="pt-8">
          <RequirePrivy>{children}</RequirePrivy>
        </div>
      </main>
    </div>
  );
}
