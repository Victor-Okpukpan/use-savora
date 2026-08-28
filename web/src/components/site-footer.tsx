import Link from "next/link";

import { PROGRAM_ID, explorerUrl } from "@/lib/savora/config";
import { shortAddress } from "@/lib/savora/format";

const COLUMNS: { heading: string; links: { label: string; href: string }[] }[] = [
  {
    heading: "Product",
    links: [
      { label: "Your circles", href: "/app" },
      { label: "Start a circle", href: "/app/new" },
    ],
  },
  {
    heading: "How it works",
    links: [
      { label: "Using Savora", href: "/docs#using" },
      { label: "Under the hood", href: "/docs#hood" },
    ],
  },
  {
    heading: "Chain",
    links: [
      {
        label: "Program",
        href: explorerUrl(PROGRAM_ID),
      },
      { label: "Devnet USDC", href: "https://faucet.circle.com" },
    ],
  },
  {
    heading: "Connect",
    links: [
      { label: "Privy", href: "https://privy.io" },
      { label: "Solana", href: "https://solana.com" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto w-full max-w-site px-6 py-14 sm:px-8 lg:px-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr]">
          <div>
            <span className="font-serif text-[19px] text-ink">Savora</span>
            <p className="mt-2 max-w-[28ch] text-[12px] leading-[1.6] text-ink-muted">
              Non-custodial rotating savings. The pool sits in a contract on
              Solana — nobody holds the money.
            </p>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.heading}>
              <h3 className="micro">{col.heading}</h3>
              <ul className="mt-3 flex flex-col gap-2">
                {col.links.map((link) => (
                  <li key={link.label}>
                    {link.href.startsWith("http") ? (
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[13px] text-ink-muted transition-colors hover:text-ink"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link
                        href={link.href}
                        className="text-[13px] text-ink-muted transition-colors hover:text-ink"
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-6 text-[12px] text-ink-faint">
          <span>Savora · non-custodial · Solana devnet</span>
          <span className="addr">{shortAddress(PROGRAM_ID, 6, 6)}</span>
        </div>
      </div>
    </footer>
  );
}
