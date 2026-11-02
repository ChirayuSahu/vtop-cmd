import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

// The social preview: the homepage hero, drawn on the server.
export const alt = "VTOP Command: Tired of the old and slow VTOP? Fix it.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const ink = "#111214";
const muted = "#b6b9bf";

function Pill({ background, children }: { background: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 92,
        height: 92,
        borderRadius: 999,
        background,
        boxShadow: "0 18px 40px rgba(0,0,0,0.12)",
      }}
    >
      {children}
    </div>
  );
}

// Lucide's "command" and "arrow-up" icons; the fonts don't include these symbols.
const commandIcon = (
  <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3" />
  </svg>
);

const arrowIcon = (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={ink} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="m5 12 7-7 7 7" />
    <path d="M12 19V5" />
  </svg>
);

// Read once when the module loads, so the image is generated at build time.
const [medium, semibold, logo] = await Promise.all([
  readFile(join(process.cwd(), "assets/Urbanist-Medium.ttf")),
  readFile(join(process.cwd(), "assets/Urbanist-SemiBold.ttf")),
  readFile(join(process.cwd(), "app/icon.svg"), "utf8"),
]);
const logoSrc = `data:image/svg+xml;base64,${Buffer.from(logo).toString("base64")}`;

export default function Image() {
  const line = { display: "flex", alignItems: "center", gap: 28 } as const;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "52px 64px 48px",
          background: "#ffffff",
          color: ink,
          fontFamily: "Urbanist",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 30, fontWeight: 600 }}>
          <img src={logoSrc} width={44} height={44} alt="" style={{ borderRadius: 11 }} />
          VTOP Command
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            fontSize: 112,
            fontWeight: 500,
            letterSpacing: -4,
            lineHeight: 1.02,
          }}
        >
          <div style={line}>
            <Pill background="#2f5fe0">{commandIcon}</Pill>
            Tired of
          </div>
          <div style={{ display: "flex", gap: 28 }}>
            <span>the old</span>
            <span style={{ color: muted }}>and</span>
            <span>slow</span>
          </div>
          <div style={line}>
            VTOP?
            <Pill background="#f6cb3c">{arrowIcon}</Pill>
            Fix it.
          </div>
        </div>

        <div style={{ display: "flex", gap: 18, fontSize: 26, color: "#8a8f98" }}>
          <span>Free browser extension for VIT&apos;s VTOP</span>
          <span>·</span>
          <span>Chrome, Brave, Firefox</span>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Urbanist", data: medium, style: "normal", weight: 500 },
        { name: "Urbanist", data: semibold, style: "normal", weight: 600 },
      ],
    },
  );
}
