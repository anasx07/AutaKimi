import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  computeAvailableUpdates,
  findInstalledMatch,
  resolveInstallPayload,
} from "../apps/desktop/src/renderer/src/entities/extension/lib/updates";
import type { ExtensionMetadata } from "../apps/desktop/src/renderer/src/shared/model/extension.store";
import {
  buildCatalogKey,
  extractBasePkg,
  getRepoMeta,
  normalizeRepoKey,
  resolveExtensionBadge,
} from "../packages/sdk/src/services/repoIdentity";
import { SourceService } from "../packages/sdk/src/services/source.service";
import { networkClient } from "../packages/sdk/src/services/network";

describe("computeAvailableUpdates", () => {
  it("returns the remote catalog metadata (with remote version & no stale code) for outdated extensions", () => {
    const installed: ExtensionMetadata[] = [
      {
        pkg: "ma.autakimi.extension.example",
        name: "Example",
        lang: "en",
        version: "0.0.1",
        baseUrl: "https://old.example.com",
        repoUrl:
          "https://community.autakimi.example/dist/manifest.json",
        code: "/* stale code */",
      },
    ];
    const catalog: ExtensionMetadata[] = [
      {
        pkg: "ma.autakimi.extension.example",
        name: "Example",
        lang: "en",
        version: "0.0.2",
        baseUrl: "https://new.example.com",
        repoUrl:
          "https://community.autakimi.example/dist/manifest.json",
      },
    ];

    const updates = computeAvailableUpdates(installed, catalog);
    expect(updates).toHaveLength(1);
    expect(updates[0].version).toBe("0.0.2");
    expect(updates[0].baseUrl).toBe("https://new.example.com");
    expect(updates[0].repoColor).toBe("#10b981");
    expect(updates[0].code).toBeUndefined();

    const afterUpdate: ExtensionMetadata[] = [
      { ...installed[0], version: updates[0].version },
    ];
    expect(computeAvailableUpdates(afterUpdate, catalog)).toEqual([]);
  });

  it("uses semver comparison so newer local versions or matching versions are not flagged", () => {
    const installed: ExtensionMetadata[] = [
      { pkg: "ext.equal", name: "Equal", lang: "en", version: "1.0.2" },
      { pkg: "ext.newer", name: "Newer", lang: "en", version: "1.0.10" },
      { pkg: "ext.older", name: "Older", lang: "en", version: "1.0.2" },
    ];
    const catalog: ExtensionMetadata[] = [
      { pkg: "ext.equal", name: "Equal", lang: "en", version: "1.0.2" },
      { pkg: "ext.newer", name: "Newer", lang: "en", version: "1.0.9" },
      { pkg: "ext.older", name: "Older", lang: "en", version: "1.0.10" },
    ];

    const updates = computeAvailableUpdates(installed, catalog);
    expect(updates.map((u) => u.pkg)).toEqual(["ext.older"]);
    expect(updates[0].version).toBe("1.0.10");
  });

  it("matches catalog entries by id when pkg differs and preserves installed pkg", () => {
    const installed: ExtensionMetadata[] = [
      { pkg: "custom-pkg", name: "Custom", lang: "ar", version: "1.0.0" },
    ];
    const catalog = [
      {
        id: "custom-pkg",
        pkg: "other-pkg",
        name: "Custom",
        lang: "ar",
        version: "1.1.0",
      },
    ] as unknown as ExtensionMetadata[];

    const updates = computeAvailableUpdates(installed, catalog);
    expect(updates).toHaveLength(1);
    expect(updates[0].pkg).toBe("custom-pkg");
    expect(updates[0].version).toBe("1.1.0");
  });
});

describe("Multi-repo Option A isolation & coexistence", () => {
  const repoAutakimi =
    "https://community.autakimi.example/dist/manifest.json";
  const repoKeiyoushi =
    "https://raw.githubusercontent.com/keiyoushi/extensions/repo/index.min.json";

  it("prevents version conflicts between two repos that share the same pkg", () => {
    const catalog: ExtensionMetadata[] = [
      {
        pkg: "ar.teamx",
        name: "Team-X",
        lang: "ar",
        version: "0.0.5",
        baseUrl: "https://teamx.com",
        icon: "",
        repoUrl: repoAutakimi,
      },
      {
        pkg: "ar.teamx",
        name: "Team-X",
        lang: "ar",
        version: "14.8.2",
        baseUrl: "https://teamx.com",
        icon: "",
        repoUrl: repoKeiyoushi,
      },
    ];

    // User installed Team-X from AutaKimi at latest 0.0.5
    const installed: ExtensionMetadata[] = [
      {
        pkg: "ar.teamx",
        name: "Team-X",
        lang: "ar",
        version: "0.0.5",
        baseUrl: "https://teamx.com",
        icon: "",
        repoUrl: repoAutakimi,
      },
    ];

    // Must NOT flag a false update to Keiyoushi's 14.8.2!
    expect(computeAvailableUpdates(installed, catalog)).toEqual([]);
  });

  it("scopes the second repo pkg when installing the same pkg from a second repository (Option A)", () => {
    const keiyoushiExt: ExtensionMetadata = {
      pkg: "ar.teamx",
      name: "Team-X",
      lang: "ar",
      version: "14.8.2",
      baseUrl: "https://teamx.com",
      icon: "https://cdn.keiyoushi/icon.png",
      repoUrl: repoKeiyoushi,
    };

    const autakimiExt: ExtensionMetadata = {
      pkg: "ar.teamx",
      name: "Team-X",
      lang: "ar",
      version: "0.0.5",
      baseUrl: "https://teamx.com",
      icon: "",
      repoUrl: repoAutakimi,
    };

    // 1. Install AutaKimi copy first -> keeps un-scoped base pkg
    const firstPayload = resolveInstallPayload(autakimiExt, []);
    expect(firstPayload.pkg).toBe("ar.teamx");

    const installedAfterFirst: ExtensionMetadata[] = [firstPayload];

    // 2. Install Keiyoushi copy while AutaKimi is installed -> gets scoped pkg::hash
    const secondPayload = resolveInstallPayload(
      keiyoushiExt,
      installedAfterFirst,
    );
    expect(secondPayload.pkg).not.toBe("ar.teamx");
    expect(secondPayload.pkg.startsWith("ar.teamx::")).toBe(true);
    expect(extractBasePkg(secondPayload.pkg)).toBe("ar.teamx");
    expect(secondPayload.repoColor).toBe("#a855f7");
    expect(secondPayload.repoName).toBe("Keiyoushi");

    // 3. Updating the Keiyoushi copy preserves its scoped pkg and resolves match per repo
    const installedBoth = [...installedAfterFirst, secondPayload];
    expect(findInstalledMatch(autakimiExt, installedBoth)?.pkg).toBe(
      "ar.teamx",
    );
    expect(findInstalledMatch(keiyoushiExt, installedBoth)?.pkg).toBe(
      secondPayload.pkg,
    );

    const newerKeiyoushi: ExtensionMetadata = {
      ...keiyoushiExt,
      version: "14.9.0",
    };
    const updates = computeAvailableUpdates(installedBoth, [
      autakimiExt,
      newerKeiyoushi,
    ]);
    expect(updates).toHaveLength(1);
    expect(updates[0].pkg).toBe(secondPayload.pkg);
    expect(updates[0].version).toBe("14.9.0");
  });

  it("produces consistent repo identity colors and normalizes equivalent manifest/index URLs", () => {
    expect(normalizeRepoKey(repoKeiyoushi)).toBe(
      normalizeRepoKey(
        "https://raw.githubusercontent.com/keiyoushi/extensions/repo/index.json",
      ),
    );
    expect(buildCatalogKey("ar.teamx::abc123", repoKeiyoushi)).toBe(
      buildCatalogKey(
        "ar.teamx",
        "https://raw.githubusercontent.com/keiyoushi/extensions/repo/index.json",
      ),
    );

    const custom1 = getRepoMeta("https://repo-one.example.org/manifest.json");
    const custom2 = getRepoMeta("https://repo-two.example.org/manifest.json");
    expect(custom1.repoColor).toMatch(/^#[0-9a-f]{6}$/i);
    expect(custom2.repoColor).toMatch(/^#[0-9a-f]{6}$/i);
    expect(getRepoMeta(repoAutakimi).repoColor).toBe("#10b981");
    expect(getRepoMeta(repoKeiyoushi).repoColor).toBe("#a855f7");
  });
});

describe("SourceService multi-repo key isolation", () => {
  beforeEach(() => {
    SourceService.getInstance().clear();
    vi.restoreAllMocks();
  });

  it("keeps same-id extensions from two different repos separate without overwriting", async () => {
    const fetchSpy = vi
      .spyOn(networkClient, "fetch")
      .mockImplementation(async (url: string) => {
        if (url.includes("repo-a")) {
          return {
            ok: true,
            value: {
              ok: true,
              status: 200,
              headers: new Headers({ "content-type": "application/json" }),
              json: async () => [
                {
                  id: "ar.teamx",
                  pkg: "ar.teamx",
                  name: "Team-X",
                  lang: "ar",
                  version: "1.0.0",
                },
              ],
            },
          } as any;
        }
        return {
          ok: true,
          value: {
            ok: true,
            status: 200,
            headers: new Headers({ "content-type": "application/json" }),
            json: async () => [
              {
                id: "ar.teamx",
                pkg: "ar.teamx",
                name: "Team-X",
                lang: "ar",
                version: "2.5.0",
              },
            ],
          },
        } as any;
      });

    const svc = SourceService.getInstance();
    await svc.fetchCatalog("https://repo-a.example/ar.json", "manga", {
      repoUrl: "https://repo-a.example/manifest.json",
      repoName: "Repo A",
      repoColor: "#3b82f6",
    });
    await svc.fetchCatalog("https://repo-b.example/ar.json", "manga", {
      repoUrl: "https://repo-b.example/manifest.json",
      repoName: "Repo B",
      repoColor: "#ec4899",
    });

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    const all = svc.getAllSources("manga");
    expect(all).toHaveLength(2);
    expect(all.map((s) => `${s.repoName}:${s.version}`)).toEqual([
      "Repo A:1.0.0",
      "Repo B:2.5.0",
    ]);
  });
});

describe("resolveExtensionBadge", () => {
  it("resolves extension display name and repo color from installed extensions including scoped pkgs", () => {
    const installed = [
      {
        pkg: "ma.autakimi.extension.ar.witanime",
        name: "WitAnime",
        repoUrl:
          "https://community.autakimi.example/dist/manifest.json",
      },
      {
        pkg: "ar.teamx::abcdef",
        name: "Team-X",
        repoColor: "#a855f7",
      },
    ];

    expect(
      resolveExtensionBadge("ma.autakimi.extension.ar.witanime", installed),
    ).toEqual({
      name: "WitAnime",
      color: "#10b981",
    });
    expect(resolveExtensionBadge("ar.teamx::abcdef", installed)).toEqual({
      name: "Team-X",
      color: "#a855f7",
    });
  });

  it("derives a readable fallback name when the extension is uninstalled", () => {
    expect(
      resolveExtensionBadge("ma.autakimi.extension.ar.anime-lek", []),
    ).toEqual({
      name: "Anime Lek",
      color: undefined,
    });
    expect(resolveExtensionBadge("", [])).toBeNull();
  });
});
