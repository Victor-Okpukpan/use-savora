"use client";

import { useEffect } from "react";
import Link from "next/link";

import { SiteHeader } from "@/components/site-header";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-reading flex-1 flex-col justify-center px-6 py-20 sm:px-8">
        <p className="micro">Error</p>
        <h1 className="display-3 mt-4 text-ink">Something broke.</h1>
        <p className="mt-4 max-w-[46ch] text-[15px] leading-[1.6] text-ink-muted">
          That&rsquo;s on us. Your wallet and your circles are untouched — the
          data lives onchain, not here.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <button
            onClick={reset}
            className="inline-flex h-11 items-center rounded-pill bg-accent px-5 text-[14px] font-medium text-accent-contrast transition-opacity hover:opacity-90"
          >
            Try again
          </button>
          <Link
            href="/"
            className="inline-flex h-11 items-center rounded-pill border border-line-strong px-5 text-[14px] font-medium text-ink transition-colors hover:bg-surface-sunk"
          >
            Back to home
          </Link>
        </div>
      </main>
    </div>
  );
}
