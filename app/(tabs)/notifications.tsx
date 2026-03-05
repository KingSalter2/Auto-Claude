import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "../../src/auth/AuthContext";
import { markNotificationRead, subscribeNotifications, type AppNotification } from "../../src/services/notificationService";

const THEME = {
  background: "#09090b",
  card: "#18181b",
  border: "#27272a",
  text: "#ffffff",
  textMuted: "#a1a1aa",
  primary: "#facc15",
};

export default function NotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { userProfile } = useAuth();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!userProfile?.email) {
      setItems([]);
      setLoadError(null);
      return;
    }
    setLoadError(null);
    return subscribeNotifications({
      recipientEmail: userProfile.email,
      take: 500,
      onNext: setItems,
      onError: (e) => {
        setItems([]);
        const msg =
          e && typeof e === "object" && "message" in e && typeof (e as { message?: unknown }).message === "string"
            ? String((e as { message: string }).message)
            : "Unable to load alerts.";
        setLoadError(msg);
      },
    });
  }, [userProfile?.email]);

  const unreadCount = useMemo(() => items.reduce((acc, n) => (n.read === true ? acc : acc + 1), 0), [items]);

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: THEME.background, paddingTop: insets.top },
    header: { paddingHorizontal: 20, paddingBottom: 16, paddingTop: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    headerLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
    headerTitle: { color: THEME.text, fontSize: 20, fontWeight: "800" },
    badge: {
      backgroundColor: THEME.primary,
      paddingHorizontal: 10,
      height: 26,
      borderRadius: 999,
      alignItems: "center",
      justifyContent: "center",
    },
    badgeText: { color: "#000", fontSize: 12, fontWeight: "900" },
    listContent: { paddingHorizontal: 16, paddingBottom: 120 },
    card: {
      backgroundColor: THEME.card,
      borderWidth: 1,
      borderColor: THEME.border,
      borderRadius: 18,
      padding: 14,
      marginBottom: 10,
      flexDirection: "row",
      gap: 12,
    },
    dot: { width: 10, height: 10, borderRadius: 999, marginTop: 4, backgroundColor: THEME.primary },
    dotRead: { backgroundColor: THEME.border },
    content: { flex: 1, minWidth: 0 },
    titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
    title: { color: THEME.text, fontSize: 15, fontWeight: "800", flex: 1 },
    time: { color: THEME.textMuted, fontSize: 12 },
    message: { color: THEME.textMuted, fontSize: 13, marginTop: 6 },
    empty: { padding: 24, alignItems: "center", justifyContent: "center" },
    emptyTitle: { color: THEME.text, fontSize: 16, fontWeight: "800", marginTop: 10 },
    emptyText: { color: THEME.textMuted, fontSize: 13, marginTop: 6, textAlign: "center" },
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="notifications" size={22} color={THEME.primary} />
          <Text style={styles.headerTitle}>Alerts</Text>
        </View>
        {unreadCount > 0 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unreadCount > 99 ? "99+" : String(unreadCount)}</Text>
          </View>
        ) : null}
      </View>

      <FlatList
        data={items}
        keyExtractor={(n) => n.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="checkmark-circle-outline" size={52} color={THEME.border} />
            <Text style={styles.emptyTitle}>No alerts</Text>
            <Text style={styles.emptyText}>
              {loadError ? loadError : "You’ll see notifications here for leads and inventory changes."}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const createdLabel = item.createdAt ? new Date(item.createdAt).toLocaleString() : "";
          const isRead = item.read === true;
          return (
            <Pressable
              onPress={() => {
                if (!isRead) {
                  void markNotificationRead(item.id).catch(() => {});
                }
                if (item.entityType === "lead_submission") {
                  router.push(`/leads/${item.entityId}`);
                  return;
                }
                if (item.entityType === "inventory") {
                  router.push(`/inventory/${item.entityId}`);
                  return;
                }
                if (item.entityType === "task") {
                  router.push(`/leads`);
                }
              }}
            >
              <View style={styles.card}>
                <View style={[styles.dot, isRead ? styles.dotRead : null]} />
                <View style={styles.content}>
                  <View style={styles.titleRow}>
                    <Text style={styles.title} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text style={styles.time} numberOfLines={1}>
                      {createdLabel}
                    </Text>
                  </View>
                  <Text style={styles.message} numberOfLines={2}>
                    {item.message}
                  </Text>
                </View>
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}
