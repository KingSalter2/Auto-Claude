import { useState } from "react";
import { useRouter } from "expo-router";
import { Alert } from "react-native";

import { Screen } from "../../src/components/common/Screen";
import { Header } from "../../src/components/common/Header";
import { VehicleForm } from "../../src/components/inventory/VehicleForm";
import { createVehicle } from "../../src/services/vehicleService";
import type { Vehicle } from "../../src/models/vehicle";

export default function VehicleNewScreen() {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (data: Partial<Vehicle>) => {
    if (!data.make || !data.model || !data.year) {
      Alert.alert("Validation Error", "Please fill in at least Make, Model, and Year.");
      return;
    }

    setIsSaving(true);
    try {
      // Clean up data before sending
      const vehicleData: Omit<Vehicle, "id" | "createdAt"> = {
        ...data,
        year: Number(data.year),
        price: Number(data.price) || 0,
        mileage: Number(data.mileage) || 0,
        costPrice: Number(data.costPrice) || 0,
        reconditioningCost: Number(data.reconditioningCost) || 0,
        estMonthlyPayment: Number(data.estMonthlyPayment) || 0,
        seats: Number(data.seats) || 5,
        warrantyMonths: Number(data.warrantyMonths) || 0,
        // Ensure required fields for TS
        make: data.make,
        model: data.model,
        fuelType: data.fuelType || "Petrol",
        transmission: data.transmission || "Automatic",
        condition: data.condition || "Used",
        status: data.status || "draft",
        stockNumber: data.stockNumber || `STK${Date.now().toString().slice(-4)}`,
        color: data.color || "White",
        bodyType: data.bodyType || "Sedan",
        images: data.images || [],
        features: data.features || [],
        branch: data.branch || "Main Branch",
      };

      const created = await createVehicle(vehicleData);
      Alert.alert("Success", "Vehicle created successfully", [
        { text: "OK", onPress: () => router.replace(`/inventory/${created.id}`) }
      ]);
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to create vehicle");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Screen>
      <Header title="Add New Vehicle" showBack />
      <VehicleForm onSubmit={handleSubmit} isSaving={isSaving} submitLabel="Create Vehicle" />
    </Screen>
  );
}
