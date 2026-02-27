import "react-native-url-polyfill/auto";
import "react-native-reanimated";

import { View, ActivityIndicator, Platform } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import * as Notifications from "expo-notifications";

import { AppThemeProvider } from "../src/theme/ThemeProvider";
import { AuthProvider, useAuth } from "../src/auth/AuthContext";
import { useTheme } from "../src/theme/useTheme";

export { ErrorBoundary } from "expo-router";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export const unstable_settings = {
  initialRouteName: "(auth)",
};

function AuthGate() {
  const { user, userProfile, isLoading, canAccess } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);
  const { tokens } = useTheme();
  const lastHandledNotificationIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
      sound: "default",
      enableVibrate: true,
      vibrationPattern: [0, 250, 250, 250],
    });
  }, []);

  const handleNotificationResponse = useCallback(
    (response: Notifications.NotificationResponse | null) => {
      if (!response) return;

      const notificationId = response.notification.request.identifier;
      if (notificationId && lastHandledNotificationIdRef.current === notificationId) return;
      if (notificationId) lastHandledNotificationIdRef.current = notificationId;

      const raw = response.notification.request.content.data as unknown;
      const data = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;

      const type = typeof data.type === "string" ? data.type : null;
      if (type === "lead") {
        const leadId = typeof data.leadId === "string" ? data.leadId : null;
        const canSeeLeads = canAccess("Leads & CRM");
        if (leadId && canSeeLeads) router.push(`/leads/${encodeURIComponent(leadId)}`);
      }
    },
    [canAccess, router],
  );

  useEffect(() => {
    if (!user || !userProfile) return;

    Notifications.getLastNotificationResponseAsync().then(handleNotificationResponse);

    const sub = Notifications.addNotificationResponseReceivedListener(handleNotificationResponse);
    return () => sub.remove();
  }, [handleNotificationResponse, user, userProfile]);

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === "(auth)";
    
    if (!user && !inAuthGroup) {
      router.replace("/(auth)/login");
    } else if (user && !userProfile && !inAuthGroup) {
      router.replace("/(auth)/login");
    } else if (user && userProfile && inAuthGroup) {
      router.replace("/(tabs)");
    }
    
    setIsReady(true);
  }, [isLoading, router, segments, user, userProfile]);

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
