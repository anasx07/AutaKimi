import { describe, it, expect } from "vitest";
import {
  TabNavigationMemory,
  resolveBrowseNavTarget,
} from "../apps/desktop/src/renderer/src/app/components/navigationMemory";

describe("TabNavigationMemory & resolveBrowseNavTarget", () => {
  it("remembers /browse/:pkg across tab switches and steps back to /browse when clicked again", () => {
    const mem = new TabNavigationMemory();
    expect(mem.getLastBrowsePath()).toBe("/browse");

    mem.recordPath("/browse/ma.autakimi.extension.ar.ristoanime");
    expect(mem.getLastBrowsePath()).toBe(
      "/browse/ma.autakimi.extension.ar.ristoanime",
    );

    // Navigating away to /history should NOT forget the active browse sub-route
    mem.recordPath("/history");
    expect(mem.getLastBrowsePath()).toBe(
      "/browse/ma.autakimi.extension.ar.ristoanime",
    );

    // Returning from /history navigates back to RistoAnime source page
    expect(resolveBrowseNavTarget("/history", mem.getLastBrowsePath())).toBe(
      "/browse/ma.autakimi.extension.ar.ristoanime",
    );

    // Clicking Browse while already inside RistoAnime returns up to /browse root
    expect(
      resolveBrowseNavTarget(
        "/browse/ma.autakimi.extension.ar.ristoanime",
        mem.getLastBrowsePath(),
      ),
    ).toBe("/browse");
  });

  it("suspends and restores selectedManga and activeChapter per route cleanly", () => {
    const mem = new TabNavigationMemory();
    const manga = {
      id: "anime-1",
      title: "Ninja Kamui",
      url: "https://example.com/ninja",
      pkg: "ext.pkg",
      mediaType: "anime" as const,
    };
    const chapter = {
      id: "ep-1",
      title: "Episode 1",
      url: "https://example.com/ep1",
      number: 1,
    };

    mem.suspendOverlay("/browse/ext.pkg", {
      selectedManga: manga,
      activeChapter: chapter,
    });
    expect(mem.consumeOverlay("/history")).toBeNull();

    const restored = mem.consumeOverlay("/browse/ext.pkg");
    expect(restored?.selectedManga.id).toBe("anime-1");
    expect(restored?.activeChapter?.id).toBe("ep-1");

    // Consumed once
    expect(mem.consumeOverlay("/browse/ext.pkg")).toBeNull();
  });
});
