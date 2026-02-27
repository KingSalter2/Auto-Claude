import { Alert, StyleSheet, Text, View, Switch, Pressable, ScrollView, Image, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "../../src/theme/useTheme";
import { useAuth } from "../../src/auth/AuthContext";
import { firebaseDb } from "../../src/lib/firebase";

export default function SettingsScreen() {
  const { tokens, mode, setMode } = useTheme();
  const { userProfile, user, signOutUser, registerForPush, pushStatus } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const [deviceCount, setDeviceCount] = useState(0);
  const [deviceQueryError, setDeviceQueryError] = useState<string | null>(null);
  const lastAlertAtRef = useRef<number>(0);
  const lastStateRef = useRef<string>("unknown");

  useEffect(() => {
    const uid = user?.uid ?? null;
    if (!uid) {
      setDeviceCount(0);
      setDeviceQueryError(null);
      return;
    }
    const q = query(collection(firebaseDb, "user_devices"), where("uid", "==", uid));
    return onSnapshot(
      q,
      (snap) => {
        setDeviceCount(snap.size);
        setDeviceQueryError(null);
      },
      (e) => {
        setDeviceCount(0);
        setDeviceQueryError(e instanceof Error ? e.message : "Failed to query device registration.");
      },
    );
  }, [user?.email]);

  useEffect(() => {
    const state = pushStatus.state;
    const updatedAt = pushStatus.updatedAt ?? 0;
    if (updatedAt <= lastAlertAtRef.current) return;

    const prevState = lastStateRef.current;
    lastStateRef.current = state;

    if (prevState !== "registering") return;
    if (state !== "blocked" && state !== "error") return;

    lastAlertAtRef.current = updatedAt;
    Alert.alert("Notifications", pushStatus.detail ?? "Could not enable notifications.");
  }, [pushStatus.detail, pushStatus.state, pushStatus.updatedAt]);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: "#09090b", // Deep black/zinc background
      paddingTop: insets.top,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingBottom: 20,
      paddingTop: 10,
    },
    headerTitle: {
      color: "#fff",
      fontSize: 20,
      fontWeight: "700",
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: "#27272a",
      alignItems: "center",
      justifyContent: "center",
    },
    profileSection: {
      alignItems: "center",
      justifyContent: "center",
      marginVertical: 20,
    },
    avatarContainer: {
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: "#27272a",
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
      borderColor: "#FACC15", // Yellow accent
      marginBottom: 16,
    },
    avatarText: {
      fontSize: 36,
      fontWeight: "700",
      color: "#FACC15",
    },
    userName: {
      fontSize: 22,
      fontWeight: "700",
      color: "#fff",
      marginBottom: 4,
    },
    userEmail: {
      fontSize: 14,
      color: "#a1a1aa",
      marginBottom: 8,
    },
    roleBadge: {
      paddingHorizontal: 12,
      paddingVertical: 4,
      backgroundColor: "#FACC15",
      borderRadius: 12,
    },
    roleText: {
      fontSize: 12,
      fontWeight: "700",
      color: "#000",
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: "#fff",
      marginLeft: 20,
      marginBottom: 12,
      marginTop: 24,
    },
    card: {
      marginHorizontal: 20,
      backgroundColor: "#18181b", // Zinc 900
      borderRadius: 24,
      padding: 4,
      overflow: 'hidden',
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      padding: 16,
    },
    iconContainer: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 16,
    },
    rowContent: {
      flex: 1,
    },
    rowTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: "#fff",
      marginBottom: 2,
    },
    rowSubtitle: {
      fontSize: 13,
      color: "#a1a1aa",
    },
    rowAction: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    signOutButton: {
      marginHorizontal: 20,
      marginTop: 40,
      marginBottom: 40,
      backgroundColor: "#27272a",
      height: 56,
      borderRadius: 28,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: "#ef4444",
    },
    signOutText: {
      color: "#ef4444",
      fontSize: 16,
      fontWeight: "700",
      marginLeft: 8,
    },
    divider: {
      height: 1,
      backgroundColor: "#27272a",
      marginLeft: 72,
    }
  });

  const getInitials = (name?: string) => {
    if (!name) return "U";
    return name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();
  };

  const SettingRow = ({ 
    icon, 
    color, 
    title, 
    subtitle, 
    right, 
    onPress,
    isLast 
  }: { 
    icon: keyof typeof Ionicons.glyphMap; 
    color: string; 
    title: string; 
    subtitle?: string; 
    right?: React.ReactNode; 
    onPress?: () => void;
    isLast?: boolean;
  }) => (
    <>
      <Pressable 
        style={({ pressed }) => [
          styles.row, 
          { opacity: pressed ? 0.7 : 1 }
        ]}
        onPress={onPress}
        disabled={!onPress}
      >
        <View style={[styles.iconContainer, { backgroundColor: `${color}20` }]}>
          <Ionicons name={icon} size={22} color={color} />
        </View>
        <View style={styles.rowContent}>
          <Text style={styles.rowTitle}>{title}</Text>
          {subtitle && <Text style={styles.rowSubtitle}>{subtitle}</Text>}
        </View>
        <View style={styles.rowAction}>
          {right}
        </View>
      </Pressable>
      {!isLast && <View style={styles.divider} />}
    </>
  );

  const notificationStatus = deviceQueryError
    ? "Error connecting"
    : deviceCount > 0
      ? `${deviceCount} device${deviceCount === 1 ? "" : "s"} active`
      : pushStatus.state === "registered"
        ? "Device registered"
        : "Tap to enable";

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 40 }} /> 
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        
        {/* Profile Section */}
        <View style={styles.profileSection}>
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarText}>{getInitials(userProfile?.name ?? undefined)}</Text>
          </View>
          <Text style={styles.userName}>{userProfile?.name || "User"}</Text>
          <Text style={styles.userEmail}>{user?.email || "No email"}</Text>
          <View style={{ marginTop: 8 }}>
            <View style={styles.roleBadge}>
              <Text style={styles.roleText}>{userProfile?.role || "User"}</Text>
            </View>
          </View>
        </View>

        {/* Preferences */}
        <Text style={styles.sectionTitle}>PREFERENCES</Text>
        <View style={styles.card}>
          <SettingRow
            icon="moon"
            color="#a855f7" // Purple
            title="Dark Mode"
            subtitle="Always on"
            right={
              <Switch 
                value={mode === "dark"} 
                onValueChange={(v) => setMode(v ? "dark" : "light")}
                trackColor={{ false: "#3f3f46", true: "#FACC15" }}
                thumbColor={"#fff"}
              />
            }
          />
          <SettingRow
            icon="notifications"
            color="#FACC15" // Yellow
            title="Notifications"
            subtitle={notificationStatus}
            isLast
            onPress={registerForPush}
            right={
              pushStatus.state === "registering" ? (
                <Text style={{ color: "#FACC15", fontSize: 12 }}>Wait...</Text>
              ) : (
                <Ionicons name="chevron-forward" size={20} color="#52525b" />
              )
            }
          />
        </View>

        {/* Account */}
        <Text style={styles.sectionTitle}>ACCOUNT</Text>
        <View style={styles.card}>
          <SettingRow
            icon="person"
            color="#3b82f6" // Blue
            title="Profile Details"
            subtitle="Manage your information"
            right={<Ionicons name="chevron-forward" size={20} color="#52525b" />}
            onPress={() => Alert.alert("Profile", "Profile editing coming soon")}
          />
          <SettingRow
            icon="shield-checkmark"
            color="#22c55e" // Green
            title="Security"
            subtitle="Password & Authentication"
            isLast
            right={<Ionicons name="chevron-forward" size={20} color="#52525b" />}
            onPress={() => Alert.alert("Security", "Security settings coming soon")}
          />
        </View>

         {/* Support */}
         <Text style={styles.sectionTitle}>SUPPORT</Text>
        <View style={styles.card}>
          <SettingRow
            icon="help-buoy"
            color="#f97316" // Orange
            title="Help Center"
            subtitle="FAQ and Support"
            right={<Ionicons name="chevron-forward" size={20} color="#52525b" />}
            onPress={() => Alert.alert("Support", "Contact support@example.com")}
          />
          <SettingRow
            icon="information-circle"
            color="#ec4899" // Pink
            title="About"
            subtitle={`Version 1.0.0`}
            isLast
            right={<Ionicons name="chevron-forward" size={20} color="#52525b" />}
          />
        </View>

        {/* Sign Out Button */}
        <TouchableOpacity style={styles.signOutButton} onPress={signOutUser}>
          <Ionicons name="log-out-outline" size={20} color="#ef4444" />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
}
