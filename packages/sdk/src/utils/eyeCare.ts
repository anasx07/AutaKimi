import type { EyeCareConfig, EyeCareTintPreset } from "../types/reader";

export const MAX_EYE_CARE_WARMTH = 100;
export const MAX_EYE_CARE_DIMMING = 80;

export const DEFAULT_EYE_CARE_CONFIG: EyeCareConfig = {
  enabled: false,
  tint: "sepia",
  warmth: 45,
  dimming: 30,
};

export interface EyeCarePresetMeta {
  id: EyeCareTintPreset;
  label: string;
  rgb: readonly [number, number, number];
  swatchHex: string;
  defaultWarmth: number;
  defaultDimming: number;
}

export const EYE_CARE_PRESETS: Record<EyeCareTintPreset, EyeCarePresetMeta> = {
  warm: {
    id: "warm",
    label: "Warm",
    rgb: [255, 175, 90],
    swatchHex: "#FFAF5A",
    defaultWarmth: 40,
    defaultDimming: 20,
  },
  sepia: {
    id: "sepia",
    label: "Sepia",
    rgb: [214, 156, 78],
    swatchHex: "#D69C4E",
    defaultWarmth: 50,
    defaultDimming: 25,
  },
  amber: {
    id: "amber",
    label: "Night",
    rgb: [255, 128, 42],
    swatchHex: "#FF802A",
    defaultWarmth: 65,
    defaultDimming: 45,
  },
  dim: {
    id: "dim",
    label: "Dim Only",
    rgb: [0, 0, 0],
    swatchHex: "#27272A",
    defaultWarmth: 0,
    defaultDimming: 40,
  },
};

export function clampEyeCareValue(
  val: number,
  min: number,
  max: number,
): number {
  if (!Number.isFinite(val)) return min;
  return Math.max(min, Math.min(max, Math.round(val)));
}

export function isEyeCareTintPreset(val: unknown): val is EyeCareTintPreset {
  return val === "warm" || val === "sepia" || val === "amber" || val === "dim";
}

export interface EyeCareOverlayStyles {
  active: boolean;
  tintBackgroundColor: string | null;
  dimBackgroundColor: string | null;
  tintAlpha: number;
  dimAlpha: number;
}

/**
 * Computes pointer-transparent warm/sepia tint and screen dimming overlay colors
 * for the manga reader viewport without altering OS display brightness.
 *
 * - `"multiply"` mode (Desktop Chromium): uses stronger tint alpha with CSS
 *   `mix-blend-mode: multiply` so white paper becomes soft parchment while black ink stays crisp.
 * - `"alpha"` mode (React Native / Android): uses balanced translucent alpha for uniform
 *   standard alpha compositing across mobile devices.
 */
export function computeEyeCareOverlay(
  config: Partial<EyeCareConfig> | undefined,
  mode: "multiply" | "alpha" = "multiply",
): EyeCareOverlayStyles {
  if (!config?.enabled) {
    return {
      active: false,
      tintBackgroundColor: null,
      dimBackgroundColor: null,
      tintAlpha: 0,
      dimAlpha: 0,
    };
  }

  const tint: EyeCareTintPreset = isEyeCareTintPreset(config.tint)
    ? config.tint
    : DEFAULT_EYE_CARE_CONFIG.tint;
  const warmth = clampEyeCareValue(
    config.warmth ?? DEFAULT_EYE_CARE_CONFIG.warmth,
    0,
    MAX_EYE_CARE_WARMTH,
  );
  const dimming = clampEyeCareValue(
    config.dimming ?? DEFAULT_EYE_CARE_CONFIG.dimming,
    0,
    MAX_EYE_CARE_DIMMING,
  );

  const preset = EYE_CARE_PRESETS[tint];
  const maxTintAlpha = mode === "multiply" ? 0.55 : 0.34;
  const tintAlpha =
    tint !== "dim" && warmth > 0
      ? Number(((warmth / MAX_EYE_CARE_WARMTH) * maxTintAlpha).toFixed(3))
      : 0;
  const dimAlpha = dimming > 0 ? Number((dimming / 100).toFixed(3)) : 0;

  const [r, g, b] = preset.rgb;
  const tintBackgroundColor =
    tintAlpha > 0 ? `rgba(${r}, ${g}, ${b}, ${tintAlpha})` : null;
  const dimBackgroundColor = dimAlpha > 0 ? `rgba(0, 0, 0, ${dimAlpha})` : null;

  return {
    active: tintAlpha > 0 || dimAlpha > 0,
    tintBackgroundColor,
    dimBackgroundColor,
    tintAlpha,
    dimAlpha,
  };
}
