import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Tabs, useRouter } from "expo-router";
import { Animated, StyleSheet, View } from "react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";

import { useTheme } from "../../src/theme/useTheme";
import { subscribeAssignedLeads, subscribeNewLeadCount, subscribePendingFollowUps } from "../../src/services/leadService";
import { useAuth } from "../../src/auth/AuthContext";
import { subscribeNotifications, subscribeUnreadNotificationCount, upsertNotification } from "../../src/services/notificationService";

function TabIcon({
  name,
  color,
  badgeCount,
}: {
  name: React.ComponentProps<typeof FontAwesome>["name"];
  color: string;
  badgeCount?: number;
}) {
  const { tokens } = useTheme();
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!badgeCount || badgeCount <= 0) {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.4, duration: 650, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 650, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [badgeCount, pulse]);

  const styles = StyleSheet.create({
    wrap: { width: 28, height: 28, alignItems: "center", justifyContent: "center" },
    badge: {
      position: "absolute",
      top: -6,
      right: -10,
      minWidth: 18,
      height: 18,
      borderRadius: 999,
      backgroundColor: tokens.destructive,
      borderWidth: 1,
      borderColor: tokens.background,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 5,
    },
    badgeText: { color: tokens.destructiveForeground, fontSize: 11, fontWeight: "800" },
  });

  return (
    <View style={styles.wrap}>
      <FontAwesome size={22} name={name} color={color} />
      {badgeCount && badgeCount > 0 ? (
        <Animated.View style={[styles.badge, { opacity: pulse }]}>
          <Animated.Text style={styles.badgeText}>{badgeCount > 99 ? "99+" : String(badgeCount)}</Animated.Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

export default function TabLayout() {
  const { tokens } = useTheme();
  const router = useRouter();
  const { user, userProfile, canAccess } = useAuth();
  const [newLeadCount, setNewLeadCount] = useState(0);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const canSeeLeads = canAccess("Leads & CRM");
  const canSeeInventory = canAccess("Inventory");
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!canSeeLeads) {
      setNewLeadCount(0);
      return;
    }
    return subscribeNewLeadCount({ onNext: setNewLeadCount });
  }, [canSeeLeads]);

  useEffect(() => {
    if (!userProfile?.email) {
      setUnreadNotificationCount(0);
      return;
    }
    return subscribeUnreadNotificationCount({ recipientEmail: userProfile.email, onNext: setUnreadNotificationCount });
  }, [userProfile?.email]);

  const notificationSoundInitRef = useRef(false);
  const lastSoundNotificationIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!userProfile?.email) {
      notificationSoundInitRef.current = false;
      lastSoundNotificationIdRef.current = null;
      return;
    }

    const email = userProfile.email.trim().toLowerCase();
    return subscribeNotifications({
      recipientEmail: email,
      take: 5,
      onNext: (items) => {
        const newest = items[0];
        if (!notificationSoundInitRef.current) {
          notificationSoundInitRef.current = true;
          lastSoundNotificationIdRef.current = newest?.id ?? null;
          return;
        }
        if (!newest) return;
        if (newest.id === lastSoundNotificationIdRef.current) return;
        lastSoundNotificationIdRef.current = newest.id;
        void Notifications.scheduleNotificationAsync({
          content: {
            title: newest.title || "Notification",
            body: newest.message || "",
            sound: "default",
            data: {
              entityType: newest.entityType,
              entityId: newest.entityId,
              link: newest.link ?? null,
              notificationId: newest.id,
            },
          },
          trigger: null,
        }).catch(() => {});
      },
      onError: () => {},
    });
  }, [userProfile?.email]);

  const assignedInitRef = useRef(false);
  const assignedLastCheckRef = useRef(0);
  useEffect(() => {
    if (!userProfile?.email) return;
    if (!canSeeLeads) return;

    const email = userProfile.email.trim().toLowerCase();
    const key = `automate.notifications.leads.assigned.lastCheck.${email}`;
    let unsub: (() => void) | null = null;
    let cancelled = false;

    void (async () => {
      const raw = await AsyncStorage.getItem(key);
      const lastCheck = Number(raw ?? "0");
      assignedLastCheckRef.current = Number.isFinite(lastCheck) ? lastCheck : 0;
      assignedInitRef.current = assignedLastCheckRef.current > 0;

      if (cancelled) return;
      unsub = subscribeAssignedLeads({
        recipientEmail: email,
        take: 25,
        onNext: (leads) => {
          const nowMs = Date.now();
          for (const lead of leads) {
            const assignedAt = lead.assignedAt ? Date.parse(lead.assignedAt) : Number.NaN;
            if (!Number.isFinite(assignedAt)) continue;
            if (assignedLastCheckRef.current > 0 && assignedAt <= assignedLastCheckRef.current) continue;
            if (!assignedInitRef.current && assignedLastCheckRef.current === 0) continue;

            void upsertNotification({
              type: "lead_assigned",
              recipientEmail: email,
              recipientUid: user?.uid ?? null,
              title: "Lead assigned",
              message: "A lead was assigned to you.",
              entityType: "lead_submission",
              entityId: lead.id,
              link: `/leads/${lead.id}`,
              eventKey: `${lead.id}__${lead.assignedAt ?? ""}`,
            }).catch(() => {});
          }
          assignedInitRef.current = true;
          assignedLastCheckRef.current = nowMs;
          void AsyncStorage.setItem(key, String(nowMs));
        },
      });
    })();

    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [canSeeLeads, user?.uid, userProfile?.email]);

  const followUpNotifiedRef = useRef(new Set<string>());
  useEffect(() => {
    if (!userProfile?.email) return;
    if (!canSeeLeads) return;

    const email = userProfile.email.trim().toLowerCase();
    return subscribePendingFollowUps({
      recipientEmail: email,
      take: 50,
      onNext: (leads) => {
        const now = Date.now();
        for (const lead of leads) {
          if (!lead.followUpAt) continue;
          const followUpAtMs = Date.parse(lead.followUpAt);
          if (!Number.isFinite(followUpAtMs)) continue;
          if (followUpAtMs > now) continue;

          const eventKey = `${lead.id}__${lead.followUpAt}`;
          if (followUpNotifiedRef.current.has(eventKey)) continue;
          followUpNotifiedRef.current.add(eventKey);

          void upsertNotification({
            type: "lead_followup_due",
            recipientEmail: email,
            recipientUid: user?.uid ?? null,
            title: "Follow-up due",
            message: "A follow-up is due now.",
            entityType: "lead_submission",
            entityId: lead.id,
            link: `/leads/${lead.id}`,
            eventKey,
          }).catch(() => {});
        }
      },
    });
  }, [canSeeLeads, user?.uid, userProfile?.email]);

  const tabBarStyle = useMemo(
    () => ({
      position: "absolute" as const,
      bottom: 0,
      left: 0,
      right: 0,
      height: 85 + (insets.bottom > 0 ? insets.bottom - 10 : 0), // Adjust height for safe area
      borderTopLeftRadius: 30,
      borderTopRightRadius: 30,
      backgroundColor: "#27272a", // Lighter zinc-800 to stand out from black background
      borderTopWidth: 1,
      borderWidth: 0,
      borderColor: "#3f3f46", // Lighter border
      elevation: 5,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.3,
      shadowRadius: 10,
      paddingTop: 10,
      paddingBottom: insets.bottom, // Add safe area padding
    }),
    [insets.bottom],
  );

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerStyle: { backgroundColor: tokens.background },
          headerTitleStyle: { color: tokens.accent },
          headerTintColor: tokens.accent,
          tabBarStyle,
          tabBarActiveTintColor: "#FACC15", // Yellow active color
          tabBarInactiveTintColor: "#A1A1AA", // Muted grey
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: "600",
            marginBottom: 5,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Dashboard",
            tabBarIcon: ({ color }) => <TabIcon name="home" color={color} />,
          }}
        />
        {canSeeLeads ? (
          <Tabs.Screen
            name="leads"
            listeners={{
              tabPress: (e) => {
                e.preventDefault();
                router.replace("/leads");
              },
            }}
            options={{
              title: "Leads",
              headerShown: false,
              tabBarIcon: ({ color }) => <TabIcon name="users" color={color} badgeCount={newLeadCount} />,
            }}
          />
        ) : null}
        {canSeeInventory ? (
          <Tabs.Screen
            name="inventory"
            listeners={{
              tabPress: (e) => {
                e.preventDefault();
                router.replace("/inventory");
              },
            }}
            options={{
              title: "Inventory",
              headerShown: false,
              tabBarIcon: ({ color }) => <TabIcon name="car" color={color} />,
            }}
          />
        ) : null}
        {canSeeLeads ? (
          <Tabs.Screen
            name="contacts"
            listeners={{
              tabPress: (e) => {
                e.preventDefault();
                router.replace("/contacts");
              },
            }}
            options={{
              title: "Contacts",
              headerShown: false,
              tabBarIcon: ({ color }) => <TabIcon name="address-book" color={color} />,
            }}
          />
        ) : null}
        <Tabs.Screen
          name="notifications"
          options={{
            href: null,
            title: "Alerts",
            headerShown: false,
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: "Settings",
            headerShown: false,
            tabBarIcon: ({ color }) => <TabIcon name="cog" color={color} />,
          }}
        />
      </Tabs>
    </View>
  );
}
