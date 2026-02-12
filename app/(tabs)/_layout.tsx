import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Tabs } from "expo-router";
import { Animated, StyleSheet, View } from "react-native";
import { useEffect, useMemo, useRef, useState } from "react";

import { useTheme } from "../../src/theme/useTheme";
import { subscribeNewLeadCount } from "../../src/services/leadService";

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
  const { tokens, mode } = useTheme();
  const [newLeadCount, setNewLeadCount] = useState(0);

  useEffect(() => {
    return subscribeNewLeadCount({ onNext: setNewLeadCount });
  }, []);

  const tabBarStyle = useMemo(
    () => ({
      backgroundColor: tokens.card,
      borderTopColor: tokens.border,
    }),
    [tokens.card, tokens.border],
  );

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: tokens.background },
        headerTitleStyle: { color: tokens.accent },
        headerTintColor: tokens.accent,
        tabBarStyle,
        tabBarActiveTintColor: tokens.primary,
        tabBarInactiveTintColor: mode === "dark" ? "rgba(255,255,255,0.6)" : tokens.mutedForeground,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color }) => <TabIcon name="home" color={color} />,
        }}
      />
      <Tabs.Screen
        name="leads"
        options={{
          title: "Leads",
          tabBarIcon: ({ color }) => <TabIcon name="users" color={color} badgeCount={newLeadCount} />,
        }}
      />
      <Tabs.Screen
        name="inventory"
        options={{
          title: "Inventory",
          tabBarIcon: ({ color }) => <TabIcon name="car" color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color }) => <TabIcon name="cog" color={color} />,
        }}
      />
    </Tabs>
  );
}
