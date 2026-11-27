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

  it("rewrites autakimi-cache://local-icon URLs against repo base or official CDN", () => {
    expect(
      resolveRemoteExtensionIconUrl(
        "autakimi-cache://local-icon/ar.ristoanime.png",
        "ar.ristoanime",
        "https://raw.githubusercontent.com/Autakimi-Ecosystem/autakimi-extensions/main/dist/manifest.json",
      ),
    ).toBe(
      "https://raw.githubusercontent.com/Autakimi-Ecosystem/autakimi-extensions/main/dist/icons/ar.ristoanime.png",
    );

    expect(
      resolveRemoteExtensionIconUrl(
        "autakimi-cache://local-icon/ma.autakimi.extension.ar.witanime.png",
        "ar.witanime",
        "local",
      ),
    ).toBe(
      "https://raw.githubusercontent.com/Autakimi-Ecosystem/autakimi-extensions/main/dist/icons/ma.autakimi.extension.ar.witanime.png",
    );
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
