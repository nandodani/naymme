import { ImageResponse } from "next/og.js";

import { OG_CARD_ALT, OgCard, OG_IMAGE_SIZE } from "@/lib/og-card.js";

// ImageResponse's default font is Geist — the same family the site serves.
export const alt = OG_CARD_ALT;
export const size = OG_IMAGE_SIZE;
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(<OgCard />, { ...size });
}
