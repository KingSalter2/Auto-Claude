export type ThemeMode = "light" | "dark";

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
    sm: any;
    md: any;
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
  background: "#000000",
  card: "#121212",
  border: "#27272a",
  primary: "#00E0FF", // Neon Cyan
  primaryForeground: "#000000",
  muted: "#1E1E1E",
  mutedForeground: "#A1A1AA",
  accent: "#FFFFFF",
  destructive: "#FF453A",
  destructiveForeground: "#FFFFFF",
};

