import { describe, it, expect } from "vitest";
import { getPagedNavigationAction } from "../apps/desktop/src/renderer/src/widgets/reader/hooks/useKeyboardControls";
import { calculateZoom } from "../apps/desktop/src/renderer/src/widgets/reader/hooks/useZoom";
import {
  buildDoublePageSpreads,
  getDoublePageSlot,
  getNextDoublePage,
  getPrevDoublePage,
  isWideSpreadDimensions,
} from "../apps/desktop/src/renderer/src/widgets/reader/lib/doublePageSpread";

describe("Paged Reader Keyboard Navigation Actions", () => {
  describe("Paged RTL & Double RTL", () => {
    const modes = ["paged-rtl", "paged-double-rtl"];

    for (const mode of modes) {
      it(`turns forward (next) on ArrowLeft, KeyA, PageDown, and Space in ${mode}`, () => {
        expect(
          getPagedNavigationAction(mode, {
            key: "ArrowLeft",
            code: "ArrowLeft",
          }),
        ).toBe("next");
        expect(getPagedNavigationAction(mode, { key: "a", code: "KeyA" })).toBe(
          "next",
        );
        expect(
          getPagedNavigationAction(mode, { key: "PageDown", code: "PageDown" }),
        ).toBe("next");
        expect(
          getPagedNavigationAction(mode, {
            key: " ",
            code: "Space",
            shiftKey: false,
          }),
        ).toBe("next");
      });

      it(`turns backward (prev) on ArrowRight, KeyD, PageUp, and Shift+Space in ${mode}`, () => {
        expect(
          getPagedNavigationAction(mode, {
            key: "ArrowRight",
            code: "ArrowRight",
          }),
        ).toBe("prev");
        expect(getPagedNavigationAction(mode, { key: "d", code: "KeyD" })).toBe(
          "prev",
        );
        expect(
          getPagedNavigationAction(mode, { key: "PageUp", code: "PageUp" }),
        ).toBe("prev");
        expect(
          getPagedNavigationAction(mode, {
            key: " ",
            code: "Space",
            shiftKey: true,
          }),
        ).toBe("prev");
      });
    }
  });

  describe("Paged LTR & Double LTR", () => {
    const modes = ["paged-ltr", "paged-double-ltr"];

    for (const mode of modes) {
      it(`turns forward (next) on ArrowRight, KeyD, PageDown, and Space in ${mode}`, () => {
        expect(
          getPagedNavigationAction(mode, {
            key: "ArrowRight",
            code: "ArrowRight",
          }),
        ).toBe("next");
        expect(getPagedNavigationAction(mode, { key: "d", code: "KeyD" })).toBe(
          "next",
        );
        expect(
          getPagedNavigationAction(mode, { key: "PageDown", code: "PageDown" }),
        ).toBe("next");
        expect(
          getPagedNavigationAction(mode, {
            key: " ",
            code: "Space",
            shiftKey: false,
          }),
        ).toBe("next");
      });

      it(`turns backward (prev) on ArrowLeft, KeyA, PageUp, and Shift+Space in ${mode}`, () => {
        expect(
          getPagedNavigationAction(mode, {
            key: "ArrowLeft",
            code: "ArrowLeft",
          }),
        ).toBe("prev");
        expect(getPagedNavigationAction(mode, { key: "a", code: "KeyA" })).toBe(
          "prev",
        );
        expect(
          getPagedNavigationAction(mode, { key: "PageUp", code: "PageUp" }),
        ).toBe("prev");
        expect(
          getPagedNavigationAction(mode, {
            key: " ",
            code: "Space",
            shiftKey: true,
          }),
        ).toBe("prev");
      });
    }
  });

  describe("Paged Vertical", () => {
    it("turns forward (next) on ArrowDown, KeyS, ArrowRight, PageDown, Space", () => {
      expect(
        getPagedNavigationAction("paged-vertical", {
          key: "ArrowDown",
          code: "ArrowDown",
        }),
      ).toBe("next");
      expect(
        getPagedNavigationAction("paged-vertical", { key: "s", code: "KeyS" }),
      ).toBe("next");
      expect(
        getPagedNavigationAction("paged-vertical", {
          key: "ArrowRight",
          code: "ArrowRight",
        }),
      ).toBe("next");
      expect(
        getPagedNavigationAction("paged-vertical", {
          key: "PageDown",
          code: "PageDown",
        }),
      ).toBe("next");
    });

    it("turns backward (prev) on ArrowUp, KeyW, ArrowLeft, PageUp, Shift+Space", () => {
      expect(
        getPagedNavigationAction("paged-vertical", {
          key: "ArrowUp",
          code: "ArrowUp",
        }),
      ).toBe("prev");
      expect(
        getPagedNavigationAction("paged-vertical", { key: "w", code: "KeyW" }),
      ).toBe("prev");
      expect(
        getPagedNavigationAction("paged-vertical", {
          key: "ArrowLeft",
          code: "ArrowLeft",
        }),
      ).toBe("prev");
      expect(
        getPagedNavigationAction("paged-vertical", {
          key: "PageUp",
          code: "PageUp",
        }),
      ).toBe("prev");
    });
  });

  describe("Continuous & Webtoon Modes", () => {
    it("returns null for non-paged modes so auto-scroll shortcuts remain unaffected", () => {
      expect(
        getPagedNavigationAction("webtoon", {
          key: "ArrowRight",
          code: "ArrowRight",
        }),
      ).toBeNull();
      expect(
        getPagedNavigationAction("continuous-vertical", {
          key: "ArrowLeft",
          code: "ArrowLeft",
        }),
      ).toBeNull();
      expect(
        getPagedNavigationAction("continuous-ltr", {
          key: "ArrowDown",
          code: "ArrowDown",
        }),
      ).toBeNull();
      expect(
        getPagedNavigationAction("continuous-rtl", {
          key: "ArrowUp",
          code: "ArrowUp",
        }),
      ).toBeNull();
      expect(
        getPagedNavigationAction(undefined, {
          key: "ArrowRight",
          code: "ArrowRight",
        }),
      ).toBeNull();
    });
  });
});

describe("Zoom Calculations", () => {
  it("increments and decrements zoom level cleanly with step", () => {
    expect(calculateZoom(1, 0.1)).toBe(1.1);
    expect(calculateZoom(1.1, 0.1)).toBe(1.2);
    expect(calculateZoom(1, -0.1)).toBe(0.9);
    expect(calculateZoom(0.9, -0.1)).toBe(0.8);
  });

  it("clamps zoom within minZoom and maxZoom", () => {
    expect(calculateZoom(0.5, -0.1, 0.5, 4)).toBe(0.5);
    expect(calculateZoom(4.0, 0.2, 0.5, 4)).toBe(4.0);
  });
});

describe("Smart Wide-Spread Detection (Double-Page Mode)", () => {
  const portrait = { width: 800, height: 1200 };
  const square = { width: 1000, height: 1000 };
  const wide = { width: 1600, height: 1100 };

  it("detects wide double-page spreads strictly when naturalWidth > naturalHeight", () => {
    expect(isWideSpreadDimensions(wide)).toBe(true);
    expect(isWideSpreadDimensions(portrait)).toBe(false);
    expect(isWideSpreadDimensions(square)).toBe(false);
    expect(isWideSpreadDimensions({ width: 0, height: 100 })).toBe(false);
    expect(isWideSpreadDimensions(undefined)).toBe(false);
  });

  it("pairs normal pages after cover and isolates wide spreads alone", () => {
    expect(buildDoublePageSpreads(8, { 4: wide })).toEqual([
      [1],
      [2, 3],
      [4],
      [5, 6],
      [7, 8],
    ]);
  });

  it("keeps the preceding normal page solo so the next wide spread is not split or paired", () => {
    expect(
      buildDoublePageSpreads(8, {
        2: portrait,
        3: portrait,
        4: portrait,
        5: wide,
      }),
    ).toEqual([[1], [2, 3], [4], [5], [6, 7], [8]]);
  });

  it("handles consecutive wide spreads without skipping any pages", () => {
    expect(buildDoublePageSpreads(6, { 3: wide, 4: wide })).toEqual([
      [1],
      [2],
      [3],
      [4],
      [5, 6],
    ]);
    expect(buildDoublePageSpreads(0)).toEqual([]);
  });

  it("resolves active spread slot and wide flag for single, paired, and scrubbed pages", () => {
    const dims = { 3: wide, 4: portrait, 5: portrait };
    expect(getDoublePageSlot(6, 1, dims)).toEqual({
      pages: [1],
      spreadIndex: 0,
      isWideSpread: false,
    });
    expect(getDoublePageSlot(6, 2, dims)).toEqual({
      pages: [2],
      spreadIndex: 1,
      isWideSpread: false,
    });
    expect(getDoublePageSlot(6, 3, dims)).toEqual({
      pages: [3],
      spreadIndex: 2,
      isWideSpread: true,
    });
    // Scrubbing to the 2nd page of a pair still resolves the pair [4, 5]
    expect(getDoublePageSlot(6, 5, dims)).toEqual({
      pages: [4, 5],
      spreadIndex: 3,
      isWideSpread: false,
    });
  });

  it("navigates forward and backward cleanly across wide spreads", () => {
    const dims = { 5: wide };
    // Forward from 1 -> 2 -> 4 -> 5 -> 6 -> 8 -> 8
    expect(getNextDoublePage(8, 1, dims)).toBe(2);
    expect(getNextDoublePage(8, 2, dims)).toBe(4);
    expect(getNextDoublePage(8, 4, dims)).toBe(5);
    expect(getNextDoublePage(8, 5, dims)).toBe(6);
    expect(getNextDoublePage(8, 6, dims)).toBe(8);
    expect(getNextDoublePage(8, 8, dims)).toBe(8);

    // Backward from 8 -> 6 -> 5 -> 4 -> 2 -> 1 -> 1
    expect(getPrevDoublePage(8, 8, dims)).toBe(6);
    expect(getPrevDoublePage(8, 7, dims)).toBe(5);
    expect(getPrevDoublePage(8, 6, dims)).toBe(5);
    expect(getPrevDoublePage(8, 5, dims)).toBe(4);
    expect(getPrevDoublePage(8, 4, dims)).toBe(2);
    expect(getPrevDoublePage(8, 2, dims)).toBe(1);
    expect(getPrevDoublePage(8, 1, dims)).toBe(1);
  });
});
