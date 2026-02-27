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
  TextInput,
  Modal,
  Dimensions
} from "react-native";
import type { KeyboardTypeOptions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useCameraPermissions } from "expo-camera";

import { useTheme } from "../../theme/useTheme";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import type { Vehicle, FuelType, Transmission, VehicleStatus, VehicleCondition } from "../../models/vehicle";
import { supabase, supabaseBucket } from "../../lib/supabase";

// --- Theme Constants (Dark Mode) ---
const THEME = {
  background: "#09090b", // Deep black/zinc
  card: "#18181b",       // Zinc-900
  primary: "#facc15",    // Vibrant Yellow
  text: "#ffffff",
  textMuted: "#a1a1aa",
  border: "#27272a",
  destructive: "#ef4444",
};

// --- Types & Constants ---

type TabKey = "basic" | "specs" | "pricing" | "media" | "internal";

interface VehicleFormProps {
  initialData?: Partial<Vehicle>;
  onSubmit: (data: Partial<Vehicle>) => Promise<void>;
  isSaving?: boolean;
  submitLabel?: string;
}

const TABS: { key: TabKey; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "basic", label: "Basic", icon: "information-circle" },
  { key: "specs", label: "Specs", icon: "car-sport" },
  { key: "pricing", label: "Pricing", icon: "pricetag" },
  { key: "media", label: "Media", icon: "images" },
  { key: "internal", label: "Internal", icon: "file-tray-full" },
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

type VehicleFormData = Partial<Vehicle> & {
  make: string;
  model: string;
  year: number;
  price: number;
  mileage: number;
  fuelType: FuelType;
  transmission: Transmission;
  bodyType: string;
  condition: VehicleCondition;
  color: string;
  stockNumber: string;
  status: VehicleStatus;
  images: string[];
  features: string[];
  branch: string;
  descriptionMode: "ai" | "manual";
};

export function VehicleForm({ initialData, onSubmit, isSaving = false, submitLabel = "Save Vehicle" }: VehicleFormProps) {
  const { tokens } = useTheme();
  const [activeTab, setActiveTab] = useState<TabKey>("basic");
  const [isUploading, setIsUploading] = useState(false);
  const [isVinScanOpen, setIsVinScanOpen] = useState(false);
  const [hasScannedVin, setHasScannedVin] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  // Form State
  const [formData, setFormData] = useState<VehicleFormData>({
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
  const updateField = (key: keyof VehicleFormData, value: unknown) => {
    setFormData((prev) => ({ ...prev, [key]: value } as VehicleFormData));
  };

  useEffect(() => {
    if (!isVinScanOpen) {
      setHasScannedVin(false);
      return;
    }
    if (cameraPermission?.granted) return;
    requestCameraPermission();
  }, [cameraPermission?.granted, isVinScanOpen, requestCameraPermission]);

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
  const renderInput = (label: string, key: keyof Vehicle, placeholder?: string, keyboardType: KeyboardTypeOptions = "default", multiline = false) => (
    <View style={styles.fieldContainer}>
      <Text style={styles.label}>{label}</Text>
      <Input
        value={formData[key] != null ? String(formData[key]) : ""}
        onChangeText={(text) => updateField(key, text)}
        placeholder={placeholder}
        keyboardType={keyboardType}
        multiline={multiline}
        style={{ backgroundColor: THEME.card, borderColor: THEME.border }}
        inputStyle={{ color: THEME.text }}
        placeholderTextColor={THEME.textMuted}
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
              formData[key] === opt && { backgroundColor: THEME.primary, borderColor: THEME.primary },
            ]}
          >
            <Text
              style={[
                styles.chipText,
                formData[key] === opt && { color: "#000", fontWeight: "700" },
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
        trackColor={{ false: THEME.border, true: THEME.primary }}
        thumbColor={THEME.text}
      />
    </View>
  );

  // Styles
  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: THEME.background },
    tabsWrapper: {
        backgroundColor: THEME.background,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: THEME.border,
    },
    tabsContainer: {
        paddingHorizontal: 16,
    },
    tab: {
      marginRight: 12,
      paddingVertical: 10,
      paddingHorizontal: 18,
      borderRadius: 100,
      backgroundColor: THEME.card,
      borderWidth: 1,
      borderColor: THEME.border,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    activeTab: {
      backgroundColor: THEME.primary,
      borderColor: THEME.primary,
    },
    tabText: {
      color: THEME.textMuted,
      fontWeight: "600",
      fontSize: 13,
    },
    activeTabText: {
      color: "#000",
      fontWeight: "800",
    },
    content: {
      padding: 20,
      paddingBottom: 100, // Extra padding for footer
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: "800",
      color: THEME.text,
      marginBottom: 20,
      marginTop: 8,
      letterSpacing: -0.5,
    },
    fieldContainer: {
      marginBottom: 20,
    },
    label: {
      fontSize: 14,
      fontWeight: "600",
      color: THEME.textMuted,
      marginBottom: 8,
    },
    chipsContainer: {
      gap: 10,
    },
    chip: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: THEME.border,
      backgroundColor: THEME.card,
    },
    chipText: {
      color: THEME.textMuted,
      fontSize: 14,
      fontWeight: "500",
    },
    switchRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 20,
      backgroundColor: THEME.card,
      padding: 16,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: THEME.border,
    },
    imageGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 16,
    },
    imageItem: {
        width: (Dimensions.get('window').width - 52) / 3,
        height: (Dimensions.get('window').width - 52) / 3,
        borderRadius: 12,
        overflow: 'hidden',
        position: 'relative',
        backgroundColor: THEME.card,
        borderWidth: 1,
        borderColor: THEME.border,
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
        borderRadius: 10,
        width: 20,
        height: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    uploadBtn: {
        width: (Dimensions.get('window').width - 52) / 3,
        height: (Dimensions.get('window').width - 52) / 3,
        borderRadius: 12,
        backgroundColor: THEME.card,
        borderWidth: 1,
        borderColor: THEME.border,
        borderStyle: 'dashed',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
    },
    uploadText: {
        fontSize: 12,
        color: THEME.textMuted,
        fontWeight: "600",
    },
    featuresList: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 12,
    },
    featureTag: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: THEME.card,
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 100,
        borderWidth: 1,
        borderColor: THEME.border,
        gap: 6,
    },
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 20,
        backgroundColor: THEME.background,
        borderTopWidth: 1,
        borderTopColor: THEME.border,
    }
  });

  return (
    <View style={styles.container}>
      {/* Tabs */}
      <View style={styles.tabsWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsContainer}>
            {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
                <Pressable
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                style={[styles.tab, isActive && styles.activeTab]}
                >
                <Ionicons 
                    name={tab.icon} 
                    size={16} 
                    color={isActive ? "#000" : THEME.textMuted} 
                />
                <Text style={[styles.tabText, isActive && styles.activeTabText]}>
                    {tab.label}
                </Text>
                </Pressable>
            );
            })}
        </ScrollView>
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        
        {/* BASIC INFO TAB */}
        {activeTab === "basic" && (
          <View>
            <Text style={styles.sectionTitle}>Basic Information</Text>
            {renderSelect("Condition", "condition", CONDITIONS)}
            {renderInput("Make", "make", "e.g. Toyota")}
            {renderInput("Model", "model", "e.g. Hilux")}
            {renderInput("Variant", "variant", "e.g. 2.8 GD-6 Legend")}
            {renderInput("Year", "year", "YYYY", "numeric")}
            {renderInput("Color", "color", "e.g. Glacier White")}
          </View>
        )}

        {/* SPECS TAB */}
        {activeTab === "specs" && (
          <View>
            <Text style={styles.sectionTitle}>Specifications</Text>
            {renderInput("Mileage (km)", "mileage", "0", "numeric")}
            {renderSelect("Transmission", "transmission", TRANSMISSIONS)}
            {renderSelect("Fuel Type", "fuelType", FUEL_TYPES)}
            {renderSelect("Body Type", "bodyType", BODY_TYPES)}
            {renderSelect("Drive Type", "driveType", DRIVE_TYPES)}
            {renderInput("Engine Capacity (cc)", "engineCapacity", "e.g. 2800", "numeric")}
            {renderInput("Power (kW)", "powerKw", "e.g. 150", "numeric")}
            
            <View style={styles.fieldContainer}>
                <Text style={styles.label}>Features</Text>
                <View style={styles.featuresList}>
                    {formData.features?.map((f, i) => (
                        <View key={i} style={styles.featureTag}>
                            <Text style={{ color: THEME.text, fontSize: 13 }}>{f}</Text>
                            <Pressable onPress={() => removeFeature(i)}>
                                <Ionicons name="close-circle" size={16} color={THEME.textMuted} />
                            </Pressable>
                        </View>
                    ))}
                </View>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                    <View style={{ flex: 1 }}>
                        <Input
                            value={newFeature}
                            onChangeText={setNewFeature}
                            placeholder="Add feature..."
                            style={{ backgroundColor: THEME.card, borderColor: THEME.border }}
                            inputStyle={{ color: THEME.text }}
                            placeholderTextColor={THEME.textMuted}
                        />
                    </View>
                    <Button onPress={addFeature} style={{ width: 50, height: 50, borderRadius: 12, paddingHorizontal: 0 }} variant="outline">
                        <Ionicons name="add" size={24} color={THEME.primary} />
                    </Button>
                </View>
            </View>
          </View>
        )}

        {/* PRICING TAB */}
        {activeTab === "pricing" && (
          <View>
            <Text style={styles.sectionTitle}>Pricing & Costs</Text>
            {renderInput("Selling Price (R)", "price", "0.00", "numeric")}
            {renderInput("Cost Price (R)", "costPrice", "0.00", "numeric")}
            {renderInput("Est. Reconditioning (R)", "reconditioningCost", "0.00", "numeric")}
            {renderInput("Est. Monthly Payment (R)", "estMonthlyPayment", "0.00", "numeric")}
            {renderSwitch("Show Original Price?", "showOriginalPrice")}
            {formData.showOriginalPrice && renderInput("Original Price (R)", "originalPrice", "0.00", "numeric")}
            {renderSwitch("Special Offer?", "isSpecialOffer")}
          </View>
        )}

        {/* MEDIA TAB */}
        {activeTab === "media" && (
          <View>
            <Text style={styles.sectionTitle}>Photos</Text>
            <View style={styles.imageGrid}>
                {formData.images?.map((uri, index) => (
                    <View key={index} style={styles.imageItem}>
                        <Image source={{ uri }} style={styles.image} resizeMode="cover" />
                        <Pressable onPress={() => removeImage(index)} style={styles.removeBtn}>
                            <Ionicons name="close" size={12} color="#fff" />
                        </Pressable>
                    </View>
                ))}
                <Pressable onPress={pickImage} style={styles.uploadBtn} disabled={isUploading}>
                    {isUploading ? (
                        <ActivityIndicator color={THEME.primary} />
                    ) : (
                        <>
                            <Ionicons name="camera-outline" size={24} color={THEME.textMuted} />
                            <Text style={styles.uploadText}>Add Photo</Text>
                        </>
                    )}
                </Pressable>
            </View>
            {renderInput("Video URL", "videoUrl", "https://youtube.com/...", "url")}
          </View>
        )}

        {/* INTERNAL TAB */}
        {activeTab === "internal" && (
          <View>
            <Text style={styles.sectionTitle}>Internal Details</Text>
            {renderInput("Stock Number", "stockNumber", "e.g. STK001")}
            {renderInput("VIN Number", "vin", "17 Characters")}
            {renderInput("License Plate", "registration", "e.g. CA 123-456")}
            {renderInput("Branch", "branch", "Main Branch")}
            {renderSelect("Status", "status", STATUSES)}
            {renderInput("Private Notes", "adminNotes", "Internal use only...", "default", true)}
          </View>
        )}
      </ScrollView>

      {/* Footer Action */}
      <View style={styles.footer}>
        <Button 
            onPress={() => onSubmit(formData)} 
            disabled={isSaving}
            style={{ backgroundColor: THEME.primary, height: 56 }}
            textStyle={{ color: "#000", fontSize: 16, fontWeight: "800" }}
        >
            {isSaving ? "Saving..." : submitLabel}
        </Button>
      </View>
    </View>
  );
}
