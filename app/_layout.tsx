import "react-native-url-polyfill/auto";
import "react-native-reanimated";

import { View, ActivityIndicator } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect, useState } from "react";

import { AppThemeProvider } from "../src/theme/ThemeProvider";
import { AuthProvider, useAuth } from "../src/auth/AuthContext";
import { useTheme } from "../src/theme/useTheme";

export { ErrorBoundary } from "expo-router";

export const unstable_settings = {
  initialRouteName: "(auth)",
};

function AuthGate() {
  const { user, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);
  const { tokens } = useTheme();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === "(auth)";
    
    if (!user && !inAuthGroup) {
      router.replace("/(auth)/login");
    } else if (user && inAuthGroup) {
      router.replace("/(tabs)");
    }
    
    setIsReady(true);
  }, [isLoading, router, segments, user]);

  if (isLoading || !isReady) {
    return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: tokens.background }}>
            <ActivityIndicator size="large" color={tokens.primary} />
        </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="leads/[id]" />
      <Stack.Screen name="inventory/[id]" />
      <Stack.Screen name="inventory/edit/[id]" />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AppThemeProvider>
      <AuthProvider>
        <AuthGate />
      </AuthProvider>
    </AppThemeProvider>
  );
}
