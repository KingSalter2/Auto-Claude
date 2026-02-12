import { collection, doc, getDoc, limit, onSnapshot, orderBy, query, updateDoc, where } from "firebase/firestore";
import { firebaseDb } from "../lib/firebase";
import type { LeadStatus, LeadSubmission, LeadType } from "../models/lead";

function toIso(v: unknown) {
  if (!v) return new Date().toISOString();
  if (typeof v === "string") return v;
  if (typeof v === "object" && v !== null && "toDate" in v && typeof (v as { toDate: () => Date }).toDate === "function") {
    return (v as { toDate: () => Date }).toDate().toISOString();
  }
  return new Date().toISOString();
}

function leadFromFirestore(id: string, data: Record<string, unknown>): LeadSubmission {
  const customer =
    typeof data.customer === "object" && data.customer !== null ? (data.customer as Record<string, unknown>) : null;
  const vehicle = typeof data.vehicle === "object" && data.vehicle !== null ? (data.vehicle as Record<string, unknown>) : null;

  return {
    id,
    type: (data.type as LeadType) ?? "contact",
    status: (data.status as LeadStatus) ?? "new",
    createdAt: toIso(data.createdAt),
    source: typeof data.source === "string" ? data.source : null,
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
            name: typeof vehicle.name === "string" ? vehicle.name : null,
            stockNumber: typeof vehicle.stockNumber === "string" ? vehicle.stockNumber : null,
          }
        : null,
    payload: (typeof data.payload === "object" && data.payload !== null ? (data.payload as Record<string, unknown>) : {}) as Record<
      string,
      unknown
    >,
  };
}

export function subscribeNewLeadCount(opts: { onNext: (count: number) => void }) {
  const q = query(collection(firebaseDb, "lead_submissions"), where("status", "==", "new"));
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

export async function getLead(id: string) {
  const snap = await getDoc(doc(firebaseDb, "lead_submissions", id));
  if (!snap.exists()) throw new Error("Lead not found");
  return leadFromFirestore(snap.id, snap.data() as Record<string, unknown>);
}

export async function updateLeadStatus(id: string, status: LeadStatus) {
  const ref = doc(firebaseDb, "lead_submissions", id);
  await updateDoc(ref, { status });
  return await getLead(id);
}
