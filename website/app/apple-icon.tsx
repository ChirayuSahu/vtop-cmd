import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

// iOS home-screen icon: the logo on a white tile (iOS rounds the corners itself).
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// Read once when the module loads, so the icon is generated at build time.
const logo = await readFile(join(process.cwd(), "app/icon.svg"), "utf8");
const logoSrc = `data:image/svg+xml;base64,${Buffer.from(logo).toString("base64")}`;

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#fff" }}>
        <img src={logoSrc} width={140} height={140} alt="" />
      </div>
    ),
    size,
  );
}
