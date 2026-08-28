"use client";

import { usePrivy } from "@privy-io/react-auth";
import { motion } from "motion/react";

import { usePrivyConfigured } from "@/app/providers";
import { useConnection } from "@/lib/savora/use-savora";
import { DEMO } from "@/lib/savora/demo";
import { shortAddress } from "@/lib/savora/format";
import { press } from "@/lib/motion";

/*
  The only component written for the connection flow. Everything else — the
  modal, the wallet list, email/social login, the embedded-wallet prompt — is
  Privy's own prebuilt UI, themed through provider config and CSS variables.
*/
export function ConnectButton({
  shape = "default",
  size = "md",
  label = "Connect",
}: {
  shape?: "default" | "pill";
  size?: "md" | "lg";
  /** Text shown when signed out. */
  label?: string;
}) {
  const configured = usePrivyConfigured();

  const radius = shape === "pill" ? "rounded-pill" : "rounded-control";
  const dims =
    size === "lg" ? "h-11 px-5 text-[14px]" : "h-9 px-3.5 text-[13px]";
  const base = `inline-flex items-center justify-center gap-2 font-medium transition-opacity disabled:opacity-40 ${radius} ${dims}`;

  if (!configured) {
    return (
      <button
        disabled
        title="Set NEXT_PUBLIC_PRIVY_APP_ID to enable sign-in"
        className={`${base} border border-line bg-surface text-ink-faint`}
      >
        {label}
      </button>
    );
  }

  return <ConnectButtonLive base={base} label={label} />;
}

function ConnectButtonLive({ base, label }: { base: string; label: string }) {
  const { login, logout, authenticated, ready } = usePrivy();
  const { address } = useConnection();

  // Demo mode has no session to sign out of. Render it visibly disabled rather
  // than as something that mimics a signed-in button and does nothing.
  if (DEMO) {
    return (
      <button
        disabled
        title="Demo mode — sign-in disabled"
        className={`${base} border border-dashed border-line bg-surface text-ink-faint`}
      >
        Demo
      </button>
    );
  }

  if (!ready) {
    return <span className={`${base} bg-surface-sunk`} aria-hidden />;
  }

  // Authenticated is the only condition that matters for signing out. The
  // Solana wallet can lag behind it (the embedded wallet is created just after
  // login), and gating on the wallet here used to strand the user on a
  // "Connect" button whose login() is a no-op once already signed in.
  if (authenticated) {
    return (
      <motion.button
        {...press}
        onClick={() => logout()}
        className={`${base} border border-line bg-surface text-ink hover:bg-surface-sunk`}
        title="Sign out"
      >
        <span
          className={`size-1.5 rounded-full ${address ? "bg-accent" : "bg-line-strong"}`}
        />
        <span className="addr">
          {address ? shortAddress(address) : "Signing in…"}
        </span>
      </motion.button>
    );
  }

  return (
    <motion.button
      {...press}
      onClick={() => login()}
      className={`${base} bg-accent text-accent-contrast hover:bg-accent-hover`}
    >
      {label}
    </motion.button>
  );
}
