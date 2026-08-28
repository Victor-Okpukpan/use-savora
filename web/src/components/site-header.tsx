import Link from "next/link";

import { ConnectButton } from "./connect-button";
import { Wordmark } from "./wordmark";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-bg/85 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-5">
        <Link href="/" className="flex items-center gap-2.5">
          <Wordmark />
        </Link>
        <nav className="flex items-center gap-1.5">
          <Link
            href="/app"
            className="hidden h-9 items-center rounded-control px-3 text-[13px] text-ink-muted transition-colors hover:text-ink sm:inline-flex"
          >
            Circles
          </Link>
          <ConnectButton />
        </nav>
      </div>
    </header>
  );
}
