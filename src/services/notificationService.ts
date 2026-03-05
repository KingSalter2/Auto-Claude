import { Timestamp, collection, doc, limit, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where } from "firebase/firestore";
import { firebaseDb } from "../lib/firebase";

export type AppNotificationType = "lead_new" | "lead_assigned" | "lead_followup_due" | "vehicle_status_changed" | "task_assigned";
export type AppNotificationEntityType = "lead_submission" | "inventory" | "task";

export type AppNotification = {
  id: string;
  type: AppNotificationType;
  recipientEmail: string;
  recipientUid?: string | null;
  title: string;
  message: string;
  entityType: AppNotificationEntityType;
  entityId: string;
  link?: string | null;
  createdAt: string;
  readAt?: string | null;
  read?: boolean | null;
};

function notificationDocId(input: {
  type: AppNotificationType;
  recipientEmail: string;
  entityType: AppNotificationEntityType;
  entityId: string;
  eventKey?: string | null;
}) {
  const safe = (value: string) => encodeURIComponent(value).replace(/%/g, "_");
  const suffix = input.eventKey ? `__${safe(input.eventKey)}` : "";
  return `${input.type}__${safe(input.recipientEmail)}__${input.entityType}__${safe(input.entityId)}${suffix}`;
}

function toIso(v: unknown) {
  if (!v) return null;
  if (typeof v === "string") return v;
  if (v instanceof Timestamp) return v.toDate().toISOString();
  if (typeof v === "object" && v !== null && "toDate" in v && typeof (v as { toDate: () => Date }).toDate === "function") {
    return (v as { toDate: () => Date }).toDate().toISOString();
  }
  return null;
}

export async function upsertNotification(input: {
  type: AppNotificationType;
  recipientEmail: string;
  recipientUid?: string | null;
  title: string;
  message: string;
  entityType: AppNotificationEntityType;
  entityId: string;
  link?: string | null;
  eventKey?: string | null;
}) {
  const recipientEmail = input.recipientEmail.trim().toLowerCase();
  const id = notificationDocId({
    type: input.type,
    recipientEmail,
    entityType: input.entityType,
    entityId: input.entityId,
    eventKey: input.eventKey ?? null,
  });

  const ref = doc(firebaseDb, "notifications", id);
  await setDoc(
    ref,
    {
      type: input.type,
      recipientEmail,
      recipientUid: input.recipientUid ?? null,
      title: input.title,
      message: input.message,
      entityType: input.entityType,
      entityId: input.entityId,
      link: input.link ?? null,
      read: false,
      readAt: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  return id;
}

export function subscribeNotifications(opts: {
  recipientEmail: string;
  onNext: (items: AppNotification[]) => void;
  onError?: (error: unknown) => void;
  take?: number;
}) {
  const recipientEmail = opts.recipientEmail.trim().toLowerCase();
  const q = query(
    collection(firebaseDb, "notifications"),
    where("recipientEmail", "==", recipientEmail),
    limit(opts.take ?? 100),
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((d) => {
        const data = d.data() as Record<string, unknown>;
        return {
          id: d.id,
          type: (data.type as AppNotificationType) ?? "lead_new",
          recipientEmail: typeof data.recipientEmail === "string" ? data.recipientEmail : recipientEmail,
          recipientUid: typeof data.recipientUid === "string" ? data.recipientUid : null,
          title: typeof data.title === "string" ? data.title : "",
          message: typeof data.message === "string" ? data.message : "",
          entityType: (data.entityType as AppNotificationEntityType) ?? "lead_submission",
          entityId: typeof data.entityId === "string" ? data.entityId : "",
          link: typeof data.link === "string" ? data.link : null,
          createdAt: toIso(data.createdAt) ?? new Date().toISOString(),
          readAt: toIso(data.readAt),
          read: typeof data.read === "boolean" ? data.read : null,
        };
      });
      items.sort((a, b) => {
        const at = a.createdAt ? Date.parse(a.createdAt) : Number.NaN;
        const bt = b.createdAt ? Date.parse(b.createdAt) : Number.NaN;
        if (!Number.isFinite(at) && !Number.isFinite(bt)) return 0;
        if (!Number.isFinite(at)) return 1;
        if (!Number.isFinite(bt)) return -1;
        return bt - at;
      });
      opts.onNext(items);
    },
    (error) => {
      opts.onNext([]);
      opts.onError?.(error);
    },
  );
}

export function subscribeUnreadNotificationCount(opts: { recipientEmail: string; onNext: (count: number) => void }) {
  const recipientEmail = opts.recipientEmail.trim().toLowerCase();
  const q = query(collection(firebaseDb, "notifications"), where("recipientEmail", "==", recipientEmail), where("read", "==", false));
  return onSnapshot(q, (snap) => opts.onNext(snap.size), () => opts.onNext(0));
}

export async function markNotificationRead(notificationId: string) {
  await updateDoc(doc(firebaseDb, "notifications", notificationId), { read: true, readAt: serverTimestamp(), updatedAt: serverTimestamp() });
}
