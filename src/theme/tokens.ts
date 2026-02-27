export type ThemeMode = "light" | "dark";

type ShadowToken = {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
  elevation: number;
};

export type ThemeTokens = {
  background: string;
  card: string;
  border: string;
  primary: string;
  primaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  destructive: string;
  destructiveForeground: string;
  radius: {
    sm: number;
    md: number;
    lg: number;
    xl: number;
    full: number;
  };
  shadow: {
    sm: ShadowToken;
    md: ShadowToken;
  };
};

const commonTokens = {
  radius: {
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    full: 9999,
  },
  shadow: {
    sm: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    md: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.15,
      shadowRadius: 16,
      elevation: 6,
    },
  },
};

export const lightTokens: ThemeTokens = {
  ...commonTokens,
  background: "#F2F4F7",
  card: "#FFFFFF",
  border: "#E4E7EC",
  primary: "#000000",
  primaryForeground: "#FFFFFF",
  muted: "#F2F4F7",
  mutedForeground: "#667085",
  accent: "#101828",
  destructive: "#EF4444",
  destructiveForeground: "#FFFFFF",
};

export const darkTokens: ThemeTokens = {
  ...commonTokens,
  background: "#09090b", // Deep Zinc Black
  card: "#18181b",       // Zinc-900
  border: "#27272a",     // Zinc-800
  primary: "#facc15",    // Vibrant Yellow
  primaryForeground: "#000000",
  muted: "#27272a",
  mutedForeground: "#a1a1aa",
  accent: "#ffffff",
  destructive: "#ef4444",
  destructiveForeground: "#FFFFFF",
};
