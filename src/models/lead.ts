export type LeadType = "vehicle_enquiry" | "test_drive" | "trade_in" | "finance" | "contact";
export type LeadStatus = "new" | "reviewed" | "contacted" | "archived";
export type CrmStage = "new" | "contacted" | "test_drive" | "finance" | "unqualified" | "sold";

export type LeadSubmission = {
  id: string;
  type: LeadType;
  status: LeadStatus;
  crmStage?: CrmStage | null;
  createdAt: string;
  updatedAt?: string | null;
  updatedByEmail?: string | null;
  source?: string | null;
  assignedToEmail?: string | null;
  assignedAt?: string | null;
  followUpAt?: string | null;
  followUpDone?: boolean | null;
  followUpNote?: string | null;
  customer: { name?: string | null; email?: string | null; phone?: string | null };
  vehicle?: { id?: string | null; name?: string | null; stockNumber?: string | null } | null;
  vehicleId?: string | null;
  vehicleSnapshot?: Record<string, unknown> | null;
  message?: string | null;
  payload: Record<string, unknown>;
};
