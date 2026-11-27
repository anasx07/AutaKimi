import Constants from "expo-constants";

const GITHUB_LATEST_RELEASE_API =
  "https://api.github.com/repos/anasx07/AutaKimi/releases/latest";

export interface MobileReleaseCheckResult {
  updateAvailable: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseName: string;
  releaseNotes: string;
  releaseUrl: string;
  apkDownloadUrl: string | null;
}

export function compareSemver(a: string, b: string): number {
  const parseParts = (v: string): [number, number, number] => {
    const clean = v.trim().replace(/^v/i, "").split("-")[0].split("+")[0];
    const parts = clean.split(".").map((n) => Number.parseInt(n, 10) || 0);
    return [parts[0] || 0, parts[1] || 0, parts[2] || 0];
  };
  const pa = parseParts(a);
  const pb = parseParts(b);
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pa[i] - pb[i];
  }
  return 0;
}

export async function checkMobileReleaseUpdate(): Promise<MobileReleaseCheckResult> {
  const currentVersion = Constants.expoConfig?.version || "2.3.1";
  const response = await fetch(GITHUB_LATEST_RELEASE_API, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": `AutaKimi-Mobile/${currentVersion}`,
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub returned HTTP ${response.status}`);
  }

  const release = (await response.json()) as {
    tag_name?: string;
    name?: string;
    body?: string;
    html_url?: string;
    assets?: Array<{
      name?: string;
      browser_download_url?: string;
    }>;
  };

  const latestVersion = (release.tag_name || currentVersion).replace(/^v/i, "");
  const apkAsset = (release.assets || []).find((asset) =>
    String(asset.name || "")
      .toLowerCase()
      .endsWith(".apk"),
  );

  return {
    updateAvailable: compareSemver(latestVersion, currentVersion) > 0,
    currentVersion,
    latestVersion,
    releaseName: release.name || `v${latestVersion}`,
    releaseNotes: release.body || "",
    releaseUrl:
      release.html_url || "https://github.com/anasx07/AutaKimi/releases",
    apkDownloadUrl: apkAsset?.browser_download_url || null,
  };
}
