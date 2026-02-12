import { createContext, useMemo } from "react";
import { useColorScheme } from "react-native";
import type { ThemeMode, ThemeTokens } from "./tokens";
import { darkTokens, lightTokens } from "./tokens";

type ThemeContextValue = {
  mode: ThemeMode;
  tokens: ThemeTokens;
};

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const mode: ThemeMode = systemScheme === "light" ? "light" : "dark";

  const value = useMemo<ThemeContextValue>(() => {
    return { mode, tokens: mode === "dark" ? darkTokens : lightTokens };
  }, [mode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

