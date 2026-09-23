import { SITE_DESCRIPTION, SITE_NAME } from "./site.js";

/** Standard OG/Twitter card dimensions shared by both image routes. */
export const OG_IMAGE_SIZE = { width: 1200, height: 630 } as const;

export const OG_CARD_ALT =
  "naymme — check name availability across domains, code registries, and social handles";

/**
 * Social-card markup rendered by app/opengraph-image and
 * app/twitter-image through ImageResponse (satori: flexbox + a subset of
 * CSS only). Mirrors the app's OLED style — pitch black, 1px zinc-800
 * hairlines, white-on-black Geist with a single emerald accent.
 */
export function OgCard() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        backgroundColor: "#000000",
        padding: 48,
        fontFamily: "Geist",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          flex: 1,
          border: "1px solid #27272a",
          borderRadius: 24,
          padding: "56px 64px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 44,
              height: 44,
              borderRadius: 10,
              border: "1px solid #27272a",
              backgroundColor: "#0a0a0b",
              color: "#fafafa",
              fontSize: 24,
            }}
          >
            n
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span style={{ color: "#fafafa", fontSize: 28, letterSpacing: -0.5 }}>{SITE_NAME}</span>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 5,
                backgroundColor: "#34d399",
              }}
            />
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <span
            style={{
              color: "#fafafa",
              fontSize: 72,
              lineHeight: 1.05,
              letterSpacing: -2,
              maxWidth: 900,
            }}
          >
            Check name availability everywhere
          </span>
          <span style={{ color: "#71717a", fontSize: 30, lineHeight: 1.3, maxWidth: 920 }}>
            {SITE_DESCRIPTION}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {["domains", "github", "npm", "socials"].map((label) => (
            <span
              key={label}
              style={{
                color: "#a1a1aa",
                fontSize: 22,
                border: "1px solid #27272a",
                borderRadius: 999,
                padding: "8px 18px",
                backgroundColor: "#0a0a0b",
              }}
            >
              {label}
            </span>
          ))}
          <span style={{ color: "#52525b", fontSize: 22, marginLeft: "auto" }}>
            naymme.vercel.app
          </span>
        </div>
      </div>
    </div>
  );
}
