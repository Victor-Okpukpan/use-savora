import { ConnectButton } from "./connect-button";
import { SiteHeader } from "./site-header";

export function Shell({
  children,
  width = "max-w-3xl",
}: {
  children: React.ReactNode;
  width?: string;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className={`mx-auto w-full flex-1 px-5 py-10 ${width}`}>
        {children}
      </main>
    </div>
  );
}

export function ConnectGate() {
  return (
    <div className="rounded-card border border-line bg-surface p-8 text-center">
      <h2 className="text-[15px] font-medium text-ink">Connect to continue</h2>
      <p className="mx-auto mt-2 max-w-sm text-[13px] leading-[1.6] text-ink-muted">
        Sign in with email, Google, or a Solana wallet to see your circles and
        contribute.
      </p>
      <div className="mt-5 flex justify-center">
        <ConnectButton />
      </div>
    </div>
  );
}
