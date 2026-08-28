import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

import { BRAND, SavoraMark } from "./brand";

export const OG_SIZE = { width: 1200, height: 630 } as const;
export const OG_CONTENT_TYPE = "image/png";

const FONT_DIR = join(process.cwd(), "src/fonts");

/** Loaded once per server process. */
let fontsPromise: Promise<
  { name: string; data: Buffer; weight: 400 | 600; style: "normal" }[]
> | null = null;

export function ogFonts() {
  if (!fontsPromise) {
    fontsPromise = Promise.all([
      readFile(join(FONT_DIR, "InstrumentSerif-Regular.ttf")),
      readFile(join(FONT_DIR, "Inter-Regular.woff")),
      readFile(join(FONT_DIR, "Inter-SemiBold.woff")),
    ]).then(([serif, sans, sansSemi]) => [
      { name: "Instrument Serif", data: serif, weight: 400 as const, style: "normal" as const },
      { name: "Inter", data: sans, weight: 400 as const, style: "normal" as const },
      { name: "Inter", data: sansSemi, weight: 600 as const, style: "normal" as const },
    ]);
  }
  return fontsPromise;
}

/** Warm-paper frame shared by every card. */
function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 80,
        background: BRAND.paper,
        color: BRAND.ink,
        fontFamily: "Inter",
      }}
    >
      {children}
    </div>
  );
}

function Header() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
      <SavoraMark size={44} color={BRAND.accent} strokeWidth={2.4} />
      <span style={{ fontFamily: "Instrument Serif", fontSize: 40 }}>
        {BRAND.name}
      </span>
    </div>
  );
}

function Footer({ text = BRAND.footer }: { text?: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 18,
      }}
    >
      <div style={{ height: 1, background: BRAND.line }} />
      <span
        style={{
          fontFamily: "Inter",
          fontWeight: 600,
          fontSize: 20,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: BRAND.inkMuted,
        }}
      >
        {text}
      </span>
    </div>
  );
}

/** The quiet brand card — also the fallback for the per-circle route. */
export async function brandCard() {
  return new ImageResponse(
    (
      <Frame>
        <Header />
        <div
          style={{
            fontFamily: "Instrument Serif",
            fontSize: 76,
            lineHeight: 1.05,
            letterSpacing: "-0.01em",
            maxWidth: 900,
          }}
        >
          {BRAND.tagline}
        </div>
        <Footer />
      </Frame>
    ),
    { ...OG_SIZE, fonts: await ogFonts() },
  );
}

/** Per-circle card: name + a three-cell stat row. */
export async function circleCard(opts: {
  name: string;
  contribution: string;
  seats: string;
  state: string;
}) {
  const cell = (label: string, value: string) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <span
        style={{
          fontFamily: "Inter",
          fontWeight: 600,
          fontSize: 17,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: BRAND.inkMuted,
        }}
      >
        {label}
      </span>
      <span style={{ fontFamily: "Inter", fontSize: 34 }}>{value}</span>
    </div>
  );

  return new ImageResponse(
    (
      <Frame>
        <Header />
        <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
          <div
            style={{
              fontFamily: "Instrument Serif",
              fontSize: 84,
              lineHeight: 1,
              letterSpacing: "-0.01em",
            }}
          >
            {opts.name}
          </div>
          <div style={{ display: "flex", gap: 72 }}>
            {cell("Per round", `${opts.contribution} USDC`)}
            {cell("Seats", opts.seats)}
            {cell("Status", opts.state)}
          </div>
        </div>
        <Footer text="A non-custodial ajo circle · Savora" />
      </Frame>
    ),
    { ...OG_SIZE, fonts: await ogFonts() },
  );
}
