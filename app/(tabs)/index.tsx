import { ScrollView, StyleSheet, Text, View, Pressable } from "react-native";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { Screen } from "../../src/components/common/Screen";
import { Header } from "../../src/components/common/Header";
import { Card } from "../../src/components/ui/Card";
import { Badge } from "../../src/components/ui/Badge";
import { useTheme } from "../../src/theme/useTheme";
import { useAuth } from "../../src/auth/AuthContext";
import { subscribeInventoryVehicles } from "../../src/services/vehicleService";
import { subscribeRecentLeads } from "../../src/services/leadService";
import type { Vehicle } from "../../src/models/vehicle";
import type { LeadSubmission } from "../../src/models/lead";
import { timeAgo } from "../../src/utils/format";

export default function DashboardScreen() {
  const { tokens } = useTheme();
  const { userProfile } = useAuth();
  const router = useRouter();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [leads, setLeads] = useState<LeadSubmission[]>([]);

  useEffect(() => subscribeInventoryVehicles({ onNext: setVehicles }), []);
  useEffect(() => subscribeRecentLeads({ onNext: setLeads, take: 5 }), []);

  const stats = useMemo(() => {
    const total = vehicles.length;
    const available = vehicles.filter((v) => v.status === "available").length;
    const drafts = vehicles.filter((v) => v.status === "draft").length;
    const leadsCount = leads.length; // Just recent ones for now
    return { total, available, drafts, leadsCount };
  }, [vehicles, leads]);

  const greeting = userProfile?.name?.trim()
    ? `Good Morning, ${userProfile.name.split(" ")[0]}`
    : "Good Morning";

  const styles = StyleSheet.create({
    header: { marginBottom: 24 },
    h1: { fontSize: 32, fontWeight: "900", color: tokens.accent, letterSpacing: -1 },
    h2: { fontSize: 16, fontWeight: "600", color: tokens.mutedForeground, marginTop: 4 },
    sectionTitle: {
      color: tokens.accent,
      fontSize: 20,
      fontWeight: "800",
      marginBottom: 16,
      marginTop: 24,
    },
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 12,
    },
    statCard: {
      width: "48%",
      backgroundColor: tokens.card,
      borderRadius: tokens.radius.lg,
      padding: 20,
      borderWidth: 1,
      borderColor: tokens.border,
      ...tokens.shadow.md,
    },
    statCardPrimary: {
      backgroundColor: tokens.primary,
      borderColor: tokens.primary,
    },
    statIcon: {
      width: 44,
      height: 44,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: tokens.muted,
      marginBottom: 16,
    },
    statIconPrimary: {
      backgroundColor: "rgba(0,0,0,0.1)",
    },
    statLabel: {
      color: tokens.mutedForeground,
      fontSize: 13,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    statLabelPrimary: {
      color: tokens.primaryForeground,
      opacity: 0.8,
    },
    statValue: {
      color: tokens.accent,
      fontSize: 32,
      fontWeight: "900",
      marginTop: 4,
      letterSpacing: -1,
    },
    statValuePrimary: {
      color: tokens.primaryForeground,
    },
    leadItem: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: tokens.card,
      padding: 16,
      borderRadius: tokens.radius.lg,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: tokens.border,
      ...tokens.shadow.sm,
    },
    leadIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: tokens.muted,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 16,
    },
    leadName: { fontSize: 16, fontWeight: "700", color: tokens.accent },
    leadVehicle: { fontSize: 13, color: tokens.mutedForeground, marginTop: 2 },
    leadTime: { fontSize: 12, color: tokens.mutedForeground, marginLeft: "auto" },
  });

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.h1}>{greeting}</Text>
        <Text style={styles.h2}>Here's what's happening today.</Text>
      </View>

      <View style={styles.grid}>
        <View style={[styles.statCard, styles.statCardPrimary]}>
          <View style={[styles.statIcon, styles.statIconPrimary]}>
            <Ionicons name="car-sport" size={24} color={tokens.primaryForeground} />
          </View>
          <Text style={[styles.statLabel, styles.statLabelPrimary]}>Inventory</Text>
          <Text style={[styles.statValue, styles.statValuePrimary]}>{stats.total}</Text>
        </View>

        <View style={styles.statCard}>
          <View style={styles.statIcon}>
            <Ionicons name="people" size={24} color={tokens.primary} />
          </View>
          <Text style={styles.statLabel}>Active Leads</Text>
          <Text style={styles.statValue}>{stats.leadsCount}</Text>
        </View>

        <View style={styles.statCard}>
          <View style={styles.statIcon}>
            <Ionicons name="document-text" size={24} color={tokens.accent} />
          </View>
          <Text style={styles.statLabel}>Drafts</Text>
          <Text style={styles.statValue}>{stats.drafts}</Text>
        </View>

        <View style={styles.statCard}>
          <View style={styles.statIcon}>
            <Ionicons name="checkmark-circle" size={24} color={tokens.accent} />
          </View>
          <Text style={styles.statLabel}>Available</Text>
          <Text style={styles.statValue}>{stats.available}</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Recent Leads</Text>
      {leads.length === 0 ? (
        <Card>
          <Text style={{ color: tokens.mutedForeground }}>No leads yet.</Text>
        </Card>
      ) : (
        leads.map((lead) => (
          <Pressable key={lead.id} onPress={() => router.push(`/leads/${lead.id}`)}>
            <View style={styles.leadItem}>
              <View style={styles.leadIcon}>
                <Ionicons name="person" size={20} color={tokens.accent} />
              </View>
              <View>
                <Text style={styles.leadName}>{lead.customer?.name}</Text>
                <Text style={styles.leadVehicle}>{lead.vehicle?.stockNumber ?? "No Vehicle"}</Text>
              </View>
              <View style={{ marginLeft: "auto", alignItems: "flex-end" }}>
                <Text style={styles.leadTime}>{timeAgo(lead.createdAt)}</Text>
                <Badge variant={lead.status === "new" ? "destructive" : "muted"}>
                  {lead.status.toUpperCase()}
                </Badge>
              </View>
            </View>
          </Pressable>
        ))
      )}
    </Screen>
  );
}
