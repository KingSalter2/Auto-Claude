export type FuelType = "Petrol" | "Diesel" | "Electric" | "Hybrid";
export type Transmission = "Manual" | "Automatic";
export type VehicleCondition = "New" | "Used" | "Demo";
export type VehicleStatus = "available" | "reserved" | "sold" | "draft";

export type Vehicle = {
  id: string;
  make: string;
  model: string;
  variant?: string;
  year: number;
  price: number;
  originalPrice?: number | null;
  showOriginalPrice?: boolean | null;
  mileage: number;
  fuelType: FuelType;
  transmission: Transmission;
  bodyType: string;
  condition: VehicleCondition;
  color: string;
  engineSize?: string | null;
  stockNumber: string;
  status: VehicleStatus;
  isSpecialOffer?: boolean | null;
  motoplan?: boolean | null;
  motoplanUntil?: string | null;
  serviceHistory?: boolean | null;
  showOnHomepage?: boolean | null;
  showAsSpecial?: boolean | null;
  images: string[];
  createdAt: string;

  // Added for parity with Web App
  drive?: 'FWD' | 'RWD' | 'AWD' | '4x4' | '4x2';
  driveType?: 'FWD' | 'RWD' | 'AWD' | '4x4' | '4x2'; // Alias for drive
  seats?: number;
  features: string[]; // Web app uses string[]
  estMonthlyPayment?: number;
  vin?: string;
  engineNumber?: string;
  engineCapacity?: string; // Alias for engineSize
  powerKw?: string;
  registrationNumber?: string;
  registration?: string; // Alias for registrationNumber
  costPrice?: number;
  reconditioningCost?: number;
  natisNumber?: string;
  previousOwner?: string;
  keyNumber?: string;
  supplier?: string;
  purchaseDate?: string; // Web app uses Date, but JSON/Supabase usually returns string. Keeping string for mobile simplicity.
  branch: string;
  description?: string;
  descriptionMode?: 'ai' | 'manual';
  warrantyMonths?: number;
  videoUrl?: string;
  adminNotes?: string;
};
