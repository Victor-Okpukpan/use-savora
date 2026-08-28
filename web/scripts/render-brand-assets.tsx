/**
 * One-off: render the Savora mark + an X/Twitter cover as PNGs.
 * Run from web/:  pnpm exec tsx scripts/render-brand-assets.tsx <outDir>
 * Not part of the build.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as React from "react";
import { ImageResponse } from "next/og";

const h = React.createElement;

// Dark-mode ("Warm Archive at night") palette, from web/src/app/globals.css
const DARK = {
  bg: "#1a1712",
  ink: "#f2ece0",
  inkMuted: "#a6a094",
  accent: "#83c8a4",
};

const FONT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "src/fonts");

async function fonts() {
  const [serif, sans, sansSemi] = await Promise.all([
    readFile(join(FONT_DIR, "InstrumentSerif-Regular.ttf")),
    readFile(join(FONT_DIR, "Inter-Regular.woff")),
    readFile(join(FONT_DIR, "Inter-SemiBold.woff")),
  ]);
  return [
    { name: "Instrument Serif", data: serif, weight: 400 as const, style: "normal" as const },
    { name: "Inter", data: sans, weight: 400 as const, style: "normal" as const },
    { name: "Inter", data: sansSemi, weight: 600 as const, style: "normal" as const },
  ];
}

/** The ring + dot, matching web/src/lib/brand.tsx. */
function mark(size: number, color: string, strokeWidth = 2.4) {
  return h(
    "svg",
    { width: size, height: size, viewBox: "0 0 32 32", fill: "none" },
    h("circle", { cx: 16, cy: 16, r: 12.9, stroke: color, strokeWidth }),
    h("circle", { cx: 16, cy: 3.1, r: 3.1, fill: color }),
  );
}

async function png(el: React.ReactElement, width: number, height: number) {
  const res = new ImageResponse(el, { width, height, fonts: await fonts() });
  return Buffer.from(await res.arrayBuffer());
}

async function main() {
  const outDir = process.argv[2] || join(process.cwd(), "brand-assets");
  await mkdir(outDir, { recursive: true });

  // 1. Mark on the dark background.
  const markOnDark = h(
    "div",
    {
      style: {
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: DARK.bg,
      },
    },
    mark(560, DARK.accent, 2.4),
  );

  // 2. Mark, transparent.
  const markTransparent = h(
    "div",
    {
      style: {
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "transparent",
      },
    },
    mark(560, DARK.accent, 2.4),
  );

  // 3. X / Twitter cover — 1500 x 500, 3:1. Centred lockup so the avatar in the
  //    lower-left corner never overlaps it.
  const cover = h(
    "div",
    {
      style: {
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 26,
        background: DARK.bg,
        color: DARK.ink,
        fontFamily: "Inter",
      },
    },
    h(
      "div",
      { style: { display: "flex", alignItems: "center", gap: 24 } },
      mark(84, DARK.accent, 2.4),
      h(
        "span",
        { style: { fontFamily: "Instrument Serif", fontSize: 104, color: DARK.ink } },
        "Savora",
      ),
    ),
    h(
      "span",
      {
        style: {
          fontFamily: "Inter",
          fontWeight: 600,
          fontSize: 22,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: DARK.inkMuted,
        },
      },
      "Rotating savings · onchain · non-custodial",
    ),
  );

  await writeFile(join(outDir, "savora-mark-dark.png"), await png(markOnDark, 1200, 1200));
  await writeFile(join(outDir, "savora-mark.png"), await png(markTransparent, 1200, 1200));
  await writeFile(join(outDir, "savora-x-cover.png"), await png(cover, 1500, 500));

  console.log("wrote:", outDir);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
