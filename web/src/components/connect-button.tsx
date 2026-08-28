"use client";

import { usePrivy } from "@privy-io/react-auth";
import { motion } from "motion/react";

import { usePrivyConfigured } from "@/app/providers";
import { useConnection } from "@/lib/savora/use-savora";
import { DEMO } from "@/lib/savora/demo";
import { shortAddress } from "@/lib/savora/format";
import { press } from "@/lib/motion";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-control text-[13px] font-medium transition-opacity disabled:opacity-40";

/*
  The only component written for the connection flow. Everything else — the
  modal, the wallet list, email/social login, the embedded-wallet prompt — is
  Privy's own prebuilt UI, themed through provider config and CSS variables.
*/
export function ConnectButton({ full = false }: { full?: boolean }) {
  const configured = usePrivyConfigured();
  const size = full ? "h-11 w-full px-4" : "h-9 px-3.5";

  if (!configured) {
    return (
      <button
        disabled
        title="Set NEXT_PUBLIC_PRIVY_APP_ID to enable sign-in"
        className={`${BASE} ${size} border border-line bg-surface text-ink-faint`}
      >
        Connect
      </button>
    );
  }

  return <ConnectButtonLive size={size} />;
}

function ConnectButtonLive({ size }: { size: string }) {
  const { login, logout, authenticated, ready } = usePrivy();
  const { address } = useConnection();

  if (DEMO) {
    return (
      <span
        className={`${BASE} ${size} border border-line bg-surface text-ink`}
        title="Demo mode"
      >
        <span className="size-1.5 rounded-full bg-accent" />
        <span className="addr">{shortAddress(address ?? "")}</span>
      </span>
    );
  }

  if (!ready) {
    return <div className={`${size} rounded-control bg-surface-sunk`} aria-hidden />;
  }

  if (authenticated && address) {
    return (
      <motion.button
        {...press}
        onClick={() => logout()}
        className={`${BASE} ${size} border border-line bg-surface text-ink hover:bg-surface-sunk`}
        title="Sign out"
      >
        <span className="size-1.5 rounded-full bg-accent" />
        <span className="addr">{shortAddress(address)}</span>
      </motion.button>
    );
  }

  return (
    <motion.button
      {...press}
      onClick={() => login()}
      className={`${BASE} ${size} bg-accent text-accent-contrast hover:bg-accent-hover`}
    >
      Connect
    </motion.button>
  );
}
