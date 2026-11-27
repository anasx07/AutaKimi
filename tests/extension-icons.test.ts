import { describe, it, expect } from "vitest";
import { resolveRemoteExtensionIconUrl } from "../packages/sdk/src/services/repoIdentity";

describe("resolveRemoteExtensionIconUrl", () => {
  it("preserves explicit HTTP(S) icon URLs", () => {
    expect(
      resolveRemoteExtensionIconUrl(
        "https://cdn.example.com/icon.png",
        "en.demo",
        "https://example.com/manifest.json",
      ),
    ).toBe("https://cdn.example.com/icon.png");
  });

  it("rewrites autakimi-cache://local-icon URLs against repoUrl or configured HTTP repos", () => {
    expect(
      resolveRemoteExtensionIconUrl(
        "autakimi-cache://local-icon/ar.ristoanime.png",
        "ar.ristoanime",
        "https://repo.example.com/dist/manifest.json",
      ),
    ).toBe("https://repo.example.com/dist/icons/ar.ristoanime.png");

    expect(
      resolveRemoteExtensionIconUrl(
        "autakimi-cache://local-icon/ma.autakimi.extension.ar.witanime.png",
        "ar.witanime",
        "local",
        ["https://configured.example.org/manifest.json"],
      ),
    ).toBe(
      "https://configured.example.org/icons/ma.autakimi.extension.ar.witanime.png",
    );

    expect(
      resolveRemoteExtensionIconUrl(
        "autakimi-cache://local-icon/ma.autakimi.extension.ar.witanime.png",
        "ar.witanime",
        "local",
      ),
    ).toBe("");
  });

  it("derives HTTPS icon URLs from scoped pkg when icon is missing", () => {
    expect(
      resolveRemoteExtensionIconUrl(
        "",
        "ar.lekmanga::abc123",
        "https://custom.example.com/repo/manifest.json",
      ),
    ).toBe(
      "https://custom.example.com/repo/icons/ma.autakimi.extension.ar.lekmanga.png",
    );
  });
});
