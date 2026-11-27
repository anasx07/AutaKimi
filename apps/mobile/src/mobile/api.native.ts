import {
  ElectronApi,
  IpcResult,
  FetchOptions,
  Extension,
  StateUpdateEvent,
  SystemState,
  ActiveTaskState,
} from "@common/types";
import { MobileDB } from "./db.native";
import { MobileNetwork, setCfStatusCallback } from "./network.native";
import { MobileExtension } from "./extension.native";
import { MobileDownload } from "./download.native";
import { MobileCache, setCacheInvalidateCallback } from "./cache.native";
import { identityService } from "./identity.native";
import { mobileBypassProvider } from "./bypass.native";
import { CfCookieStore } from "./cf-cookies";
import { MobileBackup } from "./backup.native";
import {
  sourceService,
  templateService,
  extensionRegistryOrchestrator,
  ExtensionEngine,
  IExtensionPlatform,
  networkClient,
  getRepoMeta,
  resolveRemoteExtensionIconUrl,
} from "@common";
import Constants from "expo-constants";
import * as WebBrowser from "expo-web-browser";

type Callback = (data: any) => void;

const cfStatusCallbacks = new Set<Callback>();
const cacheInvalidateCallbacks = new Set<Callback>();

function notifyCfStatus(
  status: "started" | "completed" | "failed",
  domain?: string,
): void {
  cfStatusCallbacks.forEach((cb) => cb({ status, domain }));
}

function notifyCacheInvalidate(group: string, key?: string): void {
  cacheInvalidateCallbacks.forEach((cb) => cb({ group, key }));
}

// Wire callbacks from backend modules to the event registries
setCfStatusCallback((data) => notifyCfStatus(data.status, data.domain));
setCacheInvalidateCallback((data) =>
  notifyCacheInvalidate(data.group, data.key),
);
const mobileExtensionPlatform: IExtensionPlatform = {
  fetch: async (url: string, init?: any) => {
    const res = await networkClient.fetch(url, init);
    if (res.ok) {
      return res.value;
    }
    throw new Error(res.error || `Fetch failed with status ${res.status}`);
  },
  runSandboxViaPool: async (
    code: string,
    params: Record<string, any>,
    pkg?: string,
    taskId?: string,
  ) => {
    const res = await MobileExtension.execute({
      pkg: pkg || "",
      code,
      contextArgs: params,
    });
    if (res.ok) {
      return res.value;
    }
    throw new Error(res.error);
  },
  getSetting: async (key: string) => {
    const res = await MobileDB.getSetting(key);
    return res.ok ? res.value : null;
  },
  upsertExtension: async (ext: any) => {
    await MobileDB.addExtension({
      ...ext,
      icon: resolveRemoteExtensionIconUrl(ext.icon, ext.pkg, ext.repoUrl),
    });
  },
};

const extensionEngine = new ExtensionEngine(mobileExtensionPlatform);

export const MobileApi: ElectronApi = {
  init: async () => {
    await MobileDB.init();
    await CfCookieStore.init();
    await identityService.initialize();
    mobileBypassProvider.initialize();
    return { ok: true, value: undefined };
  },
  db: MobileDB as unknown as ElectronApi["db"],

  fetchRepo: (url: string) => MobileNetwork.fetchRepo(url),
  fetchText: (url: string, options?: FetchOptions) =>
    MobileNetwork.fetchText(url, options),

  executeExtension: async (args: {
    pkg: string;
    code: string;
    contextArgs?: Record<string, unknown>;
  }) => {
    let { pkg, code, contextArgs } = args;

    // Reject corrupt package IDs (e.g. numeric-only IDs like "41" from old buggy catalog parsing)
    if (/^\d+$/.test(pkg)) {
      console.warn(
        `[MobileApi] Rejecting corrupt numeric-only package ID: "${pkg}". Removing from database.`,
      );
      try {
        await MobileDB.removeExtension(pkg);
      } catch (_) {
        /* ignore */
      }
      return { ok: false, error: `Invalid package ID: ${pkg}` };
    }

    const getTheme = async (extBaseUrl: string): Promise<string> => {
      if (
        pkg.includes("mangaswat") ||
        extBaseUrl.includes("meshmanga") ||
        extBaseUrl.includes("appswat")
      ) {
        return "mangaswat";
      }

      // 1. Try checking catalog source first (fast, offline-capable, and completely reliable)
      const catalogSource = sourceService.getSource(pkg) as any;
      if (catalogSource) {
        if (catalogSource.templateId) return catalogSource.templateId;
        const baseClass = catalogSource.baseClass || catalogSource.base_class;
        if (baseClass) {
          if (baseClass === "Madara") return "madara";
          if (
            baseClass === "Mangastream" ||
            baseClass === "MangaThemesia" ||
            baseClass === "Iken"
          ) {
            return "mangastream";
          }
        }
      }

      // 2. Fallback: try online theme detection if extBaseUrl is available
      if (extBaseUrl) {
        try {
          const theme = await extensionEngine.detectTheme(extBaseUrl);
          if (theme && theme !== "unknown") {
            return theme;
          }
        } catch (e) {
          console.warn(
            `[MobileApi] detectTheme online check failed for ${extBaseUrl}:`,
            e,
          );
        }
      }

      // 3. Fallback: return 'unknown'
      return "unknown";
    };

    const regenerateCode = async (
      dbExtValue: any,
      preferTemplate = false,
    ): Promise<string | null> => {
      let extBaseUrl = dbExtValue.baseUrl || dbExtValue.baseurl;
      const catalogSource = sourceService.getSource(pkg) as any;
      if (!extBaseUrl && catalogSource) {
        extBaseUrl = catalogSource.baseUrl || catalogSource.url;
      }

      if (!extBaseUrl) {
        console.warn(
          `[MobileApi] Cannot regenerate code: extBaseUrl is missing for ${pkg}`,
        );
        return null;
      }

      // Step 1: If preferTemplate is false, check community JavaScript extensions ecosystem
      if (!preferTemplate) {
        const cleanPkg = pkg
          .replace(/^ma\.autakimi\.extension\./, "")
          .replace(/^eu\.kanade\.tachiyomi\.extension\./, "");
        const candidateNames = [
          pkg,
          `ma.autakimi.extension.${cleanPkg}`,
          `ma.autakimi.extension.eu.kanade.tachiyomi.extension.${cleanPkg}`,
        ];
        const COMMUNITY_JS_REPO =
          "https://raw.githubusercontent.com/Autakimi-Ecosystem/autakimi-extensions/main/dist/js/";

        for (const name of candidateNames) {
          try {
            const resp = await MobileNetwork.fetchText(
              `${COMMUNITY_JS_REPO}${name}.js`,
            );
            if (
              resp.ok &&
              resp.value.ok &&
              resp.value.data &&
              !resp.value.data.startsWith("404:") &&
              resp.value.data.length > 50
            ) {
              const jsCode = resp.value.data;
              await MobileDB.addExtension({
                ...dbExtValue,
                baseUrl: extBaseUrl,
                code: jsCode,
              });
              console.log(
                `[MobileApi] Successfully resolved community JS scraper for ${pkg} -> ${name}.js`,
              );
              return jsCode;
            }
          } catch (_) {
            /* ignore */
          }
        }
      }

      // Step 2: Fall back to dynamic CMS template (Madara, MangaStream, MangaThemesia)
      const theme = await getTheme(extBaseUrl);
      console.log(
        `[MobileApi] Theme resolved: ${theme} for ${pkg} (${extBaseUrl})`,
      );
      const template = templateService.getTemplate(theme);
      if (template) {
        const generated = template.generate(
          extBaseUrl,
          "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36",
        );
        await MobileDB.addExtension({
          ...dbExtValue,
          baseUrl: extBaseUrl,
          code: generated,
        });
        console.log(
          `[MobileApi] Successfully regenerated and saved code for ${pkg} using theme ${theme}`,
        );
        return generated;
      } else {
        console.warn(`[MobileApi] No template found for theme: ${theme}`);
        return null;
      }
    };

    if (code && (code.includes("\\r\\n") || code.includes('\\\"'))) {
      console.warn(
        `[MobileApi] Detected corrupted legacy escape characters in extension code for ${pkg}. Forcing regeneration...`,
      );
      code = "";
    }

    if (pkg.includes("mangaswat") && code && !code.includes("appswat")) {
      console.warn(
        `[MobileApi] Detected outdated scraper for MangaSwat (${pkg}). Forcing regeneration...`,
      );
      code = "";
    }

    if (
      !code ||
      code.trim().startsWith("404:") ||
      code.trim() === "Not Found"
    ) {
      console.warn(
        `[MobileApi] Extension code for ${pkg} is invalid/missing. Attempting to regenerate from template...`,
      );
      try {
        const dbExt = await MobileDB.getExtension(pkg);
        console.log(`[MobileApi] dbExt query result:`, JSON.stringify(dbExt));
        if (dbExt.ok && dbExt.value) {
          const regenerated = await regenerateCode(dbExt.value);
          if (regenerated) {
            code = regenerated;
          }
        } else {
          console.warn(
            `[MobileApi] dbExt query failed or returned no value:`,
            dbExt,
          );
        }
      } catch (err) {
        console.error(
          `[MobileApi] Failed to auto-regenerate code for ${pkg}:`,
          err,
        );
      }
    }

    if (!code) {
      return {
        ok: false,
        error: `Could not identify a compatible theme (Madara/MangaStream) for ${pkg}. This source may require a custom scraper or Android DEX runtime.`,
      };
    }

    let result = await MobileExtension.execute({ pkg, code, contextArgs });
    if (
      !result.ok &&
      result.error &&
      (result.error.includes("SyntaxError") ||
        result.error.includes("ReferenceError") ||
        result.error.includes("TypeError"))
    ) {
      console.warn(
        `[MobileApi] Execution failed with syntax/reference/type error for ${pkg}. Attempting recovery by template generation...`,
      );
      try {
        const dbExt = await MobileDB.getExtension(pkg);
        if (dbExt.ok && dbExt.value) {
          const regenerated = await regenerateCode(dbExt.value, true);
          if (regenerated) {
            code = regenerated;
            result = await MobileExtension.execute({ pkg, code, contextArgs });
          }
        }
      } catch (err) {
        console.error(
          `[MobileApi] Failed to auto-regenerate code on error recovery for ${pkg}:`,
          err,
        );
      }
    }
    return result;
  },

  cancelExtensionExecution: async (taskId: string) => {
    return { ok: true, value: true };
  },

  installExtension: async (
    ext: Extension,
    repoUrl: string,
  ): Promise<IpcResult<{ success: boolean }>> => {
    try {
      const effectiveRepoUrl =
        ext.repoUrl && ext.repoUrl !== "remote" && ext.repoUrl !== "local"
          ? ext.repoUrl
          : repoUrl;
      const extWithIcon: Extension = {
        ...ext,
        icon: resolveRemoteExtensionIconUrl(ext.icon, ext.pkg, effectiveRepoUrl),
      };
      const res = await extensionEngine.install(extWithIcon, repoUrl);
      return { ok: true, value: res };
    } catch (err: any) {
      return { ok: false, error: err.message || String(err) };
    }
  },

  clearCache: async () => {
    await MobileCache.clear();
    return { ok: true, value: { success: true } };
  },

  clearCookies: async () => {
    return await MobileNetwork.clearCookies();
  },

  openExternal: async (url: string) => {
    await WebBrowser.openBrowserAsync(url);
    return { ok: true, value: undefined };
  },

  openInternalBrowser: async (url: string) => {
    await WebBrowser.openBrowserAsync(url);
    return { ok: true, value: undefined };
  },

  cfBypass: (url: string) => MobileNetwork.cfBypass(url),
  cfFetchHtml: (url: string) =>
    MobileNetwork.fetchText(url).then((r) => {
      if (r.ok) return { ok: true, value: r.value.data };
      return { ok: false, error: r.error };
    }),

  download: MobileDownload as unknown as ElectronApi["download"],

  window: {
    minimize: async () => ({ ok: true, value: undefined }),
    maximize: async () => ({ ok: true, value: undefined }),
    restore: async () => ({ ok: true, value: undefined }),
    close: async () => ({ ok: true, value: undefined }),
    isMaximized: async () => ({ ok: true, value: true }),
    setFullScreen: async () => ({ ok: true, value: undefined }),
    isFullScreen: async () => ({ ok: true, value: false }),
    onFullScreenChange: () => () => {},
    updateOverlay: async () => ({ ok: true, value: undefined }),
    openExternal: async (url: string) => {
      await WebBrowser.openBrowserAsync(url);
      return { ok: true, value: undefined };
    },
    openInternalBrowser: async (url: string) => {
      await WebBrowser.openBrowserAsync(url);
      return { ok: true, value: undefined };
    },
  },

  getSystemState: async (): Promise<IpcResult<SystemState>> => {
    const activeDownloads: Record<string, ActiveTaskState> = {};
    for (const [, task] of MobileDownload.activeDownloads) {
      const stateKey = `${task.mangaId}:${task.chapterId}`;
      activeDownloads[stateKey] = {
        mangaId: task.mangaId,
        chapterId: task.chapterId,
        status: task.active ? "downloading" : "canceled",
        cached: task.cached || 0,
        total: task.total || 0,
        type: task.type || "manga",
      };
    }
    return {
      ok: true,
      value: {
        activeDownloads,
        cloudflareBypasses: {},
        activeBypass: null,
      },
    };
  },

  onSystemStateUpdate: (callback: (data: StateUpdateEvent) => void) => {
    return MobileDownload.onEvent((data) => {
      callback({
        type: "active_tasks_update",
        task: {
          mangaId: data.mangaId,
          chapterId: data.chapterId,
          status:
            data.type === "start" || data.type === "progress"
              ? "downloading"
              : data.type === "completed"
                ? "completed"
                : "canceled",
          cached: data.cached || 0,
          total: data.total || 0,
          type: (data.mediaType || data.type) === "anime" ? "anime" : "manga",
        },
      });
    });
  },

  detectTheme: async (baseUrl: string): Promise<IpcResult<string>> => {
    const check = async (
      url: string,
    ): Promise<"madara" | "mangastream" | "unknown"> => {
      try {
        const res = await MobileNetwork.fetchText(url);
        if (!res.ok) return "unknown";
        const html = res.value.data;
        if (
          html.includes("madara") ||
          html.includes("wp-content/themes/madara") ||
          html.includes("Madara")
        )
          return "madara";
        if (
          html.includes("mangastream") ||
          html.includes("wp-content/themes/mangastream") ||
          html.includes('class="bsx"') ||
          html.includes('class="listupd"')
        )
          return "mangastream";
      } catch (e) {
        console.warn("[MobileApi] detectTheme error:", e);
      }
      return "unknown";
    };

    let theme: "madara" | "mangastream" | "unknown" = await check(baseUrl);
    if (theme === "unknown") {
      const cleanUrl = baseUrl.replace(/\/$/, "");
      theme = await check(`${cleanUrl}/series`);
      if (theme === "unknown") theme = await check(`${cleanUrl}/manga`);
    }
    return { ok: true, value: theme };
  },

  onAppUpdate: () => () => {},
  onDownloadEvent: (callback: (data: any) => void) => {
    MobileDownload.onEvent(callback);
    return () => MobileDownload.onEvent(() => {});
  },
  onCfStatus: (
    callback: (data: {
      status: "started" | "completed" | "failed";
      domain?: string;
    }) => void,
  ) => {
    cfStatusCallbacks.add(callback);
    return () => {
      cfStatusCallbacks.delete(callback);
    };
  },
  onCacheInvalidate: (
    callback: (data: { group: string; key?: string }) => void,
  ) => {
    cacheInvalidateCallbacks.add(callback);
    return () => {
      cacheInvalidateCallbacks.delete(callback);
    };
  },

  installUpdate: async () => ({ ok: true, value: undefined }),
  checkForUpdates: async () => ({ ok: true, value: undefined }),

  sync: {
    startServer: async () => ({ ok: false, error: "Not supported on mobile" }),
    stopServer: async () => ({ ok: true, value: undefined }),
    getStatus: async () => ({
      ok: true,
      value: {
        isRunning: false,
        port: 0,
        ip: "",
        deviceId: identityService.getDeviceId(),
      },
    }),
    getPairingPayload: async () => ({
      ok: false,
      error: "Not supported on mobile",
    }),
  },

  sources: {
    getRepos: async () => {
      const reposJson = await MobileDB.getSetting("source_repositories");
      const value =
        reposJson.ok && reposJson.value ? JSON.parse(reposJson.value) : [];
      return { ok: true, value };
    },
    addRepo: async (url: string) => {
      if (typeof url !== "string") throw new Error("Invalid URL");
      const reposJson = await MobileDB.getSetting("source_repositories");
      const repos: string[] =
        reposJson.ok && reposJson.value ? JSON.parse(reposJson.value) : [];

      if (repos.includes(url)) {
        return { ok: true, value: { success: true, count: 0 } };
      }

      let installedLangs: string[] = [];
      try {
        const installedDb = await MobileDB.getExtensions();
        if (installedDb.ok && installedDb.value) {
          installedLangs = Array.from(
            new Set(installedDb.value.map((e) => e.lang || "en")),
          );
        }
      } catch (e) {
        console.warn("[MobileApi] Failed to read installed languages:", e);
      }

      const syncRes = await extensionRegistryOrchestrator.syncRepositories(
        [url],
        installedLangs,
      );
      if (!syncRes.success || syncRes.manifestsCount === 0) {
        throw new Error("Failed to resolve repository manifest");
      }

      repos.push(url);
      await MobileDB.setSetting("source_repositories", JSON.stringify(repos));
      return {
        ok: true,
        value: {
          success: true,
          count: syncRes.sourcesCount || syncRes.templatesCount,
        },
      };
    },
    removeRepo: async (url: string) => {
      if (typeof url !== "string") throw new Error("Invalid URL");
      const reposJson = await MobileDB.getSetting("source_repositories");
      let repos: string[] =
        reposJson.ok && reposJson.value ? JSON.parse(reposJson.value) : [];
      repos = repos.filter((r) => r !== url);
      await MobileDB.setSetting("source_repositories", JSON.stringify(repos));
      sourceService.clear();
      if (repos.length > 0) {
        await sourceService.loadAllRepositories(repos);
      }
      return { ok: true, value: undefined };
    },
    refreshAll: async () => {
      const reposJson = await MobileDB.getSetting("source_repositories");
      const repos: string[] =
        reposJson.ok && reposJson.value ? JSON.parse(reposJson.value) : [];
      const templatesRes = await templateService.loadAllRepositories(repos);

      let installedLangs: string[] = [];
      try {
        const installedDb = await MobileDB.getExtensions();
        if (installedDb.ok && installedDb.value) {
          installedLangs = Array.from(
            new Set(installedDb.value.map((e) => e.lang || "en")),
          );
        }
      } catch (e) {
        console.warn("[MobileApi] Failed to get installed languages:", e);
      }

      await sourceService.loadAllRepositories(repos, installedLangs);
      return { ok: true, value: templatesRes };
    },
    getAllSources: async () => {
      return { ok: true, value: sourceService.getAllSources() };
    },
    getCatalogExtensions: async (lang?: string) => {
      const reposJson = await MobileDB.getSetting("source_repositories");
      const repos: string[] =
        reposJson.ok && reposJson.value ? JSON.parse(reposJson.value) : [];
      if (repos.length === 0) {
        sourceService.clear();
        return { ok: true, value: [] };
      }

      if (lang && lang !== "all") {
        await sourceService.fetchCatalogByLang(lang, "manga");
        await sourceService.fetchCatalogByLang(lang, "anime");
      }
      const sources = sourceService.getAllSources();
      const value = sources.map((s: any) => {
        const fullPkg = s.pkg || s.id || "";
        const effectiveRepoUrl =
          s.repoUrl && s.repoUrl !== "remote"
            ? s.repoUrl
            : repos[0] || "remote";
        const meta = getRepoMeta(effectiveRepoUrl, s.repoName);
        const iconUrl = resolveRemoteExtensionIconUrl(
          s.icon,
          fullPkg,
          effectiveRepoUrl,
        );

        return {
          pkg: fullPkg,
          catalogKey: s.catalogKey || `${effectiveRepoUrl}::${fullPkg}`,
          name: s.name,
          lang: s.lang || s.language || "all",
          icon: iconUrl,
          version: s.version || "0.0.0",
          baseUrl: s.baseUrl || s.url || "",
          nsfw: !!s.nsfw,
          repoUrl: effectiveRepoUrl,
          repoName: s.repoName || meta.repoName,
          repoColor: s.repoColor || meta.repoColor,
          isKeiyoushi: Boolean(s.isKeiyoushi || meta.isKeiyoushi),
          status: s.status,
          isFullySupported:
            s.isFullySupported !== undefined ? s.isFullySupported : undefined,
        };
      });
      return { ok: true, value };
    },
    selectDirectory: async () => {
      return { ok: false, error: "Not supported on mobile" };
    },
  },

  plugins: {
    getAll: async () => ({ ok: true, value: [] }),
    toggle: async () => ({ ok: true, value: undefined }),
    install: async () => ({ ok: true, value: undefined }),
    uninstall: async () => ({ ok: true, value: undefined }),
  },

  trackers: {
    getByManga: async (mangaId: string) => MobileDB.getTrackers(mangaId),
    save: async (tracker: any) => MobileDB.saveTracker(tracker),
    delete: async (args: { mangaId: string; provider: string }) =>
      MobileDB.deleteTracker(args.mangaId, args.provider),
    authAniList: async () => ({ ok: false, error: "Not supported on mobile" }),
    getUserAniList: async () => ({
      ok: false,
      error: "Not supported on mobile",
    }),
    setTokenAniList: async () => ({
      ok: false,
      error: "Not supported on mobile",
    }),
    logoutAniList: async () => ({ ok: true, value: undefined }),
    searchAniList: async () => ({ ok: true, value: [] }),
    getMediaAniList: async () => ({ ok: true, value: null }),
    updateAniList: async () => ({
      ok: false,
      error: "Not supported on mobile",
    }),
    processQueue: async () => ({
      ok: true,
      value: { processed: 0, succeeded: 0, failed: 0 },
    }),
    getSkipTimes: async (args: any) => {
      const { skipTimesService } =
        await import("@common/services/skipTimes.service");
      const result = await skipTimesService.getSkipTimes(args);
      return { ok: true, value: result };
    },
  },

  setStreamHeaders: async (_args: {
    url: string;
    headers: Record<string, string>;
  }) => {
    return { ok: true, value: true };
  },

  probeStream: async (args: {
    url: string;
    headers?: Record<string, string>;
    timeoutMs?: number;
  }) => {
    const startTime = Date.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        args.timeoutMs || 4000,
      );
      const res = await fetch(args.url, {
        method: "HEAD",
        headers: args.headers,
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const pingMs = Date.now() - startTime;
      return {
        ok: true,
        value: {
          alive: res.ok || res.status < 400,
          status: res.status,
          pingMs,
        },
      };
    } catch (e: any) {
      return {
        ok: true,
        value: {
          alive: false,
          status: 0,
          pingMs: Date.now() - startTime,
          error: e.message || String(e),
        },
      };
    }
  },

  backup: {
    export: async () => MobileBackup.exportBackup(),
    import: async () => MobileBackup.importBackup(),
  },

  discord: {
    setActivity: async () => ({
      ok: true,
      value: {
        enabled: false,
        connected: false,
        hasClientId: false,
        clientId: "",
        lastError: "Discord Rich Presence is only supported on Desktop",
        activeDetails: null,
      },
    }),
    clear: async () => ({
      ok: true,
      value: {
        enabled: false,
        connected: false,
        hasClientId: false,
        clientId: "",
        lastError: null,
        activeDetails: null,
      },
    }),
    getStatus: async () => ({
      ok: true,
      value: {
        enabled: false,
        connected: false,
        hasClientId: false,
        clientId: "",
        lastError: "Discord Rich Presence is only supported on Desktop",
        activeDetails: null,
      },
    }),
  },

  platform: "android",
  version: Constants.expoConfig?.version || "1.0.0",
};
