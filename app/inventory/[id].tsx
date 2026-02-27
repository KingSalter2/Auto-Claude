import { Image, ScrollView, StyleSheet, Text, View, Pressable, StatusBar, Dimensions, Modal, Share, Linking, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getVehicle } from "../../src/services/vehicleService";
import type { Vehicle } from "../../src/models/vehicle";
import { formatCurrency } from "../../src/utils/format";

const { width, height } = Dimensions.get('window');

const COLORS = {
  background: "#09090b",
  card: "#18181b",
  cardHighlight: "#27272a",
  primary: "#FACC15",
  primaryForeground: "#000000",
  text: "#FFFFFF",
  textMuted: "#A1A1AA",
  border: "#27272a",
  danger: "#ef4444",
  success: "#22c55e",
};

type SpecIcon = keyof typeof Ionicons.glyphMap;

type SpecItemData = {
  icon: SpecIcon;
  label: string;
  value: string;
};

function buildAutoDescription(input: Partial<Vehicle>) {
  const year = input.year ?? new Date().getFullYear();
  const make = input.make?.trim() || "this";
  const model = input.model?.trim() || "vehicle";
  const color = input.color?.trim();
  const variant = input.variant?.trim();
  const engineSize = input.engineSize?.trim();
  const bodyType = input.bodyType?.trim();
  const transmission = input.transmission?.trim();
  const fuelType = input.fuelType?.trim();
  const condition = input.condition?.trim();
  const mileage =
    typeof input.mileage === "number" && Number.isFinite(input.mileage) ? `${input.mileage.toLocaleString()} km` : undefined;

  const parts: string[] = [];

  const firstLine = [
    "Experience the perfect blend of performance and comfort with this",
    `${year} ${make} ${model}.`,
    color ? `Finished in ${color},` : undefined,
    condition ? `this ${condition.toLowerCase()} vehicle` : "this vehicle",
    "is ready for the road.",
  ]
    .filter(Boolean)
    .join(" ");
  parts.push(firstLine);

  const secondLine = [
    variant ? `This ${variant} specification` : "This specification",
    engineSize ? `features a capable ${engineSize} engine` : "offers a strong and efficient drivetrain",
    transmission ? `paired with a ${transmission.toLowerCase()} transmission` : undefined,
    fuelType ? `and runs on ${fuelType.toLowerCase()}.` : ".",
  ]
    .filter(Boolean)
    .join(" ");
  parts.push(secondLine);

  const thirdLine = [
    bodyType ? `The ${bodyType.toLowerCase()} body style` : "The vehicle",
    mileage ? `has covered ${mileage}` : "is well maintained",
    "and is ideal for daily driving, long trips, or weekend adventures.",
  ]
    .filter(Boolean)
    .join(" ");
  parts.push(thirdLine);

  return parts.join("\n\n");
}

function formatCurrencyOrDash(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return formatCurrency(value);
}

function formatDateShort(value?: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toISOString().slice(0, 10);
}

export default function VehicleDetailsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = params.id;
  const insets = useSafeAreaInsets();
  const [activeSlide, setActiveSlide] = useState(0);
  const [isSocialPostOpen, setIsSocialPostOpen] = useState(false);
  const [selectedSocialImages, setSelectedSocialImages] = useState<string[]>([]);

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

  const descriptionText = useMemo(() => {
    if (!vehicle) return "";
    const autoDescription = buildAutoDescription(vehicle);
    const shouldUseManualDescription =
      vehicle.descriptionMode === "manual" ||
      (!vehicle.descriptionMode && typeof vehicle.description === "string" && vehicle.description.trim().length > 0);
    return shouldUseManualDescription ? vehicle.description?.trim() || "" : autoDescription;
  }, [vehicle]);

  const specItems = useMemo<SpecItemData[]>(() => {
    if (!vehicle) return [];
    return [
      { icon: "speedometer-outline", label: "Mileage (km)", value: `${vehicle.mileage.toLocaleString()}` },
      { icon: "color-palette-outline", label: "Color", value: vehicle.color || "N/A" },
      { icon: "hardware-chip-outline", label: "Engine Size", value: vehicle.engineSize || "N/A" },
      { icon: "people-outline", label: "Seats", value: vehicle.seats != null ? String(vehicle.seats) : "N/A" },
      { icon: "cog-outline", label: "Transmission", value: vehicle.transmission || "N/A" },
      { icon: "flame-outline", label: "Fuel Type", value: vehicle.fuelType || "N/A" },
      { icon: "git-network-outline", label: "Drive Type", value: vehicle.drive || "N/A" },
      { icon: "car-sport-outline", label: "Body Type", value: vehicle.bodyType || "N/A" },
    ];
  }, [vehicle]);

  const monthlyPaymentText = useMemo(() => {
    if (!vehicle) return "";
    const stored = vehicle.estMonthlyPayment;
    if (typeof stored !== "number" || !Number.isFinite(stored) || stored <= 0) return "";
    return formatCurrency(stored);
  }, [vehicle]);

  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, justifyContent: 'center', alignItems: 'center' }]}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
        <Text style={{ color: COLORS.text }}>Loading...</Text>
      </View>
    );
  }

  if (error || !vehicle) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, justifyContent: 'center', alignItems: 'center' }]}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
        <Text style={{ color: COLORS.danger }}>{error ?? "Vehicle not found"}</Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: 20 }}>
            <Text style={{ color: COLORS.primary }}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const daysInStock = vehicle.createdAt
    ? Math.floor((new Date().getTime() - new Date(vehicle.createdAt).getTime()) / (1000 * 60 * 60 * 24))
    : undefined;

  const vehicleName = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
  const images = vehicle.images?.length ? vehicle.images : ["https://picsum.photos/800/600"];
  const socialImages = vehicle.images?.length ? vehicle.images : [];
  const vehicleUrl = `https://ebmotors.co.za/vehicle/${encodeURIComponent(vehicle.id)}`;
  const isSpecial =
    Boolean(vehicle.isSpecialOffer) ||
    (Boolean(vehicle.showOriginalPrice) && typeof vehicle.originalPrice === "number" && vehicle.originalPrice > vehicle.price);
  const conditionBadgeVariant = vehicle.condition === "New" ? "new" : vehicle.condition === "Demo" ? "demo" : "used";

  const openSocialPost = () => {
    setSelectedSocialImages(socialImages);
    setIsSocialPostOpen(true);
  };

  const toggleSocialImage = (uri: string) => {
    setSelectedSocialImages((prev) => (prev.includes(uri) ? prev.filter((u) => u !== uri) : [...prev, uri]));
  };

  const shareSocialPost = async () => {
    const selected = selectedSocialImages;
    const message = [
      vehicleName,
      vehicle.stockNumber ? `Stock #: ${vehicle.stockNumber}` : null,
      `Link: ${vehicleUrl}`,
      selected.length ? `Images:\n${selected.join("\n")}` : null,
    ]
      .filter((x): x is string => typeof x === "string" && x.length > 0)
      .join("\n");

    await Share.share({ message });
  };

  const onSliderScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const slideIndex = Math.round(event.nativeEvent.contentOffset.x / event.nativeEvent.layoutMeasurement.width);
    const next = Math.max(0, Math.min(slideIndex, Math.max(0, images.length - 1)));
    if (next !== activeSlide) setActiveSlide(next);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />

      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={20} color="#000000" />
        </Pressable>
        <Text style={styles.headerTitle}>Vehicle Details</Text>
        <View style={styles.headerActions}>
          <Pressable style={styles.headerActionButton} onPress={openSocialPost}>
              <Ionicons name="share-social" size={20} color={COLORS.text} />
          </Pressable>
          <Pressable style={styles.headerActionButton} onPress={() => router.push(`/inventory/edit/${vehicle.id}`)}>
              <Ionicons name="pencil" size={20} color={COLORS.text} />
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.topWidget}>
            <View style={styles.miniCircle}>
                <Ionicons name="time-outline" size={20} color={COLORS.success} />
            </View>
            <Text style={styles.topWidgetTitle}>Days in Stock</Text>
            <Text style={styles.topWidgetSubtitle}>{typeof daysInStock === "number" ? `${daysInStock} days` : "-"}</Text>
        </View>

        <View style={styles.imageSliderContainer}>
            <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={onSliderScroll}
                scrollEventThrottle={16}
                style={styles.imageSlider}
            >
                {images.map((uri, index) => (
                    <Image key={index} source={{ uri }} style={styles.slideImage} resizeMode="cover" />
                ))}
            </ScrollView>
            <View style={styles.pagination}>
                {images.map((_, index) => (
                    <View key={index} style={[styles.dot, index === activeSlide ? styles.activeDot : null]} />
                ))}
            </View>
        </View>

        <View style={styles.mainCard}>
            <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>{vehicleName}</Text>
                <Text style={styles.cardSubtitle}>{vehicle.variant}</Text>
                <View style={styles.badgeRow}>
                  {isSpecial ? (
                    <View style={[styles.badge, styles.badgeSpecial]}>
                      <Text style={[styles.badgeText, styles.badgeTextLight]}>SPECIAL</Text>
                    </View>
                  ) : null}
                  <View
                    style={[
                      styles.badge,
                      conditionBadgeVariant === "new"
                        ? styles.badgeNew
                        : conditionBadgeVariant === "demo"
                          ? styles.badgeDemo
                          : styles.badgeUsed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.badgeText,
                        conditionBadgeVariant === "demo" ? styles.badgeTextDark : styles.badgeTextLight,
                      ]}
                    >
                      {vehicle.condition.toUpperCase()}
                    </Text>
                  </View>
                </View>
            </View>

            <View style={styles.ringContainer}>
                <View style={styles.ringOuter}>
                    <View style={styles.ringInner}>
                        <Text style={styles.ringLabel}>Selling Price</Text>
                        <Text style={styles.ringValue}>{formatCurrency(vehicle.price)}</Text>
                        {vehicle.showOriginalPrice && typeof vehicle.originalPrice === "number" ? (
                          <Text style={styles.wasPrice}>Was {formatCurrency(vehicle.originalPrice)}</Text>
                        ) : null}
                        {monthlyPaymentText ? <Text style={styles.monthlyPayment}>Est. {monthlyPaymentText}/mo</Text> : null}
                        
                        <Pressable style={styles.ringButton}>
                            <Text style={styles.ringButtonText}>Stock #{vehicle.stockNumber}</Text>
                        </Pressable>
                    </View>
                    <View style={[styles.ringBorder, { borderRightColor: COLORS.primary, borderTopColor: COLORS.primary }]} />
                </View>
            </View>

            <View style={styles.statsRow}>
                <View style={styles.statItem}>
                    <Ionicons name="speedometer-outline" size={20} color={COLORS.primary} />
                    <Text style={styles.statValue}>{vehicle.mileage.toLocaleString()} km</Text>
                    <Text style={styles.statLabel}>Mileage</Text>
                </View>
                <View style={styles.statItem}>
                    <Ionicons name="color-palette-outline" size={20} color={COLORS.primary} />
                    <Text style={styles.statValue}>{vehicle.color}</Text>
                    <Text style={styles.statLabel}>Color</Text>
                </View>
                <View style={styles.statItem}>
                    <Ionicons name="cog-outline" size={20} color={COLORS.primary} />
                    <Text style={styles.statValue}>{vehicle.transmission}</Text>
                    <Text style={styles.statLabel}>Trans</Text>
                </View>
                <View style={styles.statItem}>
                    <Ionicons name="flame-outline" size={20} color={COLORS.primary} />
                    <Text style={styles.statValue}>{vehicle.fuelType}</Text>
                    <Text style={styles.statLabel}>Fuel</Text>
                </View>
            </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Listing Details</Text>
          <AdminRow label="Status" value={vehicle.status} />
          <AdminRow label="Condition" value={vehicle.condition} />
          <AdminRow label="Branch" value={vehicle.branch} />
          <AdminRow label="Show on Homepage" value={vehicle.showOnHomepage ? "Yes" : "No"} />
          <AdminRow label="Special Offer Badge" value={vehicle.isSpecialOffer ? "Yes" : "No"} />
          <AdminRow label="Created" value={formatDateShort(vehicle.createdAt)} />
          {vehicle.warrantyMonths != null ? <AdminRow label="Warranty (Months)" value={String(vehicle.warrantyMonths)} /> : null}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.descriptionText}>{descriptionText || "No description provided."}</Text>
        </View>

        {vehicle.features && vehicle.features.length > 0 && (
            <View style={styles.sectionCard}>
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

        <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Specifications</Text>
            <View style={styles.specsGrid}>
                {specItems.map((s) => (
                  <SpecItem key={s.label} icon={s.icon} label={s.label} value={s.value} />
                ))}
            </View>
        </View>

        <View style={[styles.sectionCard, { borderColor: COLORS.border, borderWidth: 1 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                <Ionicons name="lock-closed-outline" size={18} color={COLORS.textMuted} style={{ marginRight: 8 }} />
                <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Internal / Admin</Text>
            </View>
            
            <AdminRow label="VIN Number" value={vehicle.vin} />
            <AdminRow label="Engine Number" value={vehicle.engineNumber} />
            <AdminRow label="Natis Number" value={vehicle.natisNumber} />
            <AdminRow label="Registration Number" value={vehicle.registrationNumber} />
            <AdminRow label="Cost Price" value={formatCurrencyOrDash(vehicle.costPrice)} />
            <AdminRow label="Reconditioning Cost" value={formatCurrencyOrDash(vehicle.reconditioningCost)} />
            <AdminRow label="Supplier / Source" value={vehicle.supplier} />
            <AdminRow label="Previous Owner" value={vehicle.previousOwner} />
            <AdminRow label="Key Number" value={vehicle.keyNumber} />
            <AdminRow label="Service History" value={vehicle.serviceHistory ? "Yes" : "No"} />
            <AdminRow label="Active Motoplan" value={vehicle.motoplan ? "Yes" : "No"} />
            {vehicle.motoplan ? <AdminRow label="Motoplan Expiry" value={vehicle.motoplanUntil ?? "-"} /> : null}
            <AdminRow label="Purchase Date" value={vehicle.purchaseDate ?? "-"} />
        </View>

      </ScrollView>

      <Modal visible={isSocialPostOpen} transparent animationType="slide" onRequestClose={() => setIsSocialPostOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Post Vehicle</Text>
              <Pressable style={styles.modalIconButton} onPress={() => setIsSocialPostOpen(false)}>
                <Ionicons name="close" size={20} color={COLORS.text} />
              </Pressable>
            </View>

            <Text style={styles.modalSubtitle}>{vehicleName}</Text>

            <View style={styles.modalLinkRow}>
              <Text style={styles.modalLinkText} numberOfLines={1}>
                {vehicleUrl}
              </Text>
              <Pressable style={styles.modalSmallButton} onPress={() => Linking.openURL(vehicleUrl)}>
                <Text style={styles.modalSmallButtonText}>Open</Text>
              </Pressable>
            </View>

            <View style={styles.modalTools}>
              <Pressable style={styles.modalSmallButton} onPress={() => setSelectedSocialImages(socialImages)}>
                <Text style={styles.modalSmallButtonText}>Select all</Text>
              </Pressable>
              <Pressable style={styles.modalSmallButton} onPress={() => setSelectedSocialImages([])}>
                <Text style={styles.modalSmallButtonText}>Clear</Text>
              </Pressable>
              <Text style={styles.modalCount}>{selectedSocialImages.length} selected</Text>
            </View>

            {socialImages.length ? (
              <ScrollView style={styles.modalGridScroll} contentContainerStyle={styles.modalGrid} showsVerticalScrollIndicator={false}>
                {socialImages.map((uri) => {
                  const selected = selectedSocialImages.includes(uri);
                  return (
                    <Pressable key={uri} style={styles.modalThumbWrap} onPress={() => toggleSocialImage(uri)}>
                      <Image source={{ uri }} style={styles.modalThumb} resizeMode="cover" />
                      <View style={[styles.modalThumbOverlay, selected ? styles.modalThumbOverlaySelected : null]}>
                        {selected ? <Ionicons name="checkmark-circle" size={18} color={COLORS.primary} /> : null}
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : (
              <Text style={styles.modalEmpty}>No images available for this vehicle.</Text>
            )}

            <View style={styles.modalActions}>
              <Pressable style={styles.modalButton} onPress={() => setIsSocialPostOpen(false)}>
                <Text style={styles.modalButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalButton, styles.modalPrimaryButton]}
                onPress={async () => {
                  await shareSocialPost();
                  setIsSocialPostOpen(false);
                }}
              >
                <Text style={[styles.modalButtonText, styles.modalPrimaryButtonText]}>Share</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <View style={styles.footer}>
        <Pressable style={styles.actionButton} onPress={() => router.push(`/inventory/edit/${vehicle.id}`)}>
            <Text style={styles.actionButtonText}>Edit Vehicle</Text>
            <Ionicons name="chevron-forward" size={20} color="#000" />
        </Pressable>
      </View>
    </View>
  );
}

const SpecItem = ({ icon, label, value }: SpecItemData) => (
    <View style={styles.specItem}>
        <Ionicons name={icon} size={20} color={COLORS.primary} style={{ marginBottom: 4 }} />
        <Text style={styles.specLabel}>{label}</Text>
        <Text style={styles.specValue}>{value}</Text>
    </View>
);

const AdminRow = ({ label, value }: { label: string; value?: string }) => (
    <View style={styles.adminRow}>
        <Text style={styles.adminLabel}>{label}</Text>
        <Text style={styles.adminValue}>{value == null || value === "" ? "-" : value}</Text>
    </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 10,
    paddingTop: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerActionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.cardHighlight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  topWidget: {
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 10,
  },
  miniCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.card,
    borderWidth: 2,
    borderColor: COLORS.cardHighlight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  topWidgetTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  topWidgetSubtitle: {
    color: COLORS.textMuted,
    fontSize: 12,
  },

  imageSliderContainer: {
    height: 250,
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 24,
    backgroundColor: COLORS.card,
  },
  imageSlider: {
    flex: 1,
  },
  slideImage: {
    width: width - 40,
    height: 250,
  },
  pagination: {
    position: 'absolute',
    bottom: 16,
    flexDirection: 'row',
    alignSelf: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  activeDot: {
    backgroundColor: COLORS.primary,
    width: 24,
  },

  mainCard: {
    backgroundColor: COLORS.card,
    borderRadius: 30,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
  },
  cardHeader: {
    alignItems: 'center',
    marginBottom: 30,
    width: '100%',
  },
  cardTitle: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 4,
    textAlign: 'center',
  },
  cardSubtitle: {
    color: COLORS.textMuted,
    fontSize: 16,
    textAlign: 'center',
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    marginTop: 12,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  badgeTextLight: {
    color: COLORS.text,
  },
  badgeTextDark: {
    color: COLORS.primaryForeground,
  },
  badgeSpecial: {
    backgroundColor: COLORS.danger,
  },
  badgeNew: {
    backgroundColor: COLORS.success,
  },
  badgeDemo: {
    backgroundColor: COLORS.primary,
  },
  badgeUsed: {
    backgroundColor: COLORS.cardHighlight,
  },
  ringContainer: {
    width: 220,
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 30,
    position: 'relative',
  },
  ringOuter: {
    width: '100%',
    height: '100%',
    borderRadius: 110,
    backgroundColor: '#1c1c20',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  ringBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 6,
    borderRadius: 110,
    borderColor: 'transparent',
    transform: [{ rotate: '-45deg' }],
  },
  ringInner: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
  },
  ringLabel: {
    color: COLORS.textMuted,
    fontSize: 14,
    marginBottom: 8,
  },
  ringValue: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 10,
    textAlign: 'center',
  },
  wasPrice: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginBottom: 6,
  },
  monthlyPayment: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginBottom: 12,
  },
  ringButton: {
    backgroundColor: COLORS.text,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  ringButtonText: {
    color: COLORS.background,
    fontSize: 12,
    fontWeight: '700',
  },

  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 8,
    paddingHorizontal: 4,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 8,
    textAlign: 'center',
  },
  statLabel: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginTop: 4,
  },

  sectionCard: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  descriptionText: {
    color: COLORS.textMuted,
    fontSize: 15,
    lineHeight: 24,
  },
  featuresContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  featureChip: {
    backgroundColor: COLORS.cardHighlight,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  featureText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '500',
  },

  specsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  specItem: {
    width: '48%',
    backgroundColor: COLORS.cardHighlight,
    padding: 12,
    borderRadius: 16,
    marginBottom: 0,
  },
  specLabel: {
    color: COLORS.textMuted,
    fontSize: 12,
  },
  specValue: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },

  adminRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardHighlight,
  },
  adminLabel: {
    color: COLORS.textMuted,
    fontSize: 14,
  },
  adminValue: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 16,
    height: Math.min(height * 0.85, 720),
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  modalTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '800',
  },
  modalIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.cardHighlight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSubtitle: {
    color: COLORS.textMuted,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 14,
  },
  modalLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  modalLinkText: {
    flex: 1,
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '600',
  },
  modalSmallButton: {
    backgroundColor: COLORS.cardHighlight,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
  },
  modalSmallButtonText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '800',
  },
  modalTools: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  modalGridScroll: {
    flex: 1,
  },
  modalCount: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 'auto',
  },
  modalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingBottom: 16,
  },
  modalThumbWrap: {
    width: (width - 40 - 32 - 20) / 3,
    aspectRatio: 1,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: COLORS.cardHighlight,
  },
  modalThumb: {
    width: '100%',
    height: '100%',
  },
  modalThumbOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    padding: 8,
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
  },
  modalThumbOverlaySelected: {
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  modalEmpty: {
    color: COLORS.textMuted,
    fontSize: 13,
    fontWeight: '600',
    paddingVertical: 10,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  modalButton: {
    flex: 1,
    backgroundColor: COLORS.cardHighlight,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalPrimaryButton: {
    backgroundColor: COLORS.primary,
  },
  modalButtonText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '800',
  },
  modalPrimaryButtonText: {
    color: COLORS.primaryForeground,
  },

  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    backgroundColor: COLORS.background,
  },
  actionButton: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 30,
    gap: 8,
  },
  actionButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '700',
  },
});
