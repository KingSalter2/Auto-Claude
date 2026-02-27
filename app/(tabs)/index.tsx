import { ScrollView, StyleSheet, Text, View, Pressable, StatusBar, Dimensions, Image } from "react-native";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useNavigation, type Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../src/auth/AuthContext";
import { subscribeInventoryVehicles } from "../../src/services/vehicleService";
import { subscribeRecentLeads, subscribeNewLeadCount, subscribeTotalLeadCount } from "../../src/services/leadService";
import { subscribeUnreadNotificationCount } from "../../src/services/notificationService";
import type { Vehicle } from "../../src/models/vehicle";
import type { LeadSubmission } from "../../src/models/lead";
import { timeAgo } from "../../src/utils/format";

const { width } = Dimensions.get("window");

// Modern Dark Theme Colors
const COLORS = {
  background: "#09090b", // Very dark, almost black
  card: "#18181b", // Zinc-900ish
  cardHighlight: "#27272a", // Zinc-800ish
  primary: "#FACC15", // Yellow-400 (Vibrant Yellow)
  primaryForeground: "#000000",
  text: "#FFFFFF",
  textMuted: "#A1A1AA", // Zinc-400
  border: "#27272a",
  success: "#22c55e",
  danger: "#ef4444",
};

export default function DashboardScreen() {
  const { userProfile } = useAuth();
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [leads, setLeads] = useState<LeadSubmission[]>([]);
  const [newLeadCount, setNewLeadCount] = useState(0);
  const [totalLeadCount, setTotalLeadCount] = useState(0);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);

  // Hide the default header to implement custom design
  useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  useEffect(() => subscribeInventoryVehicles({ onNext: setVehicles }), []);
  useEffect(() => subscribeRecentLeads({ onNext: setLeads, take: 5 }), []);
  useEffect(() => subscribeNewLeadCount({ onNext: setNewLeadCount }), []);
  useEffect(() => subscribeTotalLeadCount({ onNext: setTotalLeadCount }), []);
  useEffect(() => {
    if (!userProfile?.email) {
      setUnreadNotificationCount(0);
      return;
    }
    return subscribeUnreadNotificationCount({ recipientEmail: userProfile.email, onNext: setUnreadNotificationCount });
  }, [userProfile?.email]);

  const stats = useMemo(() => {
    const total = vehicles.length;
    const available = vehicles.filter((v) => v.status === "available").length;
    const drafts = vehicles.filter((v) => v.status === "draft").length;
    const sold = vehicles.filter((v) => v.status === "sold").length;
    const specials = vehicles.filter((v) => v.isSpecialOffer).length;
    
    // Calculate "Health Score" or similar metric for the hero card
    // Arbitrary calculation: (Available / Total) * 100
    const healthScore = total > 0 ? Math.round((available / total) * 100) : 0;
    
    return { total, available, drafts, sold, specials, leadsCount: totalLeadCount, newLeads: newLeadCount, healthScore };
  }, [vehicles, totalLeadCount, newLeadCount]);

  const greeting = useMemo(() => {
    const firstName = userProfile?.name?.trim() ? userProfile.name.split(" ")[0] : "Admin";
    const hourStr = new Intl.DateTimeFormat("en-ZA", {
      timeZone: "Africa/Johannesburg",
      hour: "2-digit",
      hour12: false,
    }).format(new Date());
    const hour = Number(hourStr);
    const base = Number.isFinite(hour) && hour >= 12 && hour < 18 ? "Good Afternoon" : Number.isFinite(hour) && hour >= 18 ? "Good Evening" : "Good Morning";
    return { title: base, name: firstName };
  }, [userProfile?.name]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
      
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.avatarContainer}>
               <Text style={styles.avatarText}>{greeting.name[0]}</Text>
            </View>
            <View>
              <Text style={styles.greetingTitle}>{greeting.title},</Text>
              <Text style={styles.greetingName}>{greeting.name}</Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <Pressable style={styles.iconButton} onPress={() => router.push("/notifications")}>
               <Ionicons name="notifications-outline" size={24} color={COLORS.text} />
               {unreadNotificationCount > 0 ? (
                 <View style={styles.notificationBadge}>
                   <Text style={styles.notificationBadgeText}>
                     {unreadNotificationCount > 99 ? "99+" : String(unreadNotificationCount)}
                   </Text>
                 </View>
               ) : null}
            </Pressable>
          </View>
        </View>

        {/* Hero Card */}
        <View style={styles.heroCard}>
          <View style={styles.heroContent}>
            <Text style={styles.heroLabel}>Inventory Health</Text>
            <Text style={styles.heroValue}>{stats.available}/{stats.total} Available</Text>
            <Text style={styles.heroSubtext}>Vehicles currently online</Text>
          </View>
          <View style={styles.heroChart}>
             <View style={styles.chartCircle}>
                <Text style={styles.chartText}>{stats.healthScore}%</Text>
             </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionRow}>
            <Pressable style={styles.actionBtn} onPress={() => router.push("/inventory/new")}>
              <View style={styles.actionIcon}>
                <Ionicons name="add" size={24} color={COLORS.primary} />
              </View>
              <Text style={styles.actionLabel}>Add Car</Text>
            </Pressable>
            
            <Pressable style={styles.actionBtn} onPress={() => router.push("/inventory")}>
              <View style={[styles.actionIcon, { backgroundColor: '#3f3f46' }]}>
                <Ionicons name="car-sport" size={22} color={COLORS.text} />
              </View>
              <Text style={styles.actionLabel}>Inventory</Text>
            </Pressable>

            <Pressable style={styles.actionBtn} onPress={() => router.push("/leads")}>
              <View style={[styles.actionIcon, { backgroundColor: '#3f3f46' }]}>
                <Ionicons name="people" size={22} color={COLORS.text} />
              </View>
              <Text style={styles.actionLabel}>Leads</Text>
            </Pressable>
          </View>
        </View>

        {/* Bento Grid */}
        <View style={styles.grid}>
          {(
            [
              { label: "Total Inventory", value: stats.total, sub: "All vehicles", icon: "car-sport", color: COLORS.primary, route: "/inventory" },
              { label: "Special Vehicles", value: stats.specials, sub: "On offer", icon: "pricetag", color: COLORS.primary, route: "/inventory?status=special" },
              { label: "Draft Vehicles", value: stats.drafts, sub: "Incomplete", icon: "document-text", color: "#60a5fa", route: "/inventory?status=draft" },
              { label: "Sold Vehicles", value: stats.sold, sub: "Completed sales", icon: "checkmark-circle", color: COLORS.success, route: "/inventory?status=sold" },
              { label: "Total Leads", value: stats.leadsCount, sub: "All time", icon: "people", color: "#a855f7", route: "/leads" },
              { label: "New Leads", value: stats.newLeads, sub: "Unprocessed", icon: "flash", color: "#f43f5e", route: "/leads?status=new" },
            ] satisfies Array<{
              label: string;
              value: number;
              sub: string;
              icon: keyof typeof Ionicons.glyphMap;
              color: string;
              route: Href;
            }>
          ).map((item, index) => (
             <Pressable key={index} style={[styles.card, styles.cardGrid]} onPress={() => router.push(item.route)}>
               <View style={styles.cardHeader}>
                 <Ionicons name={item.icon} size={24} color={item.color} />
                 <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
               </View>
               <View style={styles.cardBody}>
                 <Text style={styles.cardValue}>{item.value}</Text>
                 <Text style={styles.cardLabel}>{item.label}</Text>
                 <Text style={styles.cardSub}>{item.sub}</Text>
               </View>
             </Pressable>
          ))}
        </View>

        {/* Recent Activity / Wide Card */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          {leads.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No recent activity</Text>
            </View>
          ) : (
            leads.slice(0, 3).map((lead) => (
              <Pressable key={lead.id} style={styles.activityItem} onPress={() => router.push(`/leads/${lead.id}`)}>
                 <View style={styles.activityIcon}>
                    <Ionicons name="person" size={16} color={COLORS.text} />
                 </View>
                 <View style={styles.activityContent}>
                    <Text style={styles.activityTitle}>{lead.customer?.name || "Unknown"}</Text>
                    <Text style={styles.activitySub}>
                       {lead.vehicle?.name || lead.vehicle?.stockNumber || "General Enquiry"}
                    </Text>
                 </View>
                 <Text style={styles.activityTime}>{timeAgo(lead.createdAt)}</Text>
              </Pressable>
            ))
          )}
        </View>
        
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 60, // Space for status bar if not handled by SafeAreaView
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatarContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.cardHighlight,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: "600",
    color: COLORS.text,
  },
  greetingTitle: {
    fontSize: 14,
    color: COLORS.textMuted,
  },
  greetingName: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.text,
  },
  headerRight: {
    flexDirection: "row",
    gap: 12,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.card,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  notificationBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 999,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
    borderWidth: 1,
    borderColor: COLORS.background,
  },
  notificationBadgeText: {
    color: COLORS.primaryForeground,
    fontSize: 11,
    fontWeight: "800",
  },
  heroCard: {
    backgroundColor: COLORS.primary,
    borderRadius: 32,
    padding: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 32,
    height: 160,
  },
  heroContent: {
    flex: 1,
    justifyContent: "center",
  },
  heroLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "rgba(0,0,0,0.6)",
    marginBottom: 8,
  },
  heroValue: {
    fontSize: 24,
    fontWeight: "800",
    color: COLORS.primaryForeground,
    marginBottom: 4,
  },
  heroSubtext: {
    fontSize: 13,
    color: "rgba(0,0,0,0.5)",
    fontWeight: "500",
  },
  heroChart: {
    width: 100,
    height: 100,
    alignItems: "center",
    justifyContent: "center",
  },
  chartCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 6,
    borderColor: "rgba(0,0,0,0.1)",
    alignItems: "center",
    justifyContent: "center",
    // In a real app we'd use SVG for partial circle
    // For now simple full circle style
  },
  chartText: {
    fontSize: 20,
    fontWeight: "800",
    color: COLORS.primaryForeground,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 16,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 20,
    justifyContent: 'center',
  },
  actionBtn: {
    alignItems: "center",
    gap: 8,
  },
  actionIcon: {
    width: 64,
    height: 64,
    borderRadius: 24,
    backgroundColor: COLORS.cardHighlight,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  actionLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: "500",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 24,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardLarge: {
    flex: 1,
    height: 160,
    justifyContent: "space-between",
  },
  cardGrid: {
    width: (width - 40 - 12) / 2,
    height: 140,
    justifyContent: "space-between",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  cardBody: {
    gap: 4,
  },
  cardValue: {
    fontSize: 32,
    fontWeight: "700",
    color: COLORS.text,
  },
  cardLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
  },
  cardSub: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  emptyCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emptyText: {
    color: COLORS.textMuted,
  },
  activityItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: COLORS.cardHighlight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
  },
  activitySub: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  activityTime: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: "500",
  },
});
