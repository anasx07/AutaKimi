import { describe, it, expect, vi } from "vitest";
import {
  ExtensionEngine,
  type IExtensionPlatform,
} from "../packages/sdk/src/engines/extension.engine";

function createMockPlatform(fetchImpl: IExtensionPlatform["fetch"]) {
  const upserted: any[] = [];
  const platform: IExtensionPlatform = {
    fetch: fetchImpl,
    runSandboxViaPool: vi.fn(),
    getSetting: vi.fn().mockResolvedValue("false"),
    upsertExtension: vi.fn(async (ext) => {
      upserted.push(ext);
    }),
  };
  return { platform, upserted };
}

describe("ExtensionEngine.install", () => {
  it("falls back to ext.code when remote JS fetch fails", async () => {
    const { platform, upserted } = createMockPlatform(
      vi.fn().mockRejectedValue(new Error("Network offline")),
    );
    const engine = new ExtensionEngine(platform);

    const localCode = 'module.exports = { id: "demo", search: async () => [] }';
    const result = await engine.install(
      {
        pkg: "ma.autakimi.extension.demo",
        name: "Demo",
        lang: "en",
        version: "1.2.0",
        code: localCode,
      },
      "local",
    );

    expect(result).toEqual({ success: true });
    expect(upserted).toHaveLength(1);
    expect(upserted[0].code).toBe(localCode);
    expect(upserted[0].version).toBe("1.2.0");
  });

  it("prefers fresh remote JS over ext.code when remote fetch succeeds", async () => {
    const remoteCode = 'module.exports = { id: "demo", version: "2.0.0" }';
    const { platform, upserted } = createMockPlatform(
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => remoteCode,
        json: async () => ({}),
      }),
    );
    const engine = new ExtensionEngine(platform);

    await engine.install(
      {
        pkg: "ma.autakimi.extension.demo",
        name: "Demo",
        lang: "en",
        version: "2.0.0",
        code: "module.exports = { stale: true }",
      },
      "https://example.com/templates.json",
    );

    expect(upserted).toHaveLength(1);
    expect(upserted[0].code).toBe(remoteCode);
  });
});
