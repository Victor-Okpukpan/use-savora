"use client";

import { createContext, useContext, useState } from "react";

import { PrivyProvider } from "@privy-io/react-auth";
import { toSolanaWalletConnectors } from "@privy-io/react-auth/solana";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "motion/react";

import { rpc, rpcSubscriptions } from "@/lib/savora/rpc";
import { SOLANA_CHAIN } from "@/lib/savora/config";

const PrivyConfiguredContext = createContext(false);

/** True when a Privy app id is set and the connection flow is live. */
export function usePrivyConfigured() {
  return useContext(PrivyConfiguredContext);
}

const APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID?.trim();
const CONFIGURED = !!APP_ID && APP_ID !== "insert-your-privy-app-id";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 10_000, retry: 1, refetchOnWindowFocus: false },
        },
      }),
  );

  const inner = (
    <QueryClientProvider client={queryClient}>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </QueryClientProvider>
  );

  if (!CONFIGURED) {
    // No Privy app id: Privy-dependent pages show a short setup note. Demo mode
    // also needs an app id (it still mounts PrivyProvider, just with fixtures).
    return (
      <PrivyConfiguredContext.Provider value={false}>
        {inner}
      </PrivyConfiguredContext.Provider>
    );
  }

  return (
    <PrivyConfiguredContext.Provider value={true}>
      <PrivyProvider
        appId={APP_ID as string}
        config={{
          loginMethods: ["email", "google", "wallet"],
          appearance: {
            theme: "#fbfaf7",
            accentColor: "#1f4d3d",
            walletChainType: "solana-only",
            showWalletLoginFirst: false,
            landingHeader: "Join your circle",
            loginMessage: "Sign in to contribute and collect on Savora.",
            logo: "/savora-mark.svg",
          },
          embeddedWallets: {
            solana: { createOnLogin: "users-without-wallets" },
          },
          externalWallets: {
            solana: { connectors: toSolanaWalletConnectors() },
          },
          solana: {
            rpcs: {
              [SOLANA_CHAIN]: { rpc, rpcSubscriptions },
            },
          },
        }}
      >
        {inner}
      </PrivyProvider>
    </PrivyConfiguredContext.Provider>
  );
}
