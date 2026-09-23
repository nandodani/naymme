import { ImageResponse } from "next/og.js";

import { OG_CARD_ALT, OgCard, OG_IMAGE_SIZE } from "@/lib/og-card.js";

// Same card as Open Graph — summary_large_image uses the 1200×630 crop.
export const alt = OG_CARD_ALT;
export const size = OG_IMAGE_SIZE;
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(<OgCard />, { ...size });
}
