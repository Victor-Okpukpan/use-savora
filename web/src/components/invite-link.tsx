"use client";

import { useState } from "react";

import { shortAddress } from "@/lib/savora/format";

export function InviteLink({ groupAddress }: { groupAddress: string }) {
  const [copied, setCopied] = useState(false);
  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}/g/${groupAddress}`
      : `/g/${groupAddress}`;

  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      }}
      className="flex items-center justify-between rounded-control border border-line bg-surface-sunk px-3 py-2.5 text-left transition-colors hover:border-line-strong"
    >
      <span className="addr truncate text-[13px] text-ink-muted">
        /g/{shortAddress(groupAddress, 6, 6)}
      </span>
      <span className="ml-3 shrink-0 text-[12px] font-medium text-accent">
        {copied ? "Copied" : "Copy invite link"}
      </span>
    </button>
  );
}
