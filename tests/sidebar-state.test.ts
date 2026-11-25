import { describe, it, expect } from "vitest";
import { resolveSidebarCollapsedState } from "../apps/desktop/src/renderer/src/app/components/sidebarState";

describe("resolveSidebarCollapsedState", () => {
  it("follows normal user preference outside watch mode", () => {
    expect(
      resolveSidebarCollapsedState({
        userPrefCollapsed: false,
        autoCollapsed: false,
        watchOverride: null,
      }),
    ).toBe(false);

    expect(
      resolveSidebarCollapsedState({
        userPrefCollapsed: true,
        autoCollapsed: false,
        watchOverride: null,
      }),
    ).toBe(true);
  });

  it("auto-collapses during inline watch mode unless explicitly overridden mid-watch", () => {
    expect(
      resolveSidebarCollapsedState({
        userPrefCollapsed: false,
        autoCollapsed: true,
        watchOverride: null,
      }),
    ).toBe(true);

    expect(
      resolveSidebarCollapsedState({
        userPrefCollapsed: false,
        autoCollapsed: true,
        watchOverride: false,
      }),
    ).toBe(false);
  });
});
