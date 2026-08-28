"use client";

import { usePrivyConfigured } from "@/app/providers";
import { Card } from "./ui";

/**
 * Gates any subtree that calls Privy hooks. When no Privy app id is set, the
 * children never mount (so the hooks are never called) and a short setup note
 * is shown instead.
 */
export function RequirePrivy({ children }: { children: React.ReactNode }) {
  const configured = usePrivyConfigured();
  if (configured) return <>{children}</>;
  return (
    <Card className="p-8 text-center">
      <h2 className="text-[15px] font-medium text-ink">Connect isn&rsquo;t set up yet</h2>
      <p className="mx-auto mt-2 max-w-md text-[13px] leading-[1.6] text-ink-muted">
        Add a Privy app id to <code className="addr">web/.env.local</code> as{" "}
        <code className="addr">NEXT_PUBLIC_PRIVY_APP_ID</code> and restart. Create
        one free at{" "}
        <a
          className="text-accent underline-offset-2 hover:underline"
          href="https://dashboard.privy.io"
          target="_blank"
          rel="noreferrer"
        >
          dashboard.privy.io
        </a>
        .
      </p>
    </Card>
  );
}
