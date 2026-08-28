import type { Metadata } from "next";
import Link from "next/link";

import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "Not found",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-reading flex-1 flex-col justify-center px-6 py-20 sm:px-8">
        <p className="micro">404</p>
        <h1 className="display-3 mt-4 text-ink">This link goes nowhere.</h1>
        <p className="mt-4 max-w-[46ch] text-[15px] leading-[1.6] text-ink-muted">
          The page moved, the invite link is wrong, or the circle it pointed to
          was never on-chain. Nothing here.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link
            href="/"
            className="inline-flex h-11 items-center rounded-pill bg-accent px-5 text-[14px] font-medium text-accent-contrast transition-opacity hover:opacity-90"
          >
            Back to home
          </Link>
          <Link
            href="/docs"
            className="inline-flex h-11 items-center rounded-pill border border-line-strong px-5 text-[14px] font-medium text-ink transition-colors hover:bg-surface-sunk"
          >
            Read the docs
          </Link>
        </div>
      </main>
    </div>
  );
}
