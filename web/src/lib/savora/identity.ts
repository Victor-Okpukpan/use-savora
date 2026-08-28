/**
 * Per-wallet identity that needs no database: a deterministic mark derived from
 * the address, plus an optional nickname the viewer sets for themselves
 * (stored in this browser only). We never invent a personal name for a real
 * stranger's wallet — that would misrepresent them.
 */

/** FNV-1a over the address string → 32-bit unsigned. */
export function addressHash(address: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < address.length; i++) {
    h ^= address.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export type Mark = {
  /** Hue for the derived accent. */
  hue: number;
  /** Rotation of the wedge, degrees. */
  rotation: number;
  /** Sweep of the filled wedge, degrees (90–270). */
  sweep: number;
};

/**
 * A small "circle" glyph: a ring with one filled wedge, rotated. Legible at
 * 16px, and thematically a savings circle in miniature.
 */
export function addressMark(address: string): Mark {
  const h = addressHash(address);
  const hue = h % 360;
  const rotation = (h >> 9) % 360;
  const sweep = 120 + ((h >> 17) % 131); // 120–250°, always a clear wedge
  return { hue, rotation, sweep };
}

import { useSyncExternalStore } from "react";

const NICK_PREFIX = "savora.nick.";
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

export function getNickname(address: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(NICK_PREFIX + address);
  } catch {
    return null;
  }
}

export function setNickname(address: string, nickname: string): void {
  if (typeof window === "undefined") return;
  try {
    const trimmed = nickname.trim().slice(0, 24);
    if (trimmed) window.localStorage.setItem(NICK_PREFIX + address, trimmed);
    else window.localStorage.removeItem(NICK_PREFIX + address);
    notify();
  } catch {
    /* private mode / disabled storage — nicknames are a convenience only */
  }
}

/** Read the viewer's nickname for an address, reactively. SSR-safe. */
export function useNickname(address: string): string | null {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      const onStorage = (e: StorageEvent) => {
        if (!e.key || e.key.startsWith(NICK_PREFIX)) onChange();
      };
      window.addEventListener("storage", onStorage);
      return () => {
        listeners.delete(onChange);
        window.removeEventListener("storage", onStorage);
      };
    },
    () => getNickname(address),
    () => null,
  );
}
