import { cacheLife } from "next/cache";

export const REPO_URL = "https://github.com/ChirayuSahu/vtop-cmd";
const LATEST_URL = `${REPO_URL}/releases/latest`;
// Firefox and Zen install from Firefox Add-ons, which also keeps them updated.
export const FIREFOX_ADDON_URL = "https://addons.mozilla.org/en-US/firefox/addon/vtop-cmd/";

export type Release = {
  version: string | null;
  chromeUrl: string;
  firefoxUrl: string;
  /** The signed .xpi on the GitHub release, for installing without the store. */
  xpiUrl: string;
};

type Asset = { name: string; browser_download_url: string };

// Chrome and .xpi download links come from the newest GitHub release. If GitHub can't be
// reached, they fall back to the release page so the site still builds and works.
export async function getLatestRelease(): Promise<Release> {
  "use cache";
  cacheLife("hours");
  const fallback: Release = { version: null, chromeUrl: LATEST_URL, firefoxUrl: FIREFOX_ADDON_URL, xpiUrl: LATEST_URL };
  try {
    const response = await fetch("https://api.github.com/repos/ChirayuSahu/vtop-cmd/releases/latest", {
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!response.ok) return fallback;
    const release: { tag_name?: string; assets?: Asset[] } = await response.json();
    const version = release.tag_name?.replace(/^v/, "") ?? null;
    const assets = release.assets ?? [];
    const firefox = assets.find((asset) => asset.name.endsWith(".xpi"));
    const chrome = assets.find((asset) => /^vtop-command-[\d.]+\.zip$/.test(asset.name));
    return {
      version,
      chromeUrl: chrome?.browser_download_url ?? LATEST_URL,
      firefoxUrl: FIREFOX_ADDON_URL,
      xpiUrl: firefox?.browser_download_url ?? LATEST_URL,
    };
  } catch {
    return fallback;
  }
}
