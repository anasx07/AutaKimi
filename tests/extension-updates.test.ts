import { describe, it, expect } from "vitest";
import { computeAvailableUpdates } from "../apps/desktop/src/renderer/src/entities/extension/lib/updates";
import type { ExtensionMetadata } from "../apps/desktop/src/renderer/src/shared/model/extension.store";

describe("computeAvailableUpdates", () => {
  it("returns the remote catalog metadata (with remote version & no stale code) for outdated extensions", () => {
    const installed: ExtensionMetadata[] = [
      {
        pkg: "ma.autakimi.extension.example",
        name: "Example",
        lang: "en",
        version: "0.0.1",
        baseUrl: "https://old.example.com",
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
        repoUrl: "https://repo.example.com/templates.json",
      },
    ];

    const updates = computeAvailableUpdates(installed, catalog);
    expect(updates).toHaveLength(1);
    expect(updates[0].version).toBe("0.0.2");
    expect(updates[0].baseUrl).toBe("https://new.example.com");
    expect(updates[0].repoUrl).toBe("https://repo.example.com/templates.json");
    expect(updates[0].code).toBeUndefined();

    // Once installedExtensions is updated with the new version, updates should clear immediately
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
