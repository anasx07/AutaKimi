import { templateService } from "../templates";
import { NetworkConfig } from "../config/network";
import { extractBasePkg, getRepoMeta } from "../services/repoIdentity";

export interface IExtensionPlatform {
  fetch(
    url: string,
    init?: any,
    bypassCf?: boolean,
  ): Promise<{
    ok: boolean;
    status: number;
    text(): Promise<string>;
    json(): Promise<any>;
  }>;
  runSandboxViaPool(
    code: string,
    params: Record<string, any>,
    pkg?: string,
    taskId?: string,
  ): Promise<any>;
  getSetting(key: string): Promise<string | null>;
  upsertExtension(ext: {
    pkg: string;
    installedAt: string;
    code: string;
    name: string;
    baseUrl?: string;
    lang?: string;
    icon: string;
    version: string;
    repoUrl?: string;
    repoName?: string;
    repoColor?: string;
  }): Promise<void>;
}

export class ExtensionEngine {
  constructor(private platform: IExtensionPlatform) {}

  async detectTheme(url: string, bypassCf = true): Promise<string> {
    const check = async (testUrl: string) => {
      try {
        const response = await this.platform.fetch(
          testUrl,
          {
            headers: { "User-Agent": NetworkConfig.DEFAULT_UA },
          },
          bypassCf,
        );
        const html = await response.text();

        if (
          testUrl.includes("meshmanga") ||
          testUrl.includes("appswat") ||
          html.includes("Swat Manga") ||
          html.includes("swatmanga")
        ) {
          return "mangaswat";
        }

        // Dynamic detection: Loop through loaded templates and check for their markers
        if (
          templateService.getTemplate("madara") &&
          (html.includes("madara") ||
            html.includes("wp-content/themes/madara") ||
            html.includes("Madara") ||
            html.includes("wp-manga") ||
            html.includes("c-tabs-item") ||
            html.includes("page-item-detail"))
        )
          return "madara";

        if (
          templateService.getTemplate("mangastream") &&
          (html.includes("mangastream") ||
            html.includes("wp-content/themes/mangastream") ||
            html.includes("mangathemesia") ||
            html.includes('class="bsx"') ||
            html.includes('class="listupd"') ||
            html.includes("bsx") ||
            html.includes("listupd"))
        )
          return "mangastream";
      } catch (e) {
        console.warn(`[ExtensionEngine] detectTheme error on ${testUrl}:`, e);
      }
      return "unknown";
    };

    let theme = await check(url);
    if (theme === "unknown") {
      const cleanUrl = url.replace(/\/$/, "");
      theme = await check(`${cleanUrl}/series`);
      if (theme === "unknown") theme = await check(`${cleanUrl}/manga`);
    }
    return theme;
  }

  async install(ext: any, repoUrl: string): Promise<{ success: boolean }> {
    const effectiveRepoUrl =
      ext.repoUrl && ext.repoUrl !== "remote" && ext.repoUrl !== "local"
        ? ext.repoUrl
        : repoUrl;
    const basePkg = extractBasePkg(ext.pkg);

    let baseUrl = "";
    if (
      effectiveRepoUrl &&
      effectiveRepoUrl !== "local" &&
      effectiveRepoUrl !== "remote"
    ) {
      baseUrl = effectiveRepoUrl.replace(/\/?([^/]+\.json)$/, "");
      if (baseUrl && !baseUrl.endsWith("/")) baseUrl += "/";
    }

    let code = "";
    const bypassCf =
      (await this.platform.getSetting("bypass_cloudflare")) === "true";

    try {
      if (baseUrl && basePkg) {
        const response = await this.platform.fetch(
          `${baseUrl}js/${basePkg}.js`,
          {},
          bypassCf,
        );
        if (response.ok) code = await response.text();
      }
    } catch (e) {
      console.warn(`[ExtensionEngine] Failed to fetch JS for ${ext.pkg}:`, e);
    }

    // If not found in primary repo, check other user-configured HTTP repositories
    if (!code || code.startsWith("404:") || code === "Not Found") {
      const cleanPkg = basePkg
        .replace(/^ma\.autakimi\.extension\./, "")
        .replace(/^eu\.kanade\.tachiyomi\.extension\./, "");
      const candidateNames = [
        basePkg,
        `ma.autakimi.extension.${cleanPkg}`,
        `ma.autakimi.extension.eu.kanade.tachiyomi.extension.${cleanPkg}`,
      ];

      let configuredRepoBases: string[] = [];
      try {
        const reposJson = await this.platform.getSetting("source_repositories");
        const parsed = reposJson ? JSON.parse(reposJson) : [];
        if (Array.isArray(parsed)) {
          configuredRepoBases = parsed
            .filter(
              (r): r is string =>
                typeof r === "string" &&
                (r.startsWith("http://") || r.startsWith("https://")),
            )
            .map((r) => {
              let b = r.replace(/\/?([^/]+\.json)$/i, "");
              if (b && !b.endsWith("/")) b += "/";
              return b;
            })
            .filter((b) => b && b !== baseUrl);
        }
      } catch {
        configuredRepoBases = [];
      }

      outer: for (const repoBase of configuredRepoBases) {
        for (const name of candidateNames) {
          if (!name) continue;
          try {
            const resp = await this.platform.fetch(
              `${repoBase}js/${name}.js`,
              {},
              bypassCf,
            );
            if (resp.ok) {
              const text = await resp.text();
              if (text && !text.startsWith("404") && text.length > 50) {
                code = text;
                console.log(
                  `[ExtensionEngine] Resolved JS scraper for ${ext.pkg} -> ${name}.js`,
                );
                break outer;
              }
            }
          } catch (_) {
            /* ignore */
          }
        }
      }
    }

    if (
      (!code || code.startsWith("404:") || code === "Not Found") &&
      typeof ext.code === "string" &&
      ext.code.trim().length > 0
    ) {
      code = ext.code;
    }

    const extBaseUrl =
      ext.baseUrl ||
      ext.sources?.[0]?.baseUrl ||
      ext.sources?.[0]?.homeUrl ||
      ext.url ||
      "";

    if (!code && extBaseUrl) {
      const theme = await this.detectTheme(extBaseUrl, bypassCf);
      const template = templateService.getTemplate(theme);
      if (template)
        code = template.generate(extBaseUrl, NetworkConfig.DEFAULT_UA);
    }

    // Preserve remote HTTP icon URL (e.g. Keiyoushi) if provided, otherwise use local cache protocol
    const iconUrl =
      typeof ext.icon === "string" && ext.icon.startsWith("http")
        ? ext.icon
        : `autakimi-cache://local-icon/${basePkg}.png`;

    const hasRealRepo =
      !!effectiveRepoUrl &&
      effectiveRepoUrl !== "local" &&
      effectiveRepoUrl !== "remote";
    const repoMeta = hasRealRepo
      ? getRepoMeta(effectiveRepoUrl, ext.repoName)
      : null;

    await this.platform.upsertExtension({
      pkg: ext.pkg,
      installedAt: new Date().toISOString(),
      code,
      name: ext.name,
      baseUrl: extBaseUrl,
      lang: ext.lang,
      icon: iconUrl,
      version: ext.version || "1.0.0",
      repoUrl: hasRealRepo ? effectiveRepoUrl : ext.repoUrl || undefined,
      repoName: ext.repoName || repoMeta?.repoName,
      repoColor: ext.repoColor || repoMeta?.repoColor,
    });

    return { success: true };
  }

  async execute(
    pkg: string,
    code: string,
    params: Record<string, any> = {},
    taskId?: string,
  ): Promise<any> {
    return this.platform.runSandboxViaPool(code, params, pkg, taskId);
  }
}
