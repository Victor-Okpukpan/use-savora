import type { ReadonlyUint8Array } from "@solana/kit";

import { NAME_LEN, USDC_DECIMALS } from "./config";

const enc = new TextEncoder();
const dec = new TextDecoder();

/** Circle name → fixed 32-byte field, right-padded with zeros. */
export function encodeName(name: string): Uint8Array {
  const out = new Uint8Array(NAME_LEN);
  const bytes = enc.encode(name);
  if (bytes.length > NAME_LEN) {
    throw new Error(`Name must be at most ${NAME_LEN} bytes`);
  }
  out.set(bytes);
  return out;
}

/** Fixed 32-byte name field → trimmed string. */
export function decodeName(bytes: ReadonlyUint8Array | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let end = arr.length;
  while (end > 0 && arr[end - 1] === 0) end--;
  return dec.decode(arr.subarray(0, end));
}

const UNIT = 10n ** BigInt(USDC_DECIMALS);

/**
 * Base units → human string. Defaults to a trimmed 2dp (`1500000n → "1.5"`);
 * pass `{ fixed: true }` for accounting-style `"1.50"`.
 */
export function formatUsdc(
  base: bigint,
  opts?: { maxFractionDigits?: number; fixed?: boolean },
): string {
  const maxFraction = opts?.maxFractionDigits ?? 2;
  const negative = base < 0n;
  const abs = negative ? -base : base;
  const whole = abs / UNIT;
  const frac = abs % UNIT;
  let fracStr = frac.toString().padStart(USDC_DECIMALS, "0").slice(0, maxFraction);
  if (!opts?.fixed) fracStr = fracStr.replace(/0+$/, "");
  const wholeStr = whole.toLocaleString("en-US");
  const body = fracStr ? `${wholeStr}.${fracStr}` : wholeStr;
  return negative ? `-${body}` : body;
}

/** Human amount string → base units. Throws on more precision than USDC allows. */
export function parseUsdc(input: string): bigint {
  const trimmed = input.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error("Enter a plain number, e.g. 50 or 12.50");
  }
  const [whole, frac = ""] = trimmed.split(".");
  if (frac.length > USDC_DECIMALS) {
    throw new Error(`USDC supports at most ${USDC_DECIMALS} decimal places`);
  }
  return BigInt(whole) * UNIT + BigInt(frac.padEnd(USDC_DECIMALS, "0"));
}

export function shortAddress(address: string, lead = 4, tail = 4): string {
  if (address.length <= lead + tail + 1) return address;
  return `${address.slice(0, lead)}…${address.slice(-tail)}`;
}

/**
 * Unix seconds → "Aug 31". Explicit locale so server and client agree
 * (Node and the browser can have different default locales → hydration
 * mismatch otherwise).
 */
export function formatShortDate(unixSeconds: number | bigint): string {
  return new Date(Number(unixSeconds) * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/**
 * Unix seconds → local date + time, "Aug 31, 2:15 PM". Explicit locale so
 * server and client agree.
 */
export function formatDateTime(unixSeconds: number | bigint): string {
  return new Date(Number(unixSeconds) * 1000).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * A span of seconds → a short human string: "4d 6h", "12m", "45s", "now".
 * At most two units. Negative or zero → "now".
 */
export function formatDuration(seconds: number): string {
  const s = Math.floor(seconds);
  if (s <= 0) return "now";
  const d = Math.floor(s / 86_400);
  const h = Math.floor((s % 86_400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return h > 0 ? `${d}d ${h}h` : `${d}d`;
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  if (m > 0) return sec > 0 ? `${m}m ${sec}s` : `${m}m`;
  return `${sec}s`;
}

/** Seconds until `targetUnix` from `nowUnix`, formatted; "now" once elapsed. */
export function formatCountdown(
  targetUnix: number | bigint,
  nowUnix: number,
): string {
  return formatDuration(Number(targetUnix) - nowUnix);
}
