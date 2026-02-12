import { StyleSheet, Text, View, Switch, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Screen } from "../../src/components/common/Screen";
import { Header } from "../../src/components/common/Header";
import { Card } from "../../src/components/ui/Card";
import { Button } from "../../src/components/ui/Button";
import { useTheme } from "../../src/theme/useTheme";
import { useAuth } from "../../src/auth/AuthContext";

export default function SettingsScreen() {
  const { tokens, mode, setMode } = useTheme();
  const { userProfile, user, signOutUser } = useAuth();

  const styles = StyleSheet.create({
    sectionTitle: { color: tokens.mutedForeground, fontSize: 13, fontWeight: "700", marginBottom: 8, marginLeft: 4 },
    row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 12 },
    rowIcon: { width: 32, alignItems: "center", marginRight: 12 },
    rowText: { flex: 1 },
    label: { color: tokens.accent, fontSize: 15, fontWeight: "700" },
    value: { color: tokens.mutedForeground, fontSize: 13, marginTop: 2 },
    divider: { height: 1, backgroundColor: tokens.border, marginLeft: 44 },
  });

  function SettingItem({ icon, label, value, right }: { icon: keyof typeof Ionicons.glyphMap; label: string; value?: string; right?: React.ReactNode }) {
    return (
      <View style={styles.row}>
        <View style={styles.rowIcon}>
          <Ionicons name={icon} size={20} color={tokens.primary} />
        </View>
        <View style={styles.rowText}>
          <Text style={styles.label}>{label}</Text>
          {value && <Text style={styles.value}>{value}</Text>}
        </View>
        {right}
      </View>
    );
  }

  return (
    <Screen>
      <Header title="Settings" subtitle="Preferences & Account" />

      <View style={{ marginBottom: 20 }}>
        <Text style={styles.sectionTitle}>ACCOUNT</Text>
        <Card>
          <SettingItem 
            icon="person" 
            label="Name" 
            value={userProfile?.name || "Not set"} 
          />
          <View style={styles.divider} />
          <SettingItem 
            icon="mail" 
            label="Email" 
            value={user?.email || "Not set"} 
          />
          <View style={styles.divider} />
          <SettingItem 
            icon="shield-checkmark" 
            label="Role" 
            value={userProfile?.role || "User"} 
          />
        </Card>
      </View>

      <View style={{ marginBottom: 20 }}>
        <Text style={styles.sectionTitle}>APP SETTINGS</Text>
        <Card>
          <SettingItem 
            icon="moon" 
            label="Dark Mode" 
            right={<Switch value={mode === "dark"} onValueChange={(v) => setMode(v ? "dark" : "light")} />} 
          />
          <View style={styles.divider} />
          <SettingItem 
            icon="notifications" 
            label="Notifications" 
            right={<Switch value={true} disabled />} 
          />
        </Card>
      </View>

      <Button onPress={signOutUser} variant="destructive">
        Sign Out
      </Button>
      
      <Text style={{ textAlign: "center", color: tokens.mutedForeground, marginTop: 20, fontSize: 12 }}>
        Version 1.0.0
      </Text>
    </Screen>
  );
}
