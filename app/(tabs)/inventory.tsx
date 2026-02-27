import { Image, Pressable, StyleSheet, Text, View, FlatList, StatusBar, Dimensions } from "react-native";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useLocalSearchParams, useNavigation } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Input } from "../../src/components/ui/Input";
import { Badge } from "../../src/components/ui/Badge";
import { EmptyState } from "../../src/components/common/EmptyState";
import { subscribeInventoryVehicles } from "../../src/services/vehicleService";
import type { Vehicle, VehicleStatus } from "../../src/models/vehicle";
import { formatCurrency } from "../../src/utils/format";

// Theme based on the "New Exercise" dark UI guide
const THEME = {
  background: "#09090b", // Deep black/zinc
  card: "#18181b",       // Zinc-900
  primary: "#facc15",    // Vibrant Yellow
  text: "#ffffff",
  textMuted: "#a1a1aa",
  border: "#27272a",
};

const STATUS_FILTERS: Array<{ label: string; value: VehicleStatus | "all" | "special" }> = [
  { label: "All", value: "all" },
  { label: "Available", value: "available" },
  { label: "Special", value: "special" },
  { label: "Draft", value: "draft" },
  { label: "Sold", value: "sold" },
];

export default function InventoryScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();

  const [status, setStatus] = useState<VehicleStatus | "all" | "special">("all");
  const [search, setSearch] = useState("");
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);

  useEffect(() => {
    if (params.status && typeof params.status === 'string') {
      const s = params.status as VehicleStatus | "all" | "special";
      if (STATUS_FILTERS.some(f => f.value === s)) {
        setStatus(s);
      }
    } else {
        setStatus('all');
    }
  }, [params.status]);

  useEffect(() => subscribeInventoryVehicles({ onNext: setVehicles }), []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return vehicles.filter((v) => {
      if (status === "special") {
        const isSpecial = Boolean(v.isSpecialOffer) || (Boolean(v.showOriginalPrice) && v.originalPrice != null && v.originalPrice > v.price);
        if (!isSpecial) return false;
      } else if (status !== "all" && v.status !== status) {
        return false;
      }
      if (!q) return true;
      const hay = [v.make, v.model, v.variant ?? "", v.stockNumber, String(v.year)].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [search, status, vehicles]);

  const renderItem = ({ item: v }: { item: Vehicle }) => {
    const isSpecial =
      Boolean(v.isSpecialOffer) || (Boolean(v.showOriginalPrice) && v.originalPrice != null && v.originalPrice > v.price);
    const conditionVariant = v.condition === "New" ? "default" : v.condition === "Demo" ? "outline" : "muted";

    return (
      <Pressable onPress={() => router.push(`/inventory/${v.id}`)}>
        <View style={styles.itemCard}>
          <View style={styles.imageContainer}>
             {v.images && v.images.length > 0 ? (
                <Image source={{ uri: v.images[0] }} style={styles.itemImage} resizeMode="cover" />
              ) : (
                <View style={[styles.itemImage, { alignItems: "center", justifyContent: "center", backgroundColor: '#27272a' }]}>
                  <Ionicons name="image-outline" size={48} color={THEME.textMuted} />
                </View>
              )}
             <View style={styles.priceTag}>
                <Text style={styles.priceText}>{formatCurrency(v.price)}</Text>
             </View>
          </View>
          
          <View style={styles.itemContent}>
            <View style={styles.itemHeader}>
                <Text style={styles.itemTitle} numberOfLines={1}>
                  {v.year} {v.make} {v.model}
                </Text>
                <Badge variant={v.status === "available" ? "default" : v.status === "sold" ? "muted" : "destructive"}>
                  {v.status.toUpperCase()}
                </Badge>
            </View>
            
            <Text style={styles.itemMeta} numberOfLines={1}>
              {v.variant} • {v.mileage.toLocaleString()} km
            </Text>

            <View style={styles.itemBadges}>
               <Badge variant={conditionVariant}>{v.condition.toUpperCase()}</Badge>
               {isSpecial && <Badge variant="destructive">SPECIAL</Badge>}
               <Text style={styles.stockText}>#{v.stockNumber}</Text>
            </View>
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={THEME.background} />
      
      {/* Custom Header Area */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <View style={styles.headerTop}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Pressable onPress={() => {
                  if (navigation.canGoBack()) {
                    router.back();
                  } else {
                    router.push("/");
                  }
                }} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={20} color={THEME.text} />
                </Pressable>
                <Text style={styles.headerDate}>INVENTORY</Text>
            </View>
            
            <Pressable onPress={() => router.push("/inventory/new")} style={styles.addButton}>
                <Ionicons name="add" size={24} color="#000" />
            </Pressable>
        </View>
        
        <Text style={styles.headerTitle}>Manage your{'\n'}Vehicle Stock</Text>
        <Text style={styles.headerSubtitle}>
             {filtered.length} vehicles • {status === 'all' ? 'All Statuses' : status.charAt(0).toUpperCase() + status.slice(1)}
        </Text>

        {/* Yellow Progress Line Decoration */}
        <View style={styles.progressLineContainer}>
             <View style={styles.progressLineFilled} />
        </View>

        {/* Search Input (Styled darker) */}
        <View style={styles.searchContainer}>
             <Input 
                value={search} 
                onChangeText={setSearch} 
                placeholder="Search inventory..." 
                style={{ backgroundColor: THEME.card, borderColor: THEME.border }}
                inputStyle={{ color: THEME.text }}
                placeholderTextColor={THEME.textMuted}
             />
        </View>

        {/* Filter Chips */}
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
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
            <EmptyState title="No vehicles found" description="Try changing filters." />
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.background,
  },
  header: {
    paddingHorizontal: 24,
    paddingBottom: 20,
    backgroundColor: THEME.background,
    zIndex: 10,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: THEME.card,
    borderWidth: 1,
    borderColor: THEME.border,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: THEME.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  headerDate: {
    color: THEME.textMuted,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
  },
  headerTitle: {
    color: THEME.text,
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 34,
    marginBottom: 8,
  },
  headerSubtitle: {
    color: THEME.textMuted,
    fontSize: 14,
    marginBottom: 20,
  },
  progressLineContainer: {
    height: 4,
    backgroundColor: THEME.border,
    borderRadius: 2,
    marginBottom: 24,
    width: 60, // Short line like in design
  },
  progressLineFilled: {
    height: '100%',
    width: '60%',
    backgroundColor: THEME.primary,
    borderRadius: 2,
  },
  searchContainer: {
    marginBottom: 16,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  chip: {
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: THEME.border,
    backgroundColor: THEME.card,
  },
  chipActive: {
    backgroundColor: THEME.primary,
    borderColor: THEME.primary,
  },
  chipText: {
    color: THEME.textMuted,
    fontSize: 14,
    fontWeight: "600",
  },
  chipTextActive: {
    color: "#000000",
    fontWeight: "700",
  },
  listContent: {
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 20,
  },
  itemCard: {
    backgroundColor: THEME.card,
    borderRadius: 24,
    marginBottom: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: THEME.border,
  },
  imageContainer: {
    position: 'relative',
  },
  itemImage: {
    width: "100%",
    height: 200,
    backgroundColor: THEME.border,
  },
  priceTag: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    backgroundColor: THEME.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  priceText: {
    color: '#000',
    fontWeight: '800',
    fontSize: 16,
  },
  itemContent: {
    padding: 20,
  },
  itemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  itemTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: THEME.text,
    flex: 1,
    marginRight: 10,
  },
  itemMeta: {
    fontSize: 14,
    color: THEME.textMuted,
    marginBottom: 12,
  },
  itemBadges: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  stockText: {
    color: THEME.textMuted,
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 'auto',
  },
});
