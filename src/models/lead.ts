export type LeadType = "vehicle_enquiry" | "test_drive" | "trade_in" | "finance" | "contact";
export type LeadStatus = "new" | "reviewed" | "contacted" | "archived";

export type LeadSubmission = {
  id: string;
  type: LeadType;
  status: LeadStatus;
  createdAt: string;
  source?: string | null;
  customer: { name?: string | null; email?: string | null; phone?: string | null };
  vehicle?: { id?: string | null; name?: string | null; stockNumber?: string | null } | null;
  payload: Record<string, unknown>;
};

