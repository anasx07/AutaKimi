import { vars, useColorScheme } from "nativewind";

export const LIGHT_COLORS = {
  background: "#f8f8fa",
  foreground: "#09090b",
  card: "#ffffff",
  cardForeground: "#09090b",
  secondary: "#efeff2",
  muted: "#efeff2",
  mutedForeground: "#71717a",
  border: "#e2e2e6",
  primary: "#e11d48",
} as const;

export const DARK_COLORS = {
  background: "#09090b",
  foreground: "#fafafa",
  card: "#111113",
  cardForeground: "#fafafa",
  secondary: "#222225",
  muted: "#1d1d20",
  mutedForeground: "#a1a1aa",
  border: "#27272a",
  primary: "#e11d48",
} as const;

export const LIGHT_THEME_VARS = vars({
  "--background": "240 5% 97.5%",
  "--foreground": "240 10% 3.9%",
  "--card": "0 0% 100%",
  "--card-foreground": "240 10% 3.9%",
  "--popover": "0 0% 100%",
  "--popover-foreground": "240 10% 3.9%",
  "--primary": "346.8 77.2% 49.8%",
  "--primary-foreground": "0 0% 100%",
  "--secondary": "240 4.8% 94%",
  "--secondary-foreground": "240 5.9% 10%",
  "--muted": "240 4.8% 94%",
  "--muted-foreground": "240 3.8% 46.1%",
  "--accent": "240 4.8% 94%",
  "--accent-foreground": "240 5.9% 10%",
  "--destructive": "0 84.2% 60.2%",
  "--destructive-foreground": "0 0% 98%",
  "--border": "240 5.9% 89%",
  "--input": "240 5.9% 89%",
  "--ring": "346.8 77.2% 49.8%",
});

export const DARK_THEME_VARS = vars({
  "--background": "240 10% 3.9%",
  "--foreground": "0 0% 98%",
  "--card": "240 6% 7%",
  "--card-foreground": "0 0% 98%",
  "--popover": "240 6% 9%",
  "--popover-foreground": "0 0% 98%",
  "--primary": "346.8 77.2% 52%",
  "--primary-foreground": "0 0% 100%",
  "--secondary": "240 4% 14%",
  "--secondary-foreground": "0 0% 98%",
  "--muted": "240 4% 12%",
  "--muted-foreground": "240 5% 64.9%",
  "--accent": "240 4% 14%",
  "--accent-foreground": "0 0% 98%",
  "--destructive": "0 62.8% 36%",
  "--destructive-foreground": "0 0% 98%",
  "--border": "240 4% 16%",
  "--input": "240 4% 16%",
  "--ring": "346.8 77.2% 52%",
});

export function useAppTheme() {
  const { colorScheme, setColorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  return {
    colorScheme: isDark ? ("dark" as const) : ("light" as const),
    isDark,
    setColorScheme,
    themeVars: isDark ? DARK_THEME_VARS : LIGHT_THEME_VARS,
    themeClassName: isDark ? "dark" : "",
    palette: isDark ? DARK_COLORS : LIGHT_COLORS,
  };
}
