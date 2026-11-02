// Site-wide facts used by metadata, the sitemap, the manifest and structured data.

export const SITE_NAME = "VTOP Command";

export const SITE_TITLE = "VTOP Command: a faster, cleaner VTOP for VIT students";

export const SITE_DESCRIPTION =
  "A free browser extension for VIT's VTOP portal: a ⌘K command menu, a real dark mode, attendance and marks totals, a CGPA calculator and a built-in document viewer. Read-only, and nothing leaves your browser.";

export const SITE_KEYWORDS = [
  "VTOP",
  "VTOP extension",
  "VIT",
  "VIT Vellore",
  "VTOP dark mode",
  "VTOP CGPA calculator",
  "VTOP attendance calculator",
  "VIT student tools",
  "Chrome extension",
  "Firefox add-on",
];

const PRODUCTION_URL = "https://vtop-cmd.chirayusahu.com/";

// The public address: SITE_URL when set, the production domain in production builds,
// and localhost in development.
export function siteUrl() {
  if (process.env.SITE_URL) return new URL(process.env.SITE_URL);
  if (process.env.NODE_ENV === "production") return new URL(PRODUCTION_URL);
  return new URL(`http://localhost:${process.env.PORT ?? 3000}`);
}
