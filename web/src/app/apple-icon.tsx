import { ImageResponse } from "next/og";

import { BRAND, SavoraMark } from "@/lib/brand";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: BRAND.paper,
        }}
      >
        <SavoraMark size={120} color={BRAND.accent} strokeWidth={2.4} />
      </div>
    ),
    size,
  );
}
