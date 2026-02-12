import { Pressable, StyleSheet, Text, View, FlatList, RefreshControl } from "react-native";
import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { Screen } from "../../src/components/common/Screen";
import { Header } from "../../src/components/common/Header";
import { Card } from "../../src/components/ui/Card";
import { Input } from "../../src/components/ui/Input";
import { Badge } from "../../src/components/ui/Badge";
import { EmptyState } from "../../src/components/common/EmptyState";
import { useTheme } from "../../src/theme/useTheme";
import { subscribeRecentLeads } from "../../src/services/leadService";
import type { LeadStatus, LeadSubmission } from "../../src/models/lead";
import { timeAgo } from "../../src/utils/format";

const STATUS_FILTERS: Array<{ label: string; value: LeadStatus | "all" }> = [
  { label: "All", value: "all" },
  { label: "New", value: "new" },
  { label: "Contacted", value: "contacted" },
  { label: "Reviewed", value: "reviewed" },
  { label: "Archived", value: "archived" },
];

export default function LeadsScreen() {
  const { tokens } = useTheme();
  const router = useRouter();

  const [status, setStatus] = useState<LeadStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [leads, setLeads] = useState<LeadSubmission[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
      const unsub = subscribeRecentLeads({ onNext: setLeads, take: 200 });
      return () => unsub();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    // Re-subscribe or fetch logic here if needed, but onSnapshot handles updates automatically.
    // We'll just simulate a delay for UX
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter((l) => {
      if (status !== "all" && l.status !== status) return false;
      if (!q) return true;
      const hay = [
        l.customer?.name ?? "",
        l.customer?.email ?? "",
        l.customer?.phone ?? "",
        l.vehicle?.name ?? "",
        l.vehicle?.stockNumber ?? "",
        l.type,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [leads, search, status]);

  const getStatusColor = (s: LeadStatus) => {
      switch(s) {
          case 'new': return 'destructive';
          case 'contacted': return 'default'; // primary
          case 'reviewed': return 'secondary'; // muted?
          case 'archived': return 'outline';
          default: return 'outline';
      }
  };

  const getTypeIcon = (type: string) => {
      switch(type) {
          case 'vehicle_enquiry': return 'car-sport-outline';
          case 'test_drive': return 'speedometer-outline';
          case 'finance': return 'cash-outline';
          case 'trade_in': return 'swap-horizontal-outline';
          default: return 'mail-outline';
      }
  };

  const styles = StyleSheet.create({
    filterContainer: {
        paddingHorizontal: 16,
        paddingBottom: 12,
    },
    chips: { flexDirection: "row", gap: 8 },
    chip: {
      borderRadius: tokens.radius.full,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderWidth: 1,
      borderColor: tokens.border,
      backgroundColor: tokens.card,
    },
    chipActive: { backgroundColor: tokens.primary, borderColor: tokens.primary },
    chipText: { color: tokens.mutedForeground, fontSize: 13, fontWeight: "600" },
    chipTextActive: { color: tokens.background, fontWeight: "800" },
    
    // List Item
    leadCard: {
        padding: 16,
        backgroundColor: tokens.card,
        borderRadius: tokens.radius.lg,
        borderWidth: 1,
        borderColor: tokens.border,
        marginBottom: 12,
        marginHorizontal: 16,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 8
    },
    customerName: {
        fontSize: 16,
        fontWeight: "800",
        color: tokens.accent,
        marginBottom: 2
    },
    timeAgo: {
        fontSize: 12,
        color: tokens.mutedForeground,
        fontWeight: "500"
    },
    vehicleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 12
    },
    vehicleText: {
        fontSize: 14,
        color: tokens.primary,
        fontWeight: "700"
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 4,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: tokens.border
    },
    typeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4
    },
    typeText: {
        fontSize: 12,
        color: tokens.mutedForeground,
        textTransform: 'capitalize'
    }
  });

  const renderItem = ({ item }: { item: LeadSubmission }) => (
    <Pressable onPress={() => router.push(`/leads/${item.id}`)}>
        <View style={styles.leadCard}>
            <View style={styles.cardHeader}>
                <View>
                    <Text style={styles.customerName}>{item.customer?.name || "Unknown Customer"}</Text>
                    <Text style={{ fontSize: 12, color: tokens.mutedForeground }}>{item.customer?.phone || item.customer?.email || "No contact info"}</Text>
                </View>
                <Text style={styles.timeAgo}>{timeAgo(item.createdAt)}</Text>
            </View>

            {item.vehicle?.name && (
                <View style={styles.vehicleRow}>
                    <Ionicons name="car-sport" size={16} color={tokens.primary} />
                    <Text style={styles.vehicleText}>{item.vehicle.name} {item.vehicle.stockNumber ? `(${item.vehicle.stockNumber})` : ''}</Text>
                </View>
            )}

            <View style={styles.footer}>
                <View style={styles.typeContainer}>
                    <Ionicons name={getTypeIcon(item.type)} size={14} color={tokens.mutedForeground} />
                    <Text style={styles.typeText}>{item.type.replace('_', ' ')}</Text>
                </View>
                <Badge variant={getStatusColor(item.status) as any}>{item.status}</Badge>
            </View>
        </View>
    </Pressable>
  );

  return (
    <Screen scroll={false}>
      <Header title="Leads & CRM" subtitle="Manage enquiries" />

      <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
        <Input 
            value={search} 
            onChangeText={setSearch} 
            placeholder="Search leads..." 
            leftIcon={<Ionicons name="search" size={18} color={tokens.mutedForeground} />}
        />
      </View>

      <View style={styles.filterContainer}>
        <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={STATUS_FILTERS}
            keyExtractor={item => item.value}
            renderItem={({ item }) => {
                const active = item.value === status;
                return (
                    <Pressable onPress={() => setStatus(item.value)}>
                        <View style={[styles.chip, active ? styles.chipActive : null]}>
                            <Text style={[styles.chipText, active ? styles.chipTextActive : null]}>{item.label}</Text>
                        </View>
                    </Pressable>
                );
            }}
            contentContainerStyle={{ gap: 8 }}
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tokens.primary} />}
        contentContainerStyle={{ paddingBottom: 20 }}
        ListEmptyComponent={
            <EmptyState 
                title="No leads found" 
                description="Try changing filters or search terms." 
                icon="people-outline"
            />
        }
      />
    </Screen>
  );
}
