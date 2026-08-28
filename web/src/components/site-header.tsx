import Link from "next/link";

import { ConnectButton } from "./connect-button";
import { Wordmark } from "./wordmark";

export function SiteHeader({ wide = true }: { wide?: boolean }) {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/80 backdrop-blur-md">
      <div
        className={`mx-auto flex h-16 items-center justify-between px-6 sm:px-8 ${
          wide ? "max-w-site lg:px-12" : "max-w-3xl"
        }`}
      >
        <Link href="/" className="flex items-center gap-2.5">
          <Wordmark />
        </Link>
        <nav className="flex items-center gap-1">
          <Link
            href="/app"
            className="hidden h-9 items-center rounded-control px-3 text-[13px] text-ink-muted transition-colors hover:text-ink sm:inline-flex"
          >
            Circles
          </Link>
          <Link
            href="/docs"
            className="hidden h-9 items-center rounded-control px-3 text-[13px] text-ink-muted transition-colors hover:text-ink sm:inline-flex"
          >
            Docs
          </Link>
          <span className="ml-2">
            <ConnectButton shape="pill" />
          </span>
        </nav>
      </div>
    </header>
  );
}
