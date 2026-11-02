import { cacheLife } from "next/cache";

export const REPO_URL = "https://github.com/ChirayuSahu/vtop-cmd";
const LATEST_URL = `${REPO_URL}/releases/latest`;

export type Release = {
  version: string | null;
  chromeUrl: string;
  firefoxUrl: string;
};

type Asset = { name: string; browser_download_url: string };

// Download links come from the newest GitHub release. If GitHub can't be reached,
// both buttons fall back to the release page so the site still builds and works.
export async function getLatestRelease(): Promise<Release> {
  "use cache";
  cacheLife("hours");
  const fallback: Release = { version: null, chromeUrl: LATEST_URL, firefoxUrl: LATEST_URL };
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
      firefoxUrl: firefox?.browser_download_url ?? LATEST_URL,
    };
  } catch {
    return fallback;
  }
}
