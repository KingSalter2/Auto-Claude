import { addDoc, collection, doc, getDoc, onSnapshot, orderBy, query, updateDoc } from "firebase/firestore";
import { firebaseDb } from "../lib/firebase";
import type { FuelType, Transmission, Vehicle, VehicleCondition, VehicleStatus } from "../models/vehicle";

const FUEL_TYPES: FuelType[] = ["Petrol", "Diesel", "Electric", "Hybrid"];
const TRANSMISSIONS: Transmission[] = ["Manual", "Automatic"];
const CONDITIONS: VehicleCondition[] = ["New", "Used", "Demo"];
const STATUSES: VehicleStatus[] = ["available", "reserved", "sold", "draft"];

function asFuelType(value: unknown): FuelType {
  return typeof value === "string" && (FUEL_TYPES as string[]).includes(value) ? (value as FuelType) : "Petrol";
}

function asTransmission(value: unknown): Transmission {
  return typeof value === "string" && (TRANSMISSIONS as string[]).includes(value) ? (value as Transmission) : "Automatic";
}

function asCondition(value: unknown): VehicleCondition {
  return typeof value === "string" && (CONDITIONS as string[]).includes(value) ? (value as VehicleCondition) : "Used";
}

function asStatus(value: unknown): VehicleStatus {
  return typeof value === "string" && (STATUSES as string[]).includes(value) ? (value as VehicleStatus) : "draft";
}

function toIso(v: unknown) {
  if (!v) return new Date().toISOString();
  if (typeof v === "string") return v;
  if (typeof v === "object" && v !== null && "toDate" in v && typeof (v as { toDate: () => Date }).toDate === "function") {
    return (v as { toDate: () => Date }).toDate().toISOString();
  }
  return new Date().toISOString();
}

function toMaybeIso(v: unknown) {
  if (!v) return null;
  if (typeof v === "string") return v;
  if (typeof v === "object" && v !== null && "toDate" in v && typeof (v as { toDate: () => Date }).toDate === "function") {
    return (v as { toDate: () => Date }).toDate().toISOString();
  }
  return null;
}

function vehicleFromFirestore(id: string, data: Record<string, unknown>): Vehicle {
  return {
    id,
    make: typeof data.make === "string" ? data.make : "",
    model: typeof data.model === "string" ? data.model : "",
    variant: typeof data.variant === "string" ? data.variant : undefined,
    year: typeof data.year === "number" ? data.year : Number(data.year ?? new Date().getFullYear()),
    price: typeof data.price === "number" ? data.price : Number(data.price ?? 0),
    originalPrice: typeof data.originalPrice === "number" ? data.originalPrice : null,
    showOriginalPrice: typeof data.showOriginalPrice === "boolean" ? data.showOriginalPrice : null,
    mileage: typeof data.mileage === "number" ? data.mileage : Number(data.mileage ?? 0),
    fuelType: asFuelType(data.fuelType),
    transmission: asTransmission(data.transmission),
    bodyType: typeof data.bodyType === "string" ? data.bodyType : "Sedan",
    condition: asCondition(data.condition),
    color: typeof data.color === "string" ? data.color : "",
    engineSize: typeof data.engineSize === "string" ? data.engineSize : null,
    stockNumber: typeof data.stockNumber === "string" ? data.stockNumber : String(data.stockNumber ?? ""),
    status: asStatus(data.status),
    isSpecialOffer: typeof data.isSpecialOffer === "boolean" ? data.isSpecialOffer : null,
    motoplan: typeof data.motoplan === "boolean" ? data.motoplan : null,
    motoplanUntil: toMaybeIso(data.motoplanUntil),
    serviceHistory: typeof data.serviceHistory === "boolean" ? data.serviceHistory : null,
    showOnHomepage: typeof data.showOnHomepage === "boolean" ? data.showOnHomepage : null,
    showAsSpecial: typeof data.showAsSpecial === "boolean" ? data.showAsSpecial : null,
    images: Array.isArray(data.images) ? (data.images.filter((x) => typeof x === "string") as string[]) : [],
    createdAt: toIso(data.createdAt),
    
    // New fields
    drive: typeof data.drive === "string" && ["FWD", "RWD", "AWD", "4x4", "4x2"].includes(data.drive) ? data.drive as any : undefined,
    seats: typeof data.seats === "number" ? data.seats : undefined,
    features: Array.isArray(data.features) ? (data.features.filter((x) => typeof x === "string") as string[]) : [],
    estMonthlyPayment: typeof data.estMonthlyPayment === "number" ? data.estMonthlyPayment : undefined,
    vin: typeof data.vin === "string" ? data.vin : undefined,
    engineNumber: typeof data.engineNumber === "string" ? data.engineNumber : undefined,
    registrationNumber: typeof data.registrationNumber === "string" ? data.registrationNumber : undefined,
    costPrice: typeof data.costPrice === "number" ? data.costPrice : undefined,
    reconditioningCost: typeof data.reconditioningCost === "number" ? data.reconditioningCost : undefined,
    natisNumber: typeof data.natisNumber === "string" ? data.natisNumber : undefined,
    previousOwner: typeof data.previousOwner === "string" ? data.previousOwner : undefined,
    keyNumber: typeof data.keyNumber === "string" ? data.keyNumber : undefined,
    supplier: typeof data.supplier === "string" ? data.supplier : undefined,
    purchaseDate: toMaybeIso(data.purchaseDate) || undefined,
    branch: typeof data.branch === "string" ? data.branch : "Main",
    description: typeof data.description === "string" ? data.description : undefined,
    descriptionMode: typeof data.descriptionMode === "string" && ["ai", "manual"].includes(data.descriptionMode) ? data.descriptionMode as any : "manual",
    warrantyMonths: typeof data.warrantyMonths === "number" ? data.warrantyMonths : undefined,
  };
}

export function subscribeInventoryVehicles(opts: { onNext: (vehicles: Vehicle[]) => void }) {
  const q = query(collection(firebaseDb, "inventory"), orderBy("createdAt", "desc"));
  return onSnapshot(
    q,
    (snap) => {
      const vehicles = snap.docs.map((d) => vehicleFromFirestore(d.id, d.data() as Record<string, unknown>));
      opts.onNext(vehicles);
    },
    () => opts.onNext([]),
  );
}

export async function getVehicle(id: string) {
  const snap = await getDoc(doc(firebaseDb, "inventory", id));
  if (!snap.exists()) throw new Error("Vehicle not found");
  return vehicleFromFirestore(snap.id, snap.data() as Record<string, unknown>);
}

function cleanUndefined(obj: Record<string, unknown>) {
  const next: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) next[k] = v;
  }
  return next;
}

export async function updateVehicle(id: string, patch: Partial<Vehicle>) {
  await updateDoc(doc(firebaseDb, "inventory", id), cleanUndefined(patch));
}

export async function createVehicle(vehicle: Omit<Vehicle, "id" | "createdAt">) {
  const now = new Date();
  const data = cleanUndefined({
    ...vehicle,
    createdAt: now.toISOString(),
  });
  const ref = await addDoc(collection(firebaseDb, "inventory"), data);
  return { id: ref.id, ...data };
}
