import { describe, it, expect } from "vitest";
import {
  clampEyeCareValue,
  computeEyeCareOverlay,
  EYE_CARE_PRESETS,
  isEyeCareTintPreset,
  MAX_EYE_CARE_DIMMING,
  MAX_EYE_CARE_WARMTH,
} from "@common/utils/eyeCare";
import { SettingsMapper } from "../apps/desktop/src/renderer/src/shared/lib/settings.mapper";

describe("Night Eye-Care Filter (Kindle)", () => {
  it("returns inactive null overlays when disabled", () => {
    expect(
      computeEyeCareOverlay({
        enabled: false,
        tint: "sepia",
        warmth: 60,
        dimming: 45,
      }),
    ).toEqual({
      active: false,
      tintBackgroundColor: null,
      dimBackgroundColor: null,
      tintAlpha: 0,
      dimAlpha: 0,
    });
  });

  it("computes sepia tint and dimming overlays for Desktop multiply and Mobile alpha modes", () => {
    const [r, g, b] = EYE_CARE_PRESETS.sepia.rgb;

    const desktopOverlay = computeEyeCareOverlay(
      { enabled: true, tint: "sepia", warmth: 50, dimming: 40 },
      "multiply",
    );
    expect(desktopOverlay.active).toBe(true);
    expect(desktopOverlay.tintAlpha).toBe(0.275);
    expect(desktopOverlay.dimAlpha).toBe(0.4);
    expect(desktopOverlay.tintBackgroundColor).toBe(
      `rgba(${r}, ${g}, ${b}, 0.275)`,
    );
    expect(desktopOverlay.dimBackgroundColor).toBe("rgba(0, 0, 0, 0.4)");

    const mobileOverlay = computeEyeCareOverlay(
      { enabled: true, tint: "sepia", warmth: 50, dimming: 40 },
      "alpha",
    );
    expect(mobileOverlay.active).toBe(true);
    expect(mobileOverlay.tintAlpha).toBe(0.17);
    expect(mobileOverlay.dimAlpha).toBe(0.4);
    expect(mobileOverlay.tintBackgroundColor).toBe(
      `rgba(${r}, ${g}, ${b}, 0.17)`,
    );
    expect(mobileOverlay.dimBackgroundColor).toBe("rgba(0, 0, 0, 0.4)");
  });

  it("omits color tint overlay when preset is dim-only", () => {
    const overlay = computeEyeCareOverlay({
      enabled: true,
      tint: "dim",
      warmth: 80,
      dimming: 50,
    });
    expect(overlay.active).toBe(true);
    expect(overlay.tintAlpha).toBe(0);
    expect(overlay.tintBackgroundColor).toBeNull();
    expect(overlay.dimAlpha).toBe(0.5);
    expect(overlay.dimBackgroundColor).toBe("rgba(0, 0, 0, 0.5)");
  });

  it("clamps warmth (0..100) and dimming (0..80) safely and treats both-zero as inactive", () => {
    expect(clampEyeCareValue(150, 0, MAX_EYE_CARE_WARMTH)).toBe(100);
    expect(clampEyeCareValue(-10, 0, MAX_EYE_CARE_WARMTH)).toBe(0);
    expect(clampEyeCareValue(95, 0, MAX_EYE_CARE_DIMMING)).toBe(80);
    expect(clampEyeCareValue(Number.NaN, 0, MAX_EYE_CARE_DIMMING)).toBe(0);

    const clamped = computeEyeCareOverlay({
      enabled: true,
      tint: "amber",
      warmth: 200,
      dimming: 100,
    });
    expect(clamped.tintAlpha).toBe(0.55);
    expect(clamped.dimAlpha).toBe(0.8);

    const zeroed = computeEyeCareOverlay({
      enabled: true,
      tint: "warm",
      warmth: 0,
      dimming: 0,
    });
    expect(zeroed.active).toBe(false);
    expect(zeroed.tintBackgroundColor).toBeNull();
    expect(zeroed.dimBackgroundColor).toBeNull();
  });

  it("validates tint presets and maps persisted DB keys cleanly", () => {
    expect(isEyeCareTintPreset("warm")).toBe(true);
    expect(isEyeCareTintPreset("sepia")).toBe(true);
    expect(isEyeCareTintPreset("amber")).toBe(true);
    expect(isEyeCareTintPreset("dim")).toBe(true);
    expect(isEyeCareTintPreset("invalid")).toBe(false);

    const schema = SettingsMapper.toSchema({
      eye_care_enabled: "true",
      eye_care_tint: "amber",
      eye_care_warmth: "0",
      eye_care_dimming: "55",
    });
    expect(schema.reader.eyeCareEnabled).toBe(true);
    expect(schema.reader.eyeCareTint).toBe("amber");
    expect(schema.reader.eyeCareWarmth).toBe(0);
    expect(schema.reader.eyeCareDimming).toBe(55);
  });
});
