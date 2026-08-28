"use client";

import { useState } from "react";

import { shortAddress } from "@/lib/savora/format";
import { addressMark, setNickname, useNickname } from "@/lib/savora/identity";

/**
 * A wallet, shown as a person: a deterministic mark derived from the address,
 * plus a label — the viewer's own nickname if set, otherwise the truncated
 * address. `label` overrides both (used by the demo fixtures).
 */
export function MemberMark({
  address,
  size = 22,
}: {
  address: string;
  size?: number;
}) {
  const { hue, rotation, sweep } = addressMark(address);
  const r = size / 2;
  const rr = r - 0.5;
  const disc = `oklch(0.6 0.11 ${hue} / 0.2)`;
  const wedge = `oklch(0.52 0.14 ${hue})`;

  // filled pie wedge from 0 to `sweep` degrees, before rotation.
  // Round every coordinate — raw trig differs in the last float digit between
  // Node and the browser, which would trip a hydration mismatch.
  const q = (n: number) => Math.round(n * 1000) / 1000;
  const a0 = -Math.PI / 2;
  const a1 = a0 + (sweep * Math.PI) / 180;
  const x0 = q(r + rr * Math.cos(a0));
  const y0 = q(r + rr * Math.sin(a0));
  const x1 = q(r + rr * Math.cos(a1));
  const y1 = q(r + rr * Math.sin(a1));
  const large = sweep > 180 ? 1 : 0;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="shrink-0"
      aria-hidden
    >
      <circle cx={r} cy={r} r={rr} fill={disc} />
      <path
        d={`M ${r} ${r} L ${x0} ${y0} A ${rr} ${rr} 0 ${large} 1 ${x1} ${y1} Z`}
        fill={wedge}
        transform={`rotate(${rotation} ${r} ${r})`}
      />
    </svg>
  );
}

export function MemberIdentity({
  address,
  you = false,
  label,
  editable = false,
  size = 20,
  className = "",
}: {
  address: string;
  you?: boolean;
  label?: string;
  editable?: boolean;
  size?: number;
  className?: string;
}) {
  const storedNick = useNickname(address);
  const nick = label ? null : storedNick;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const shown = label ?? nick ?? shortAddress(address);

  function commit() {
    setNickname(address, draft);
    setEditing(false);
  }

  return (
    <span className={`inline-flex min-w-0 items-center gap-2 ${className}`}>
      <MemberMark address={address} size={size} />
      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") setEditing(false);
          }}
          placeholder="nickname"
          maxLength={24}
          className="h-6 w-28 rounded-[6px] border border-line bg-surface px-1.5 text-[13px] outline-none"
        />
      ) : (
        <button
          type={editable ? "button" : undefined}
          disabled={!editable}
          onClick={() => {
            if (!editable) return;
            setDraft(nick ?? "");
            setEditing(true);
          }}
          className={`min-w-0 truncate text-left ${nick || label ? "text-[13px] text-ink" : "addr text-[13px] text-ink"} ${editable ? "hover:text-accent" : ""}`}
          title={editable ? "Set a nickname (saved on this device)" : address}
        >
          {shown}
        </button>
      )}
      {you ? (
        <span className="shrink-0 text-[11px] text-ink-faint">you</span>
      ) : null}
    </span>
  );
}
