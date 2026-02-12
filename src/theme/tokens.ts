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
};

export const lightTokens: ThemeTokens = {
  background: "#F8FAFC",
  card: "#FFFFFF",
  border: "#E2E8F0",
  primary: "#0EA5E9",
  primaryForeground: "#0B1220",
  muted: "#F1F5F9",
  mutedForeground: "#64748B",
  accent: "#111827",
  destructive: "#EF4444",
  destructiveForeground: "#FFFFFF",
};

export const darkTokens: ThemeTokens = {
  background: "#070A12",
  card: "#0B1220",
  border: "rgba(255,255,255,0.08)",
  primary: "#38BDF8",
  primaryForeground: "#0B1220",
  muted: "rgba(255,255,255,0.06)",
  mutedForeground: "rgba(255,255,255,0.7)",
  accent: "#FFFFFF",
  destructive: "#EF4444",
  destructiveForeground: "#FFFFFF",
};

