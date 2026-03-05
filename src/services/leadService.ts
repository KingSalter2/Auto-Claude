import { Timestamp, collection, deleteDoc, doc, getDoc, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc, where } from "firebase/firestore";
import { firebaseDb } from "../lib/firebase";
import type { CrmStage, LeadStatus, LeadSubmission, LeadType } from "../models/lead";
import { upsertNotification } from "./notificationService";

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

function leadFromFirestore(id: string, data: Record<string, unknown>): LeadSubmission {
  const customer =
    typeof data.customer === "object" && data.customer !== null ? (data.customer as Record<string, unknown>) : null;
  const vehicle = typeof data.vehicle === "object" && data.vehicle !== null ? (data.vehicle as Record<string, unknown>) : null;
  const payload =
    typeof data.payload === "object" && data.payload !== null ? (data.payload as Record<string, unknown>) : {};

  const payloadVehicleName = typeof payload.vehicleName === "string" ? payload.vehicleName : null;
  const payloadStockNumber = typeof payload.stockNumber === "string" ? payload.stockNumber : null;

  return {
    id,
    type: (data.type as LeadType) ?? "contact",
    status: (data.status as LeadStatus) ?? "new",
    crmStage: typeof data.crmStage === "string" ? (data.crmStage as CrmStage) : null,
    createdAt: toIso(data.createdAt),
    updatedAt: toMaybeIso(data.updatedAt),
    updatedByEmail: typeof data.updatedByEmail === "string" ? data.updatedByEmail : null,
    source: typeof data.source === "string" ? data.source : null,
    assignedToEmail: typeof data.assignedToEmail === "string" ? data.assignedToEmail : null,
    assignedAt: toMaybeIso(data.assignedAt),
    followUpAt: toMaybeIso(data.followUpAt),
    followUpDone: typeof data.followUpDone === "boolean" ? data.followUpDone : null,
    followUpNote: typeof data.followUpNote === "string" ? data.followUpNote : null,
    customer:
      customer
        ? {
            name: typeof customer.name === "string" ? customer.name : null,
            email: typeof customer.email === "string" ? customer.email : null,
            phone: typeof customer.phone === "string" ? customer.phone : null,
          }
        : { name: null, email: null, phone: null },
    vehicle:
      vehicle
        ? {
            id: typeof vehicle.id === "string" ? vehicle.id : null,
            name: typeof vehicle.name === "string" ? vehicle.name : payloadVehicleName,
            stockNumber: typeof vehicle.stockNumber === "string" ? vehicle.stockNumber : payloadStockNumber,
          }
        : payloadVehicleName || payloadStockNumber
          ? { id: null, name: payloadVehicleName, stockNumber: payloadStockNumber }
          : null,
    payload: payload as Record<string, unknown>,
  };
}

function normalizeEmail(email: string | null | undefined) {
  const e = typeof email === "string" ? email.trim().toLowerCase() : "";
  return e.length > 0 ? e : null;
}

function leadTypeLabel(type: LeadType) {
  switch (type) {
    case "vehicle_enquiry":
      return "Vehicle Enquiry";
    case "test_drive":
      return "Test Drive";
    case "trade_in":
      return "Trade-In";
    case "finance":
      return "Finance";
    case "contact":
      return "Contact";
  }
}

function leadSummaryForFollowUp(lead: LeadSubmission) {
  const vehicle = lead.vehicle?.name || lead.vehicle?.stockNumber || "";
  const source = lead.source || "";
  const type = leadTypeLabel(lead.type);
  const bits = [type, source ? `Source: ${source}` : "", vehicle ? `Vehicle: ${vehicle}` : ""].filter(Boolean);
  return bits.join(" • ");
}

export function subscribeNewLeadCount(opts: { onNext: (count: number) => void }) {
  const q = query(collection(firebaseDb, "lead_submissions"), where("status", "==", "new"));
  return onSnapshot(q, (snap) => opts.onNext(snap.size), () => opts.onNext(0));
}

export function subscribeTotalLeadCount(opts: { onNext: (count: number) => void }) {
  const q = query(collection(firebaseDb, "lead_submissions"));
  return onSnapshot(q, (snap) => opts.onNext(snap.size), () => opts.onNext(0));
}

export function subscribeRecentLeads(opts: { onNext: (leads: LeadSubmission[]) => void; take?: number }) {
  const q = query(collection(firebaseDb, "lead_submissions"), orderBy("createdAt", "desc"), limit(opts.take ?? 25));
  return onSnapshot(
    q,
    (snap) => {
      const leads = snap.docs.map((d) => leadFromFirestore(d.id, d.data() as Record<string, unknown>));
      opts.onNext(leads);
    },
    () => opts.onNext([]),
  );
}

export function subscribeAssignedLeads(opts: { recipientEmail: string; onNext: (leads: LeadSubmission[]) => void; take?: number }) {
  const email = opts.recipientEmail.trim().toLowerCase();
  const q = query(collection(firebaseDb, "lead_submissions"), where("assignedToEmail", "==", email), orderBy("assignedAt", "desc"), limit(opts.take ?? 25));
  return onSnapshot(
    q,
    (snap) => {
      const leads = snap.docs.map((d) => leadFromFirestore(d.id, d.data() as Record<string, unknown>));
      opts.onNext(leads);
    },
    () => opts.onNext([]),
  );
}

export function subscribePendingFollowUps(opts: { recipientEmail: string; onNext: (leads: LeadSubmission[]) => void; take?: number }) {
  const email = opts.recipientEmail.trim().toLowerCase();
  const q = query(
    collection(firebaseDb, "lead_submissions"),
    where("assignedToEmail", "==", email),
    where("followUpDone", "==", false),
    orderBy("followUpAt", "asc"),
    limit(opts.take ?? 50),
  );
  return onSnapshot(
    q,
    (snap) => {
      const leads = snap.docs.map((d) => leadFromFirestore(d.id, d.data() as Record<string, unknown>));
      opts.onNext(leads);
    },
    () => opts.onNext([]),
  );
}

export async function getLead(id: string) {
  const snap = await getDoc(doc(firebaseDb, "lead_submissions", id));
  if (!snap.exists()) throw new Error("Lead not found");
  return leadFromFirestore(snap.id, snap.data() as Record<string, unknown>);
}

export async function updateLeadStatus(id: string, status: LeadStatus, actorEmail?: string | null) {
  const ref = doc(firebaseDb, "lead_submissions", id);
  const crmStage: CrmStage | null = status === "new" ? "new" : status === "contacted" || status === "reviewed" ? "contacted" : null;
  const updates: Record<string, unknown> = {
    status,
    updatedAt: serverTimestamp(),
    updatedByEmail: normalizeEmail(actorEmail),
  };
  if (status === "archived") updates.crmStage = null;
  else if (crmStage) updates.crmStage = crmStage;
  await updateDoc(ref, updates);
  return await getLead(id);
}

export async function updateLeadCrmStage(opts: { id: string; crmStage: CrmStage; actorEmail?: string | null }) {
  const ref = doc(firebaseDb, "lead_submissions", opts.id);
  const nextStatus: LeadStatus = opts.crmStage === "new" ? "new" : "contacted";
  await updateDoc(ref, {
    crmStage: opts.crmStage,
    status: nextStatus,
    updatedAt: serverTimestamp(),
    updatedByEmail: normalizeEmail(opts.actorEmail),
  });
  return await getLead(opts.id);
}

export async function assignLead(opts: { id: string; assignedToEmail: string | null; actorEmail?: string | null; notify?: boolean }) {
  const ref = doc(firebaseDb, "lead_submissions", opts.id);
  const assignedToEmail = normalizeEmail(opts.assignedToEmail);
  await updateDoc(ref, {
    assignedToEmail,
    assignedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedByEmail: normalizeEmail(opts.actorEmail),
  });
  const lead = await getLead(opts.id);
  if (assignedToEmail && opts.notify !== false) {
    const customerName = lead.customer?.name || "Customer";
    const title = "Lead assigned";
    const message = `${customerName} was assigned to you.`;
    void upsertNotification({
      type: "lead_assigned",
      recipientEmail: assignedToEmail,
      recipientUid: null,
      title,
      message,
      entityType: "lead_submission",
      entityId: lead.id,
      link: null,
      eventKey: `${lead.id}__${Date.now()}`,
    }).catch(() => {});
  }
  return lead;
}

export async function createLeadTaskAssignment(opts: {
  lead: LeadSubmission;
  assignedToEmail: string;
  assignedToName: string;
  assignedByEmail: string | null;
  assignedByName: string;
  note: string | null;
  priority: "low" | "medium" | "high";
  status?: "pending" | "in-progress" | "completed";
}) {
  const assignedToEmail = normalizeEmail(opts.assignedToEmail);
  if (!assignedToEmail) throw new Error("Missing assignee email");

  const titleBase = opts.lead.customer?.name?.trim() ? `Lead: ${opts.lead.customer.name.trim()}` : "Lead assigned";
  const taskRef = doc(collection(firebaseDb, "tasks"));

  const dueDate =
    opts.lead.followUpAt && Number.isFinite(Date.parse(opts.lead.followUpAt))
      ? Timestamp.fromDate(new Date(Date.parse(opts.lead.followUpAt)))
      : Timestamp.fromDate(new Date());

  const note = typeof opts.note === "string" ? opts.note.trim() : "";

  await setDoc(
    taskRef,
    {
      title: titleBase,
      description: note,
      assignedTo: opts.assignedToName,
      assignedToEmail,
      assignedBy: opts.assignedByName,
      assignedByEmail: normalizeEmail(opts.assignedByEmail),
      priority: opts.priority,
      status: opts.status ?? "pending",
      dueDate,
      type: "lead",
      leadSubmissionId: opts.lead.id,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  void upsertNotification({
    type: "task_assigned",
    recipientEmail: assignedToEmail,
    recipientUid: null,
    title: "Task assigned",
    message: titleBase,
    entityType: "task",
    entityId: taskRef.id,
    link: null,
    eventKey: taskRef.id,
  }).catch(() => {});

  return taskRef.id;
}

export async function setLeadFollowUp(opts: { id: string; followUpAt: Date | null; followUpNote?: string | null; actorEmail?: string | null }) {
  const ref = doc(firebaseDb, "lead_submissions", opts.id);
  const followUpNote = typeof opts.followUpNote === "string" ? opts.followUpNote.trim() : null;
  await updateDoc(ref, {
    followUpAt: opts.followUpAt ? Timestamp.fromDate(opts.followUpAt) : null,
    followUpDone: opts.followUpAt ? false : null,
    followUpNote: opts.followUpAt ? (followUpNote && followUpNote.length > 0 ? followUpNote : null) : null,
    updatedAt: serverTimestamp(),
    updatedByEmail: normalizeEmail(opts.actorEmail),
  });
  const lead = await getLead(opts.id);
  const appointmentId = `lead_${lead.id}__followup`;
  const appointmentRef = doc(firebaseDb, "appointments", appointmentId);
  if (!opts.followUpAt) {
    await deleteDoc(appointmentRef).catch(() => {});
    return lead;
  }
  const customer = lead.customer?.name || "Unknown Customer";
  const vehicleName = lead.vehicle?.name || lead.vehicle?.stockNumber || "";
  const leadSummary = leadSummaryForFollowUp(lead);
  await setDoc(
    appointmentRef,
    {
      title: "Follow-up",
      customer,
      startAt: Timestamp.fromDate(opts.followUpAt),
      type: "follow-up",
      location: vehicleName,
      assignedTo: lead.assignedToEmail ?? null,
      leadSubmissionId: lead.id,
      notes: lead.followUpNote ?? null,
      leadSummary,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  ).catch(() => {});
  return lead;
}

export async function setLeadFollowUpDone(opts: { id: string; done: boolean; actorEmail?: string | null }) {
  const ref = doc(firebaseDb, "lead_submissions", opts.id);
  await updateDoc(ref, {
    followUpDone: opts.done,
    updatedAt: serverTimestamp(),
    updatedByEmail: normalizeEmail(opts.actorEmail),
  });
  const lead = await getLead(opts.id);
  const appointmentId = `lead_${lead.id}__followup`;
  const appointmentRef = doc(firebaseDb, "appointments", appointmentId);
  if (opts.done) {
    await deleteDoc(appointmentRef).catch(() => {});
    return lead;
  }
  if (!lead.followUpAt) return lead;
  const ms = Date.parse(lead.followUpAt);
  if (!Number.isFinite(ms)) return lead;
  const followUpAt = new Date(ms);
  const customer = lead.customer?.name || "Unknown Customer";
  const vehicleName = lead.vehicle?.name || lead.vehicle?.stockNumber || "";
  const leadSummary = leadSummaryForFollowUp(lead);
  await setDoc(
    appointmentRef,
    {
      title: "Follow-up",
      customer,
      startAt: Timestamp.fromDate(followUpAt),
      type: "follow-up",
      location: vehicleName,
      assignedTo: lead.assignedToEmail ?? null,
      leadSubmissionId: lead.id,
      notes: lead.followUpNote ?? null,
      leadSummary,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  ).catch(() => {});
  return lead;
}

export function subscribeLead(opts: {
  id: string;
  onNext: (lead: LeadSubmission | null) => void;
  onError?: (error: unknown) => void;
}) {
  if (!firebaseDb) {
    opts.onNext(null);
    return () => {};
  }
  const ref = doc(firebaseDb, "lead_submissions", opts.id);
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        opts.onNext(null);
        return;
      }
      opts.onNext(leadFromFirestore(snap.id, snap.data() as Record<string, unknown>));
    },
    (error) => {
      opts.onError?.(error);
      opts.onNext(null);
    },
  );
}
