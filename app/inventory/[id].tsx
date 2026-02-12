import { Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";

import { Screen } from "../../src/components/common/Screen";
import { Header } from "../../src/components/common/Header";
import { Card } from "../../src/components/ui/Card";
import { Badge } from "../../src/components/ui/Badge";
import { Button } from "../../src/components/ui/Button";
import { EmptyState } from "../../src/components/common/EmptyState";
import { useTheme } from "../../src/theme/useTheme";
import type { Vehicle } from "../../src/models/vehicle";
import { getVehicle } from "../../src/services/vehicleService";
import { formatCurrency } from "../../src/utils/format";

export default function VehicleDetailsScreen() {
  const { tokens } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = params.id;

  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await getVehicle(id);
        if (!cancelled) setVehicle(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load vehicle");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const styles = StyleSheet.create({
    heroPrice: { fontSize: 32, fontWeight: "900", color: tokens.primary, letterSpacing: -1, marginBottom: 4 },
    heroStock: { fontSize: 14, fontWeight: "700", color: tokens.mutedForeground, marginBottom: 16 },
    sectionTitle: { color: tokens.accent, fontSize: 18, fontWeight: "800", marginBottom: 16, marginTop: 8 },
    kv: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: tokens.border },
    k: { color: tokens.mutedForeground, fontSize: 14, fontWeight: "600" },
    v: { color: tokens.accent, fontSize: 14, fontWeight: "700" },
    badges: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
    img: { width: 320, height: 220, borderRadius: tokens.radius.lg, backgroundColor: tokens.muted, marginRight: 12 },
    
    // Grid for specs
    specsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 16 },
    specItem: { 
      width: "48%", 
      backgroundColor: tokens.card, 
      padding: 16, 
      borderRadius: tokens.radius.lg, 
      borderWidth: 1, 
      borderColor: tokens.border,
      alignItems: "center"
    },
    specLabel: { color: tokens.mutedForeground, fontSize: 12, fontWeight: "700", marginTop: 8 },
    specValue: { color: tokens.accent, fontSize: 16, fontWeight: "800", marginTop: 2 },
    
    // Feature chips
    featuresContainer: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
    featureChip: { 
        backgroundColor: tokens.card, 
        paddingHorizontal: 12, 
        paddingVertical: 8, 
        borderRadius: tokens.radius.full, 
        borderWidth: 1, 
        borderColor: tokens.border 
    },
    featureText: { color: tokens.accent, fontSize: 13, fontWeight: "600" },

    // Internal Section
    internalCard: { backgroundColor: "#1A1A1A", padding: 16, borderRadius: tokens.radius.lg, marginTop: 24, borderWidth: 1, borderColor: "#333" },
    internalTitle: { color: "#888", fontSize: 12, fontWeight: "900", letterSpacing: 1, textTransform: "uppercase", marginBottom: 12 },
  });

  if (isLoading) {
    return (
      <Screen>
        <Header title="Loading..." showBack />
      </Screen>
    );
  }

  if (error || !vehicle) {
    return (
      <Screen>
        <Header title="Error" showBack />
        <EmptyState title="Could not load vehicle" description={error ?? "Vehicle not found"} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Header 
        title={`${vehicle.year} ${vehicle.make} ${vehicle.model}`} 
        subtitle={vehicle.variant}
        showBack 
        rightAction={
           <Button onPress={() => router.push(`/inventory/edit/${vehicle.id}`)} variant="outline" size="sm" icon="pencil">
            Edit
          </Button>
        }
      />

      <View style={{ marginHorizontal: -16, marginBottom: 24 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
          {((vehicle.images?.length ? vehicle.images : ["https://picsum.photos/400/260"]) as string[])
            .map((uri) => (
            <Image key={uri} source={{ uri }} style={styles.img} />
          ))}
        </ScrollView>
      </View>

      <Card>
        <Text style={styles.heroPrice}>{formatCurrency(vehicle.price)}</Text>
        <Text style={styles.heroStock}>Stock #{vehicle.stockNumber}</Text>

        <View style={styles.badges}>
          <Badge variant={vehicle.status === "available" ? "default" : vehicle.status === "sold" ? "muted" : "destructive"}>
            {vehicle.status.toUpperCase()}
          </Badge>
          {vehicle.motoplan ? <Badge variant="muted">Motoplan</Badge> : null}
          {vehicle.serviceHistory ? <Badge variant="muted">Service History</Badge> : null}
          {vehicle.isSpecialOffer ? <Badge variant="destructive">Special Offer</Badge> : null}
        </View>
        
        {vehicle.description ? (
            <View style={{ marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: tokens.border }}>
                <Text style={{ color: tokens.mutedForeground, lineHeight: 22 }}>{vehicle.description}</Text>
            </View>
        ) : null}
      </Card>

      <Text style={styles.sectionTitle}>Specifications</Text>
      <View style={styles.specsGrid}>
        <View style={styles.specItem}>
          <Ionicons name="speedometer-outline" size={24} color={tokens.primary} />
          <Text style={styles.specLabel}>Mileage</Text>
          <Text style={styles.specValue}>{vehicle.mileage.toLocaleString()} km</Text>
        </View>
        <View style={styles.specItem}>
          <Ionicons name="hardware-chip-outline" size={24} color={tokens.primary} />
          <Text style={styles.specLabel}>Engine</Text>
          <Text style={styles.specValue}>{vehicle.engineSize || "N/A"}</Text>
        </View>
        <View style={styles.specItem}>
          <Ionicons name="color-palette-outline" size={24} color={tokens.primary} />
          <Text style={styles.specLabel}>Color</Text>
          <Text style={styles.specValue}>{vehicle.color}</Text>
        </View>
        <View style={styles.specItem}>
          <Ionicons name="cog-outline" size={24} color={tokens.primary} />
          <Text style={styles.specLabel}>Transmission</Text>
          <Text style={styles.specValue}>{vehicle.transmission}</Text>
        </View>
        <View style={styles.specItem}>
          <Ionicons name="flame-outline" size={24} color={tokens.primary} />
          <Text style={styles.specLabel}>Fuel Type</Text>
          <Text style={styles.specValue}>{vehicle.fuelType}</Text>
        </View>
        <View style={styles.specItem}>
          <Ionicons name="car-sport-outline" size={24} color={tokens.primary} />
          <Text style={styles.specLabel}>Body Type</Text>
          <Text style={styles.specValue}>{vehicle.bodyType || "N/A"}</Text>
        </View>
        {vehicle.drive && (
            <View style={styles.specItem}>
                <Ionicons name="git-network-outline" size={24} color={tokens.primary} />
                <Text style={styles.specLabel}>Drive</Text>
                <Text style={styles.specValue}>{vehicle.drive}</Text>
            </View>
        )}
        {vehicle.seats && (
            <View style={styles.specItem}>
                <Ionicons name="people-outline" size={24} color={tokens.primary} />
                <Text style={styles.specLabel}>Seats</Text>
                <Text style={styles.specValue}>{vehicle.seats}</Text>
            </View>
        )}
      </View>

      {vehicle.features && vehicle.features.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>Features</Text>
            <View style={styles.featuresContainer}>
                {vehicle.features.map((feat, i) => (
                    <View key={i} style={styles.featureChip}>
                        <Text style={styles.featureText}>{feat}</Text>
                    </View>
                ))}
            </View>
          </View>
      )}

      {/* Internal / Admin Section */}
      <View style={styles.internalCard}>
        <Text style={styles.internalTitle}>Admin / Internal</Text>
        <View style={styles.kv}>
          <Text style={styles.k}>VIN</Text>
          <Text style={styles.v}>{vehicle.vin || "-"}</Text>
        </View>
        <View style={styles.kv}>
            <Text style={styles.k}>Engine No</Text>
            <Text style={styles.v}>{vehicle.engineNumber || "-"}</Text>
        </View>
        <View style={styles.kv}>
            <Text style={styles.k}>Cost Price</Text>
            <Text style={styles.v}>{formatCurrency(vehicle.costPrice || 0)}</Text>
        </View>
        <View style={styles.kv}>
            <Text style={styles.k}>Recon Cost</Text>
            <Text style={styles.v}>{formatCurrency(vehicle.reconditioningCost || 0)}</Text>
        </View>
        <View style={styles.kv}>
            <Text style={styles.k}>Supplier</Text>
            <Text style={styles.v}>{vehicle.supplier || "-"}</Text>
        </View>
      </View>

      <View style={{ height: 40 }} />
    </Screen>
  );
}
