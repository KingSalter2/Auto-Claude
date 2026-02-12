import { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Pressable,
  Switch,
  Image,
  Alert,
  ActivityIndicator,
  TextInput
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";

import { useTheme } from "../../theme/useTheme";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Badge } from "../ui/Badge";
import type { Vehicle, FuelType, Transmission, VehicleStatus, VehicleCondition } from "../../models/vehicle";
import { supabase, supabaseBucket } from "../../lib/supabase";

// --- Types & Constants ---

type TabKey = "basic" | "specs" | "pricing" | "media" | "internal";

interface VehicleFormProps {
  initialData?: Partial<Vehicle>;
  onSubmit: (data: Partial<Vehicle>) => Promise<void>;
  isSaving?: boolean;
  submitLabel?: string;
}

const TABS: { key: TabKey; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "basic", label: "Basic", icon: "information-circle-outline" },
  { key: "specs", label: "Specs", icon: "car-sport-outline" },
  { key: "pricing", label: "Pricing", icon: "pricetag-outline" },
  { key: "media", label: "Media", icon: "images-outline" },
  { key: "internal", label: "Internal", icon: "file-tray-full-outline" },
];

const FUEL_TYPES: FuelType[] = ["Petrol", "Diesel", "Electric", "Hybrid"];
const TRANSMISSIONS: Transmission[] = ["Automatic", "Manual"];
const CONDITIONS: VehicleCondition[] = ["Used", "New", "Demo"];
const STATUSES: VehicleStatus[] = ["available", "reserved", "sold", "draft"];
const DRIVE_TYPES = ["FWD", "RWD", "AWD", "4x4", "4x2"];
const BODY_TYPES = [
  "Sedan", "Hatchback", "SUV", "Coupe", "Double Cab", "Single Cab", "Extended Cab",
  "Cabriolet", "MPV", "Station Wagon", "Bus", "Panel Van", "Dropside", "Crossover"
];

// --- Helper Functions ---

function cleanFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "-");
}

async function uploadImageToSupabase(uri: string) {
  const res = await fetch(uri);
  const blob = await res.blob();
  const filename = `${Date.now()}-${Math.random().toString(16).slice(2)}.jpg`;
  const path = `vehicles/${cleanFileName(filename)}`;
  const { data, error } = await supabase.storage.from(supabaseBucket).upload(path, blob, {
    cacheControl: "31536000",
    upsert: false,
    contentType: "image/jpeg",
  });
  if (error || !data?.path) throw new Error(error?.message ?? "Upload failed");
  const { data: publicData } = supabase.storage.from(supabaseBucket).getPublicUrl(data.path);
  return publicData?.publicUrl ?? "";
}

// --- Component ---

export function VehicleForm({ initialData, onSubmit, isSaving = false, submitLabel = "Save Vehicle" }: VehicleFormProps) {
  const { tokens } = useTheme();
  const [activeTab, setActiveTab] = useState<TabKey>("basic");
  const [isUploading, setIsUploading] = useState(false);

  // Form State
  const [formData, setFormData] = useState<any>({
    make: "",
    model: "",
    variant: "",
    year: new Date().getFullYear(),
    price: 0,
    mileage: 0,
    fuelType: "Petrol",
    transmission: "Automatic",
    bodyType: "Sedan",
    condition: "Used",
    color: "",
    stockNumber: "",
    status: "draft",
    images: [],
    features: [],
    branch: "Main Branch",
    descriptionMode: "ai",
    ...initialData,
  });

  // Helper to update fields
  const updateField = (key: keyof Vehicle, value: any) => {
    setFormData((prev: any) => ({ ...prev, [key]: value }));
  };

  // Image Picker
  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
      aspect: [4, 3],
    });

    if (!result.canceled && result.assets[0].uri) {
      setIsUploading(true);
      try {
        const publicUrl = await uploadImageToSupabase(result.assets[0].uri);
        updateField("images", [...(formData.images || []), publicUrl]);
      } catch (err) {
        Alert.alert("Upload Failed", err instanceof Error ? err.message : "Unknown error");
      } finally {
        setIsUploading(false);
      }
    }
  };

  const removeImage = (index: number) => {
    const newImages = [...(formData.images || [])];
    newImages.splice(index, 1);
    updateField("images", newImages);
  };

  // Feature Management
  const [newFeature, setNewFeature] = useState("");
  const addFeature = () => {
    if (newFeature.trim()) {
      updateField("features", [...(formData.features || []), newFeature.trim()]);
      setNewFeature("");
    }
  };
  const removeFeature = (index: number) => {
    const newFeatures = [...(formData.features || [])];
    newFeatures.splice(index, 1);
    updateField("features", newFeatures);
  };

  // Renderers
  const renderInput = (label: string, key: keyof Vehicle, placeholder?: string, keyboardType: any = "default", multiline = false) => (
    <View style={styles.fieldContainer}>
      <Text style={styles.label}>{label}</Text>
      <Input
        value={formData[key]?.toString() || ""}
        onChangeText={(text) => updateField(key, text)}
        placeholder={placeholder}
        keyboardType={keyboardType}
        multiline={multiline}
      />
    </View>
  );

  const renderSelect = (label: string, key: keyof Vehicle, options: string[]) => (
    <View style={styles.fieldContainer}>
      <Text style={styles.label}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsContainer}>
        {options.map((opt) => (
          <Pressable
            key={opt}
            onPress={() => updateField(key, opt)}
            style={[
              styles.chip,
              formData[key] === opt && { backgroundColor: tokens.primary, borderColor: tokens.primary },
            ]}
          >
            <Text
              style={[
                styles.chipText,
                formData[key] === opt && { color: tokens.background, fontWeight: "700" },
              ]}
            >
              {opt}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );

  const renderSwitch = (label: string, key: keyof Vehicle) => (
    <View style={styles.switchRow}>
      <Text style={styles.label}>{label}</Text>
      <Switch
        value={!!formData[key]}
        onValueChange={(val) => updateField(key, val)}
        trackColor={{ false: tokens.border, true: tokens.primary }}
        thumbColor={tokens.card}
      />
    </View>
  );

  // Styles
  const styles = StyleSheet.create({
    container: { flex: 1 },
    tabsContainer: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: tokens.border,
        backgroundColor: tokens.card,
    },
    tab: {
      marginRight: 16,
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: tokens.radius.full,
      backgroundColor: tokens.background,
      borderWidth: 1,
      borderColor: tokens.border,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    activeTab: {
      backgroundColor: tokens.primary,
      borderColor: tokens.primary,
    },
    tabText: {
      color: tokens.mutedForeground,
      fontWeight: "600",
      fontSize: 13,
    },
    activeTabText: {
      color: tokens.background,
      fontWeight: "800",
    },
    content: {
      padding: 16,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: "800",
      color: tokens.accent,
      marginBottom: 16,
      marginTop: 8,
    },
    fieldContainer: {
      marginBottom: 16,
    },
    label: {
      fontSize: 13,
      fontWeight: "700",
      color: tokens.mutedForeground,
      marginBottom: 8,
    },
    chipsContainer: {
      gap: 8,
    },
    chip: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: tokens.radius.md,
      borderWidth: 1,
      borderColor: tokens.border,
      backgroundColor: tokens.card,
    },
    chipText: {
      fontSize: 13,
      fontWeight: "600",
      color: tokens.accent,
    },
    switchRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 16,
      paddingVertical: 4,
    },
    imageGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginTop: 8
    },
    imageItem: {
        width: 100,
        height: 100,
        borderRadius: tokens.radius.md,
        overflow: 'hidden',
        position: 'relative'
    },
    image: {
        width: '100%',
        height: '100%',
    },
    removeBtn: {
        position: 'absolute',
        top: 4,
        right: 4,
        backgroundColor: 'rgba(0,0,0,0.6)',
        borderRadius: 12,
        padding: 4
    },
    addImageBtn: {
        width: 100,
        height: 100,
        borderRadius: tokens.radius.md,
        borderWidth: 2,
        borderColor: tokens.border,
        borderStyle: 'dashed',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: tokens.card
    },
    featureRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 8
    },
    featureChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: tokens.card,
        borderRadius: tokens.radius.full,
        paddingHorizontal: 12,
        paddingVertical: 6,
        marginRight: 8,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: tokens.border
    }
  });

  return (
    <View style={styles.container}>
      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {TABS.map((tab) => (
            <Pressable
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              style={[styles.tab, activeTab === tab.key && styles.activeTab]}
            >
              <Ionicons 
                name={tab.icon} 
                size={16} 
                color={activeTab === tab.key ? tokens.background : tokens.mutedForeground} 
              />
              <Text style={[styles.tabText, activeTab === tab.key && styles.activeTabText]}>
                {tab.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
        
        {/* Basic Info Tab */}
        {activeTab === "basic" && (
          <View>
            <Text style={styles.sectionTitle}>Basic Information</Text>
            {renderInput("Make", "make", "e.g. BMW")}
            {renderInput("Model", "model", "e.g. 3 Series")}
            {renderInput("Variant", "variant", "e.g. 320i M Sport")}
            {renderInput("Year", "year", "2024", "numeric")}
            {renderInput("Stock Number", "stockNumber", "e.g. STK001")}
            {renderInput("Branch", "branch", "Main Branch")}
            {renderSelect("Condition", "condition", CONDITIONS)}
            {renderSelect("Status", "status", STATUSES)}
            {renderSwitch("Show on Homepage", "showOnHomepage")}
            {renderSwitch("Special Offer Badge", "isSpecialOffer")}
          </View>
        )}

        {/* Specs Tab */}
        {activeTab === "specs" && (
          <View>
            <Text style={styles.sectionTitle}>Specifications</Text>
            {renderInput("Mileage (km)", "mileage", "0", "numeric")}
            {renderInput("Color", "color", "e.g. Alpine White")}
            {renderInput("Engine Size", "engineSize", "e.g. 2.0L")}
            {renderInput("Seats", "seats", "5", "numeric")}
            {renderSelect("Transmission", "transmission", TRANSMISSIONS)}
            {renderSelect("Fuel Type", "fuelType", FUEL_TYPES)}
            {renderSelect("Drive Type", "drive", DRIVE_TYPES)}
            {renderSelect("Body Type", "bodyType", BODY_TYPES)}
          </View>
        )}

        {/* Pricing Tab */}
        {activeTab === "pricing" && (
          <View>
            <Text style={styles.sectionTitle}>Pricing</Text>
            {renderInput("Selling Price (R)", "price", "0.00", "numeric")}
            {renderSwitch("On Promotion (Show Was Price)", "showOriginalPrice")}
            {formData.showOriginalPrice && (
                renderInput("Was Price (Original)", "originalPrice", "0.00", "numeric")
            )}
            {renderInput("Est. Monthly Payment", "estMonthlyPayment", "0.00", "numeric")}
          </View>
        )}

        {/* Media Tab */}
        {activeTab === "media" && (
          <View>
            <Text style={styles.sectionTitle}>Media & Content</Text>
            
            <Text style={styles.label}>Photos ({formData.images?.length || 0})</Text>
            <View style={styles.imageGrid}>
                {formData.images?.map((uri: string, index: number) => (
                    <View key={index} style={styles.imageItem}>
                        <Image source={{ uri }} style={styles.image} resizeMode="cover" />
                        <Pressable style={styles.removeBtn} onPress={() => removeImage(index)}>
                            <Ionicons name="close" size={14} color="white" />
                        </Pressable>
                    </View>
                ))}
                <Pressable style={styles.addImageBtn} onPress={pickImage} disabled={isUploading}>
                    {isUploading ? (
                        <ActivityIndicator color={tokens.primary} />
                    ) : (
                        <Ionicons name="add" size={32} color={tokens.mutedForeground} />
                    )}
                </Pressable>
            </View>

            <View style={{ height: 24 }} />

            <Text style={styles.label}>Description</Text>
            {renderSelect("Description Mode", "descriptionMode", ["ai", "manual"])}
            {formData.descriptionMode === 'manual' && (
                renderInput("Manual Description", "description", "Enter vehicle description...", "default", true)
            )}
            
            <View style={{ height: 24 }} />
            
            <Text style={styles.label}>Features</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {formData.features?.map((feat: string, idx: number) => (
                    <View key={idx} style={styles.featureChip}>
                        <Text style={{ color: tokens.accent, fontSize: 12 }}>{feat}</Text>
                        <Pressable onPress={() => removeFeature(idx)}>
                            <Ionicons name="close-circle" size={16} color={tokens.mutedForeground} style={{ marginLeft: 4 }} />
                        </Pressable>
                    </View>
                ))}
            </View>
            <View style={styles.featureRow}>
                <View style={{ flex: 1 }}>
                    <Input 
                        value={newFeature} 
                        onChangeText={setNewFeature} 
                        placeholder="Add feature (e.g. Sunroof)" 
                    />
                </View>
                <Button size="sm" onPress={addFeature} disabled={!newFeature.trim()}>Add</Button>
            </View>
          </View>
        )}

        {/* Internal Tab */}
        {activeTab === "internal" && (
          <View>
            <Text style={styles.sectionTitle}>Internal & Admin</Text>
            {renderInput("VIN Number", "vin", "Vehicle Identification Number")}
            {renderInput("Engine Number", "engineNumber", "")}
            {renderInput("Natis Number", "natisNumber", "")}
            {renderInput("Registration Number", "registrationNumber", "")}
            {renderInput("Cost Price (R)", "costPrice", "0.00", "numeric")}
            {renderInput("Reconditioning Cost (R)", "reconditioningCost", "0.00", "numeric")}
            {renderInput("Supplier / Source", "supplier", "")}
            {renderInput("Previous Owner", "previousOwner", "")}
            {renderInput("Key Number", "keyNumber", "")}
            {renderSwitch("Service History", "serviceHistory")}
            {renderSwitch("Active Motoplan", "motoplan")}
            {formData.motoplan && (
                renderInput("Motoplan Expiry (YYYY-MM-DD)", "motoplanUntil", "2025-12-31")
            )}
            {renderInput("Purchase Date (YYYY-MM-DD)", "purchaseDate", "2024-01-01")}
          </View>
        )}

        <View style={{ height: 32 }} />
        <Button 
            onPress={() => onSubmit(formData)} 
            disabled={isSaving || isUploading}
            size="lg"
        >
            {isSaving ? "Saving..." : submitLabel}
        </Button>
        <View style={{ height: 48 }} />

      </ScrollView>
    </View>
  );
}
