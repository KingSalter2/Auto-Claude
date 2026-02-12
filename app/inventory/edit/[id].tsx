import { useState, useEffect } from "react";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Alert, ActivityIndicator } from "react-native";

import { Screen } from "../../../src/components/common/Screen";
import { Header } from "../../../src/components/common/Header";
import { EmptyState } from "../../../src/components/common/EmptyState";
import { VehicleForm } from "../../../src/components/inventory/VehicleForm";
import { getVehicle, updateVehicle } from "../../../src/services/vehicleService";
import type { Vehicle } from "../../../src/models/vehicle";

export default function VehicleEditScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
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
    return () => { cancelled = true; };
  }, [id]);

  const handleSubmit = async (data: Partial<Vehicle>) => {
    if (!vehicle) return;

    setIsSaving(true);
    try {
        // Clean up data before sending
      const vehicleData = {
        ...data,
        year: Number(data.year),
        price: Number(data.price) || 0,
        mileage: Number(data.mileage) || 0,
        costPrice: Number(data.costPrice) || 0,
        reconditioningCost: Number(data.reconditioningCost) || 0,
        estMonthlyPayment: Number(data.estMonthlyPayment) || 0,
        seats: Number(data.seats) || 5,
        warrantyMonths: Number(data.warrantyMonths) || 0,
      };

      await updateVehicle(vehicle.id, vehicleData);
      Alert.alert("Success", "Vehicle updated successfully", [
        { text: "OK", onPress: () => router.back() }
      ]);
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to update vehicle");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Screen>
        <Header title="Edit Vehicle" showBack />
        <ActivityIndicator size="large" style={{ marginTop: 40 }} />
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
      <Header title="Edit Vehicle" showBack />
      <VehicleForm 
        initialData={vehicle} 
        onSubmit={handleSubmit} 
        isSaving={isSaving} 
        submitLabel="Update Vehicle" 
      />
    </Screen>
  );
}
