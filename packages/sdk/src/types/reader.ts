export type ReadingMode =
  | "paged-ltr"
  | "paged-rtl"
  | "paged-double-ltr"
  | "paged-double-rtl"
  | "paged-vertical"
  | "continuous-ltr"
  | "continuous-rtl"
  | "continuous-vertical"
  | "webtoon";

export type EyeCareTintPreset = "warm" | "sepia" | "amber" | "dim";

export interface EyeCareConfig {
  enabled: boolean;
  tint: EyeCareTintPreset;
  /** 0 - 100 percentage intensity for the warm/sepia color tint */
  warmth: number;
  /** 0 - 80 percentage darkness for custom canvas dimming */
  dimming: number;
}

export interface ReaderShortcuts {
  pause: string;
  toggle: string;
  boost: string;
  slow: string;
  reverse: string;
}
