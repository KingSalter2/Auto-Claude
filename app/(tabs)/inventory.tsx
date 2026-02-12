import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "expo-router";

import { Ionicons } from "@expo/vector-icons";

import { Screen } from "../../src/components/common/Screen";
import { Header } from "../../src/components/common/Header";
import { Card } from "../../src/components/ui/Card";
import { Input } from "../../src/components/ui/Input";
import { Badge } from "../../src/components/ui/Badge";
import { Button } from "../../src/components/ui/Button";
import { EmptyState } from "../../src/components/common/EmptyState";
import { useTheme } from "../../src/theme/useTheme";
import { subscribeInventoryVehicles } from "../../src/services/vehicleService";
import type { Vehicle, VehicleStatus } from "../../src/models/vehicle";
import { formatCurrency } from "../../src/utils/format";

const PAGE_SIZE = 20;

const STATUS_FILTERS: Array<{ label: string; value: VehicleStatus | "all" }> = [
  { label: "All", value: "all" },
  { label: "Available", value: "available" },
  { label: "Draft", value: "draft" },
  { label: "Sold", value: "sold" },
];

export default function InventoryScreen() {
  const { tokens } = useTheme();
  const router = useRouter();

  const [status, setStatus] = useState<VehicleStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [page, setPage] = useState(1);

  useEffect(() => subscribeInventoryVehicles({ onNext: setVehicles }), []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return vehicles.filter((v) => {
      if (status !== "all" && v.status !== status) return false;
      if (!q) return true;
      const hay = [v.make, v.model, v.variant ?? "", v.stockNumber, String(v.year)].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [search, status, vehicles]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [status, search]);

  const styles = StyleSheet.create({
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginVertical: 12 },
    chip: {
      borderRadius: 999,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: tokens.border,
      backgroundColor: tokens.card,
    },
    chipActive: { backgroundColor: tokens.primary, borderColor: tokens.primary },
    chipText: { color: tokens.mutedForeground, fontSize: 13, fontWeight: "700" },
    chipTextActive: { color: tokens.primaryForeground },
    
    // List Item Styles
    itemCard: {
      backgroundColor: tokens.card,
      borderRadius: tokens.radius.lg,
      marginBottom: 16,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: tokens.border,
      ...tokens.shadow.sm,
    },
    itemImage: {
      width: "100%",
      height: 180,
      backgroundColor: tokens.muted,
    },
    itemContent: {
      padding: 16,
    },
    itemHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: 8,
    },
    itemTitle: {
      fontSize: 18,
      fontWeight: "800",
      color: tokens.accent,
      flex: 1,
      marginRight: 8,
    },
    itemPrice: {
      fontSize: 20,
      fontWeight: "900",
      color: tokens.primary,
    },
    itemMeta: {
      fontSize: 13,
      color: tokens.mutedForeground,
      fontWeight: "600",
      marginBottom: 12,
    },
    itemFooter: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      borderTopWidth: 1,
      borderTopColor: tokens.border,
      paddingTop: 12,
      marginTop: 4,
    },
    stock: {
      fontSize: 12,
      fontWeight: "700",
      color: tokens.mutedForeground,
      backgroundColor: tokens.muted,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 4,
    },
    
    pager: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12, marginTop: 20, marginBottom: 40 },
    pagerText: { color: tokens.mutedForeground, fontSize: 12, fontWeight: "700" },
  });

  return (
    <Screen>
      <Header
        title="Inventory"
        subtitle="Browse and edit vehicle listings."
        rightAction={
          <Button onPress={() => router.push("/inventory/new")} size="sm" icon="add">
            Add
          </Button>
        }
      />

      <Input value={search} onChangeText={setSearch} placeholder="Search make, model, stock #..." />

      <View style={styles.chips}>
        {STATUS_FILTERS.map((s) => {
          const active = s.value === status;
          return (
            <Pressable key={s.value} onPress={() => setStatus(s.value)}>
              <View style={[styles.chip, active ? styles.chipActive : null]}>
                <Text style={[styles.chipText, active ? styles.chipTextActive : null]}>{s.label}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      {pageItems.length === 0 ? (
        <EmptyState title="No vehicles found" description="Try changing filters or search terms." />
      ) : (
        pageItems.map((v) => (
          <Pressable key={v.id} onPress={() => router.push(`/inventory/${v.id}`)}>
            <View style={styles.itemCard}>
              {v.images && v.images.length > 0 ? (
                <Image source={{ uri: v.images[0] }} style={styles.itemImage} resizeMode="cover" />
              ) : (
                <View style={[styles.itemImage, { alignItems: "center", justifyContent: "center" }]}>
                  <Ionicons name="image-outline" size={48} color={tokens.mutedForeground} />
                </View>
              )}
              <View style={styles.itemContent}>
                <View style={styles.itemHeader}>
                  <Text style={styles.itemTitle}>
                    {v.year} {v.make} {v.model}
                  </Text>
                  <Badge variant={v.status === "available" ? "default" : v.status === "sold" ? "muted" : "destructive"}>
                    {v.status.toUpperCase()}
                  </Badge>
                </View>
                <Text style={styles.itemMeta}>
                  {v.variant} • {v.mileage.toLocaleString()} km
                </Text>
                
                <View style={styles.itemFooter}>
                  <Text style={styles.stock}>#{v.stockNumber}</Text>
                  <Text style={styles.itemPrice}>{formatCurrency(v.price)}</Text>
                </View>
              </View>
            </View>
          </Pressable>
        ))
      )}

      <View style={styles.pager}>
        <Button disabled={safePage <= 1} variant="outline" onPress={() => setPage((p) => Math.max(1, p - 1))}>
          Prev
        </Button>
        <Text style={styles.pagerText}>
          Page {safePage} of {pageCount} • {filtered.length} vehicles
        </Text>
        <Button
          disabled={safePage >= pageCount}
          variant="outline"
          onPress={() => setPage((p) => Math.min(pageCount, p + 1))}
        >
          Next
        </Button>
      </View>
    </Screen>
  );
}
