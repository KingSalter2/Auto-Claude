import { createContext, useMemo, useState } from "react";
import { useColorScheme } from "react-native";
import type { ThemeMode, ThemeTokens } from "./tokens";
import { darkTokens, lightTokens } from "./tokens";

type ThemeContextValue = {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  tokens: ThemeTokens;
};

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [manualMode, setManualMode] = useState<ThemeMode | null>("dark");

  const mode: ThemeMode = manualMode ?? "dark";

  const value = useMemo<ThemeContextValue>(() => {
    return {
      mode,
      setMode: setManualMode,
      tokens: mode === "dark" ? darkTokens : lightTokens
    };
  }, [mode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

