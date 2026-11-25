import { cacheLife } from "next/cache";

export const REPO_URL = "https://github.com/ChirayuSahu/vtop-cmd";
const LATEST_URL = `${REPO_URL}/releases/latest`;
// Browsers install from their stores, which also keep the extension updated.
export const FIREFOX_ADDON_URL = "https://addons.mozilla.org/en-US/firefox/addon/vtop-cmd/";
export const CHROME_STORE_URL = "https://chromewebstore.google.com/detail/vtop-command/nakkjdlcdcghijdamfckggekaegnfbhb";

export type Release = {
  version: string | null;
  chromeUrl: string;
  firefoxUrl: string;
  /** The signed .xpi on the GitHub release, for installing without the store. */
  xpiUrl: string;
};

type Asset = { name: string; browser_download_url: string };

// The version and .xpi link come from the newest GitHub release. If GitHub can't be
// reached, they fall back to the release page so the site still builds and works.
export async function getLatestRelease(): Promise<Release> {
  "use cache";
  cacheLife("hours");
  const fallback: Release = { version: null, chromeUrl: CHROME_STORE_URL, firefoxUrl: FIREFOX_ADDON_URL, xpiUrl: LATEST_URL };
  try {
    const response = await fetch("https://api.github.com/repos/ChirayuSahu/vtop-cmd/releases/latest", {
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!response.ok) return fallback;
    const release: { tag_name?: string; assets?: Asset[] } = await response.json();
    const version = release.tag_name?.replace(/^v/, "") ?? null;
    const assets = release.assets ?? [];
    const firefox = assets.find((asset) => asset.name.endsWith(".xpi"));
    return {
      version,
      chromeUrl: CHROME_STORE_URL,
      firefoxUrl: FIREFOX_ADDON_URL,
      xpiUrl: firefox?.browser_download_url ?? LATEST_URL,
    };
  } catch {
    return fallback;
  }
}

export type ReleaseNotes = { version: string; name: string; publishedAt: string | null; html: string; url: string };

// One release's notes as GitHub renders them (GitHub sanitizes this HTML). With no version, or a
// version that has no release yet, this returns null and the page falls back to the latest release.
export async function getReleaseNotes(version?: string): Promise<ReleaseNotes | null> {
  "use cache";
  cacheLife("hours");
  if (version !== undefined && !/^\d+(?:\.\d+){1,3}$/.test(version)) return null;
  const path = version ? `releases/tags/v${version}` : "releases/latest";
  try {
    const response = await fetch(`https://api.github.com/repos/ChirayuSahu/vtop-cmd/${path}`, {
      headers: { Accept: "application/vnd.github.html+json" },
    });
    if (!response.ok) return null;
    const release: { tag_name?: string; name?: string; published_at?: string; body_html?: string; html_url?: string } =
      await response.json();
    if (!release.tag_name || !release.body_html) return null;
    return {
      version: release.tag_name.replace(/^v/, ""),
      name: release.name || release.tag_name,
      publishedAt: release.published_at ?? null,
      html: release.body_html,
      url: release.html_url || `${REPO_URL}/releases/tag/${release.tag_name}`,
    };
  } catch {
    return null;
  }
}
