import { Linking, Pressable, StyleSheet, Text, View, ScrollView, Alert, ActivityIndicator, Dimensions, Modal, TextInput, Keyboard } from "react-native";
import { useEffect, useMemo, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as Notifications from "expo-notifications";
import { collection, onSnapshot, orderBy, query, Timestamp } from "firebase/firestore";

import { Screen } from "../../src/components/common/Screen";
import { Button } from "../../src/components/ui/Button";
import type { CrmStage, LeadStatus, LeadSubmission } from "../../src/models/lead";
import {
  assignLead,
  createLeadTaskAssignment,
  setLeadFollowUp,
  setLeadFollowUpDone,
  subscribeLead,
  updateLeadCrmStage,
  updateLeadStatus,
} from "../../src/services/leadService";
import { timeAgo, formatCurrency } from "../../src/utils/format";
import { useAuth } from "../../src/auth/AuthContext";
import { EmptyState } from "../../src/components/common/EmptyState";
import { firebaseDb } from "../../src/lib/firebase";

// Theme based on the "New Exercise" dark UI guide
const THEME = {
  background: "#09090b", // Deep black/zinc
  card: "#18181b",       // Zinc-900
  primary: "#facc15",    // Vibrant Yellow
  text: "#ffffff",
  textMuted: "#a1a1aa",
  border: "#27272a",
  success: "#22c55e",
  destructive: "#ef4444",
  info: "#3b82f6",
};

const CRM_STAGE_CHOICES: Array<{ label: string; value: CrmStage; icon: keyof typeof Ionicons.glyphMap }> = [
  { label: "New", value: "new", icon: "sparkles" },
  { label: "Contacted", value: "contacted", icon: "call" },
  { label: "Test Drive", value: "test_drive", icon: "car-sport" },
  { label: "Finance", value: "finance", icon: "card" },
  { label: "Unqualified", value: "unqualified", icon: "close-circle" },
  { label: "Sold", value: "sold", icon: "checkmark-circle" },
];

function digitsOnly(v: string) {
  return v.replace(/[^0-9]/g, "");
}

const TYPE_LABEL: Record<LeadSubmission["type"], string> = {
  vehicle_enquiry: "Vehicle Enquiry",
  test_drive: "Test Drive",
  trade_in: "Trade-In",
  finance: "Finance",
  contact: "Contact",
};

function formatLabel(key: string) {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/^./, (c) => c.toUpperCase());
}

function asDisplayValue(value: unknown): string {
  if (value == null) return "—";
  if (typeof value === "string") return value.trim() ? value : "—";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export default function LeadDetailsScreen() {
  const router = useRouter();
  const { canAccess, user, userProfile } = useAuth();
  const canSeeLeads = canAccess("Leads & CRM");
  const params = useLocalSearchParams<{ id: string }>();
  const id = params.id;
  const insets = useSafeAreaInsets();
  const actorEmail = (userProfile?.email ?? user?.email ?? null)?.trim().toLowerCase() ?? null;

  const [lead, setLead] = useState<LeadSubmission | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isFollowUpTimeOpen, setIsFollowUpTimeOpen] = useState(false);
  const [pendingFollowUpDate, setPendingFollowUpDate] = useState<Date | null>(null);
  const [followUpNoteDraft, setFollowUpNoteDraft] = useState("");
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [isAssignPickerOpen, setIsAssignPickerOpen] = useState(false);
  const [staffUsers, setStaffUsers] = useState<Array<{ id: string; name: string; email: string }>>([]);
  const [assignSelectedEmail, setAssignSelectedEmail] = useState<string | null>(null);
  const [assignSelectedName, setAssignSelectedName] = useState<string | null>(null);
  const [assignNoteDraft, setAssignNoteDraft] = useState("");
  const [assignPriority, setAssignPriority] = useState<"low" | "medium" | "high">("medium");
  const [showSubmissionExtras, setShowSubmissionExtras] = useState(false);

  const payload = lead?.payload ?? {};
  const getString = useMemo(
    () => (key: string) => {
      const value = payload[key];
      return typeof value === "string" ? value : undefined;
    },
    [payload],
  );
  const getNumber = useMemo(
    () => (key: string) => {
      const value = payload[key];
      if (typeof value === "number") return value;
      if (typeof value === "string") {
        const trimmed = value.trim();
        if (!trimmed) return undefined;
        const asNumber = Number(trimmed);
        return Number.isFinite(asNumber) ? asNumber : undefined;
      }
      return undefined;
    },
    [payload],
  );

  const submissionMessage = useMemo(() => {
    if (!lead) return null;
    const fromPayload = getString("message");
    if (fromPayload && fromPayload.trim()) return fromPayload.trim();
    if (lead.message && lead.message.trim()) return lead.message.trim();
    return null;
  }, [getString, lead]);

  const submissionDetails = useMemo(() => {
    if (!lead) return null;
    const shown = new Set<string>();

    const details: Array<{ label: string; value: string }> = [];

    const pushField = (label: string, key: string, value: string | null | undefined) => {
      shown.add(key);
      if (!value || !String(value).trim()) return;
      details.push({ label, value: String(value) });
    };

    const pushNumber = (label: string, key: string, value: number | undefined) => {
      shown.add(key);
      if (typeof value !== "number" || !Number.isFinite(value)) return;
      details.push({ label, value: String(value) });
    };

    const idNumber = getString("idNumber");
    if (idNumber) pushField("ID Number", "idNumber", idNumber);

    const preferredDate = getString("preferredDate");
    const preferredTime = getString("preferredTime");
    const stockNumber = getString("stockNumber");
    const year = getString("year");
    const make = getString("make");
    const model = getString("model");
    const mileageKm = getNumber("mileageKm");
    const vin = getString("vin");
    const notes = getString("notes");
    const employmentStatus = getString("employmentStatus");
    const grossMonthlyIncome = getNumber("grossMonthlyIncome");
    const depositAmount = getNumber("depositAmount");

    if (lead.type === "test_drive") {
      pushField("Preferred Date", "preferredDate", preferredDate ?? "—");
      pushField("Preferred Time", "preferredTime", preferredTime ?? "—");
    }

    if (lead.type === "trade_in") {
      const vehicleDetails = [year, make, model].filter((v): v is string => Boolean(v && v.trim()));
      if (vehicleDetails.length) {
        details.push({ label: "Trade-In Vehicle", value: vehicleDetails.join(" ") });
        shown.add("year");
        shown.add("make");
        shown.add("model");
      }
      pushNumber("Mileage (km)", "mileageKm", mileageKm);
      pushField("VIN", "vin", vin ?? "—");
      if (notes) pushField("Condition / Notes", "notes", notes);
    }

    if (lead.type === "finance") {
      if (employmentStatus) pushField("Employment Status", "employmentStatus", employmentStatus.replace(/_/g, " "));
      pushNumber("Gross Monthly Income", "grossMonthlyIncome", grossMonthlyIncome);
      pushNumber("Deposit Amount", "depositAmount", depositAmount);
    }

    if (lead.type === "vehicle_enquiry") {
      if (stockNumber) pushField("Stock Number", "stockNumber", stockNumber);
      const vehicleDetails = [year, make, model].filter((v): v is string => Boolean(v && v.trim()));
      if (vehicleDetails.length) {
        details.push({ label: "Vehicle", value: vehicleDetails.join(" ") });
        shown.add("year");
        shown.add("make");
        shown.add("model");
      }
    }

    if (submissionMessage) shown.add("message");

    const extras = Object.entries(payload)
      .filter(([k, v]) => !shown.has(k) && v !== undefined)
      .map(([k, v]) => ({ label: formatLabel(k), value: asDisplayValue(v) }))
      .filter((x) => x.value !== "—");

    return { details, extras };
  }, [getNumber, getString, lead, payload, submissionMessage]);

  useEffect(() => {
    if (!canSeeLeads) {
      setLead(null);
      setIsLoading(false);
      setError(null);
      return () => {};
    }
    setIsLoading(true);
    setError(null);
    return subscribeLead({
      id,
      onNext: (data) => {
        setLead(data);
        setIsLoading(false);
      },
      onError: (e) => {
        setError(e instanceof Error ? e.message : "Failed to load lead");
        setIsLoading(false);
      },
    });
  }, [canSeeLeads, id]);

  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () => setIsKeyboardVisible(true));
    const hide = Keyboard.addListener("keyboardDidHide", () => setIsKeyboardVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  useEffect(() => {
    const q = query(collection(firebaseDb, "users"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const mapped = snap.docs.map((d) => {
          const data = d.data() as Record<string, unknown>;
          const email = typeof data.email === "string" ? data.email : d.id;
          const name = typeof data.name === "string" && data.name.trim().length > 0 ? data.name : email;
          const createdAtRaw = data.createdAt;
          const createdAt =
            createdAtRaw instanceof Timestamp ? createdAtRaw.toDate().getTime() : createdAtRaw instanceof Date ? createdAtRaw.getTime() : 0;
          return { id: d.id, name, email, createdAt };
        });
        mapped.sort((a, b) => b.createdAt - a.createdAt);
        setStaffUsers(mapped.map(({ id, name, email }) => ({ id, name, email })));
      },
      () => setStaffUsers([]),
    );
    return () => unsub();
  }, []);

  const isArchived = lead?.status === "archived";
  const effectiveCrmStage: CrmStage = (lead?.crmStage ?? (lead?.status === "new" ? "new" : "contacted")) as CrmStage;
  const activeStatusLabel = isArchived
    ? "Archived"
    : CRM_STAGE_CHOICES.find((x) => x.value === effectiveCrmStage)?.label ?? "Status";

  const formatErrorMessage = (e: unknown, fallback: string) => {
    if (e instanceof Error && typeof e.message === "string" && e.message.trim().length > 0) return e.message;
    if (typeof e === "object" && e !== null && "code" in e && typeof (e as { code?: unknown }).code === "string") {
      return `${fallback} (${(e as { code: string }).code})`;
    }
    return fallback;
  };

  const syncFollowUpLocalReminders = async (opts: {
    leadId: string;
    customerName: string;
    followUpAt: Date | null;
    followUpNote: string | null;
    leadSummary: string | null;
    done: boolean;
  }) => {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync().catch(() => []);
    for (const n of scheduled) {
      const raw = n.content.data as unknown;
      const data = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
      if (data.kind === "followup" && data.leadId === opts.leadId) {
        await Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {});
      }
    }

    if (!opts.followUpAt || opts.done) return;

    const permission = await Notifications.getPermissionsAsync().catch(() => null);
    const granted = permission?.granted ?? permission?.ios?.status === Notifications.IosAuthorizationStatus.AUTHORIZED;
    if (!granted) {
      const req = await Notifications.requestPermissionsAsync().catch(() => null);
      const ok = req?.granted ?? req?.ios?.status === Notifications.IosAuthorizationStatus.AUTHORIZED;
      if (!ok) return;
    }

    const now = Date.now();
    const times = [
      { minutes: 30, label: "30 min" },
      { minutes: 15, label: "15 min" },
      { minutes: 0, label: "now" },
    ] as const;

    const baseBody = [opts.leadSummary ?? "", opts.followUpNote ?? ""].filter(Boolean).join("\n");

    for (const t of times) {
      const triggerMs = opts.followUpAt.getTime() - t.minutes * 60_000;
      if (triggerMs <= now + 3_000) continue;
      await Notifications.scheduleNotificationAsync({
        content: {
          title: t.minutes === 0 ? `Follow-up due: ${opts.customerName}` : `Follow-up in ${t.label}: ${opts.customerName}`,
          body: baseBody || "Tap to open the lead.",
          data: { type: "lead", leadId: opts.leadId, kind: "followup", minutes: t.minutes },
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(triggerMs) },
      }).catch(() => {});
    }
  };

  const handleCrmStageChange = async (nextStage: CrmStage) => {
    if (!lead) return;
    if (isArchived) return;
    setIsUpdating(true);
    try {
      await updateLeadCrmStage({ id: lead.id, crmStage: nextStage, actorEmail });
    } catch {
      Alert.alert("Error", "Failed to update pipeline stage");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleArchiveLead = async () => {
    if (!lead) return;
    Alert.alert("Archive lead?", "This will hide the lead from your active pipeline.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Archive",
        style: "destructive",
        onPress: async () => {
          setIsUpdating(true);
          try {
            await updateLeadStatus(lead.id, "archived", actorEmail);
          } catch {
            Alert.alert("Error", "Failed to archive lead");
          } finally {
            setIsUpdating(false);
          }
        },
      },
    ]);
  };

  const handleUnassign = async () => {
    if (!lead) return;
    setIsUpdating(true);
    try {
      await assignLead({ id: lead.id, assignedToEmail: null, actorEmail });
      setIsAssignPickerOpen(false);
    } catch {
      Alert.alert("Error", "Failed to unassign lead");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleConfirmAssign = async () => {
    if (!lead) return;
    const selectedEmail = (assignSelectedEmail ?? "").trim().toLowerCase();
    if (!selectedEmail) {
      Alert.alert("Missing assignee", "Select a staff member to assign this task.");
      return;
    }
    const assignedToName =
      (assignSelectedName && assignSelectedName.trim().length > 0 ? assignSelectedName.trim() : selectedEmail) || selectedEmail;

    const assignedByName = userProfile?.name?.trim() || user?.email || "User";
    const assignedByEmail = actorEmail;

    setIsUpdating(true);
    try {
      await assignLead({ id: lead.id, assignedToEmail: selectedEmail, actorEmail, notify: false });
      await createLeadTaskAssignment({
        lead,
        assignedToEmail: selectedEmail,
        assignedToName,
        assignedByEmail,
        assignedByName,
        note: assignNoteDraft.trim().length > 0 ? assignNoteDraft.trim() : null,
        priority: assignPriority,
        status: "pending",
      });
      setIsAssignPickerOpen(false);
    } catch {
      Alert.alert("Error", "Failed to assign task");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSetFollowUpPreset = async (preset: "today" | "tomorrow" | "next7" | "clear") => {
    if (!lead) return;
    if (preset === "clear") {
      setIsUpdating(true);
      try {
        await setLeadFollowUp({ id: lead.id, followUpAt: null, followUpNote: null, actorEmail });
        await syncFollowUpLocalReminders({
          leadId: lead.id,
          customerName: lead.customer?.name || "Customer",
          followUpAt: null,
          followUpNote: null,
          leadSummary: null,
          done: true,
        });
      } catch (e) {
        Alert.alert("Error", formatErrorMessage(e, "Failed to update follow-up"));
      } finally {
        setIsUpdating(false);
      }
      return;
    }

    const when = new Date();
    when.setSeconds(0, 0);
    if (preset === "tomorrow") when.setDate(when.getDate() + 1);
    if (preset === "next7") when.setDate(when.getDate() + 7);
    when.setHours(9, 0, 0, 0);
    setPendingFollowUpDate(when);
    setFollowUpNoteDraft(lead.followUpNote ?? "");
    setIsFollowUpTimeOpen(true);
  };

  const timeOptions = useMemo(() => {
    const options: Array<{ label: string; hour: number; minute: number }> = [];
    for (let hour = 8; hour <= 18; hour += 1) {
      options.push({ label: `${String(hour).padStart(2, "0")}:00`, hour, minute: 0 });
      if (hour !== 18) options.push({ label: `${String(hour).padStart(2, "0")}:30`, hour, minute: 30 });
    }
    return options;
  }, []);

  const followUpSummary = useMemo(() => {
    if (!lead?.followUpAt) return null;
    const ms = Date.parse(lead.followUpAt);
    if (!Number.isFinite(ms)) return null;
    return new Date(ms).toLocaleString("en-ZA", { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  }, [lead?.followUpAt]);

  const handleToggleFollowUpDone = async () => {
    if (!lead) return;
    setIsUpdating(true);
    try {
      const nextDone = !(lead.followUpDone ?? false);
      await setLeadFollowUpDone({ id: lead.id, done: nextDone, actorEmail });
      await syncFollowUpLocalReminders({
        leadId: lead.id,
        customerName: lead.customer?.name || "Customer",
        followUpAt: lead.followUpAt ? new Date(lead.followUpAt) : null,
        followUpNote: lead.followUpNote ?? null,
        leadSummary: null,
        done: nextDone,
      });
    } catch (e) {
      Alert.alert("Error", formatErrorMessage(e, "Failed to update follow-up status"));
    } finally {
      setIsUpdating(false);
    }
  };

  const contactActions = useMemo(() => {
      if (!lead?.customer) return [];
      const { phone, email } = lead.customer;
      
      const actions: Array<{
        label: string;
        icon: keyof typeof Ionicons.glyphMap;
        onPress: () => void;
        color: string;
      }> = [];
      if (phone) {
          actions.push({
              label: "Call",
              icon: "call",
              onPress: () => Linking.openURL(`tel:${digitsOnly(phone)}`),
              color: "#22c55e"
          });
          actions.push({
              label: "SMS",
              icon: "chatbubble",
              onPress: () => Linking.openURL(`sms:${digitsOnly(phone)}`),
              color: "#3b82f6"
          });
          actions.push({
              label: "WhatsApp",
              icon: "logo-whatsapp",
              onPress: () => Linking.openURL(`https://wa.me/${digitsOnly(phone)}`),
              color: "#25D366"
          });
      }
      if (email) {
          actions.push({
              label: "Email",
              icon: "mail",
              onPress: () => Linking.openURL(`mailto:${email}`),
              color: "#f59e0b"
          });
      }
      return actions;
  }, [lead]);

  const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: THEME.background,
    },
    header: {
        paddingHorizontal: 24,
        paddingBottom: 20,
        backgroundColor: THEME.background,
        borderBottomWidth: 1,
        borderBottomColor: THEME.border,
    },
    headerTop: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: THEME.card,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: THEME.border,
    },
    headerTitle: {
        fontSize: 16,
        fontWeight: "700",
        color: THEME.text,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    leadName: {
        fontSize: 28,
        fontWeight: "900",
        color: THEME.text,
        marginBottom: 4,
    },
    leadTime: {
        fontSize: 14,
        color: THEME.textMuted,
        fontWeight: "500",
    },
    content: {
        padding: 24,
        gap: 24,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: "700",
        color: THEME.textMuted,
        textTransform: "uppercase",
        letterSpacing: 1,
        marginBottom: 12,
    },
    card: {
        backgroundColor: THEME.card,
        borderRadius: 24,
        padding: 20,
        borderWidth: 1,
        borderColor: THEME.border,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: THEME.border,
    },
    rowLast: {
        borderBottomWidth: 0,
    },
    label: {
        color: THEME.textMuted,
        fontSize: 14,
        fontWeight: "600",
    },
    value: {
        color: THEME.text,
        fontSize: 15,
        fontWeight: "700",
        textAlign: 'right',
        flex: 1,
        marginLeft: 16,
    },
    actionsGrid: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 8,
    },
    actionButton: {
        flex: 1,
        backgroundColor: THEME.card,
        borderRadius: 16,
        padding: 16,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        borderWidth: 1,
        borderColor: THEME.border,
    },
    actionText: {
        fontSize: 12,
        fontWeight: "600",
        color: THEME.text,
    },
    statusContainer: {
        flexDirection: 'row',
        backgroundColor: THEME.card,
        borderRadius: 100,
        padding: 4,
        borderWidth: 1,
        borderColor: THEME.border,
    },
    statusItem: {
        flex: 1,
        paddingVertical: 12,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 100,
        flexDirection: 'row',
        gap: 6,
    },
    statusItemActive: {
        backgroundColor: THEME.primary,
    },
    statusText: {
        fontSize: 12,
        fontWeight: "700",
        color: THEME.textMuted,
    },
    statusTextActive: {
        color: THEME.background,
    },
    statusSelectedLabel: {
        marginTop: 10,
        color: THEME.textMuted,
        fontWeight: "800",
        textAlign: "center",
        letterSpacing: 0.6,
    },
    vehicleCard: {
        flexDirection: 'row',
        gap: 16,
        alignItems: 'center',
    },
    vehicleIcon: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: "#27272a",
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: THEME.primary,
    },
    vehicleInfo: {
        flex: 1,
    },
    vehicleTitle: {
        fontSize: 18,
        fontWeight: "800",
        color: THEME.text,
        marginBottom: 4,
    },
    vehiclePrice: {
        fontSize: 15,
        fontWeight: "700",
        color: THEME.primary,
    },
    followUpHint: {
        marginTop: 12,
        color: THEME.textMuted,
        fontSize: 12,
        fontWeight: "700",
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.65)",
        justifyContent: "flex-end",
        padding: 16,
    },
    modalCard: {
        backgroundColor: THEME.card,
        borderRadius: 20,
        padding: 16,
        borderWidth: 1,
        borderColor: THEME.border,
    },
    modalHeaderRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 8,
    },
    modalTitle: {
        color: THEME.text,
        fontSize: 16,
        fontWeight: "900",
    },
    modalSubtitle: {
        color: THEME.textMuted,
        fontSize: 12,
        fontWeight: "700",
        marginBottom: 12,
    },
    followUpNoteInput: {
        backgroundColor: THEME.background,
        borderWidth: 1,
        borderColor: THEME.border,
        borderRadius: 14,
        paddingHorizontal: 12,
        paddingVertical: 10,
        color: THEME.text,
        fontSize: 13,
        fontWeight: "600",
        minHeight: 60,
        marginBottom: 12,
    },
    modalCloseBtn: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: THEME.background,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: THEME.border,
    },
    timeGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 10,
    },
    timeChip: {
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 999,
        backgroundColor: THEME.background,
        borderWidth: 1,
        borderColor: THEME.border,
    },
    timeChipText: {
        color: THEME.text,
        fontWeight: "800",
        fontSize: 12,
    },
  });

  if (isLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
          <ActivityIndicator size="large" color={THEME.primary} />
      </View>
    );
  }

  if (!canSeeLeads) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
            <View style={styles.headerTop}>
                <Pressable onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={20} color={THEME.text} />
                </Pressable>
                <Text style={styles.headerTitle}>Access Restricted</Text>
                <View style={{ width: 40 }} />
            </View>
        </View>
        <View style={{ padding: 24 }}>
          <EmptyState title="No access" description="Your account is not enabled for Leads & CRM." icon="lock-closed-outline" />
        </View>
      </View>
    );
  }

  if (error || !lead) {
      return (
        <View style={styles.container}>
            <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
                <View style={styles.headerTop}>
                    <Pressable onPress={() => router.back()} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={20} color={THEME.text} />
                    </Pressable>
                    <Text style={styles.headerTitle}>Error</Text>
                    <View style={{ width: 40 }} />
                </View>
            </View>
            <View style={{ padding: 24, alignItems: 'center' }}>
                <Text style={{ color: THEME.destructive, fontSize: 16, marginBottom: 20 }}>{error || "Lead not found"}</Text>
                <Button variant="outline" onPress={() => router.back()}>Go Back</Button>
            </View>
        </View>
      );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <View style={styles.headerTop}>
            <Pressable onPress={() => router.back()} style={styles.backButton}>
                <Ionicons name="arrow-back" size={20} color={THEME.text} />
            </Pressable>
            <Text style={styles.headerTitle}>Lead Details</Text>
            <Pressable style={styles.backButton}>
                <Ionicons name="ellipsis-horizontal" size={20} color={THEME.text} />
            </Pressable>
        </View>
        
        <Text style={styles.leadName}>{lead.customer?.name || "Unknown"}</Text>
        <Text style={styles.leadTime}>
          {TYPE_LABEL[lead.type]} • {lead.source || "website"} • Received {timeAgo(lead.createdAt)}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Quick Actions */}
        {contactActions.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <View style={styles.actionsGrid}>
              {contactActions.map((action, idx) => (
                <Pressable key={idx} style={[styles.actionButton]} onPress={action.onPress}>
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: action.color + "20",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Ionicons name={action.icon} size={20} color={action.color} />
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        <View>
          <Text style={styles.sectionTitle}>Status</Text>
          <View style={styles.statusContainer}>
            {CRM_STAGE_CHOICES.map((s) => {
              const isActive = effectiveCrmStage === s.value;
              return (
                <Pressable
                  key={s.value}
                  style={[styles.statusItem, isActive && styles.statusItemActive]}
                  onPress={() => handleCrmStageChange(s.value)}
                  disabled={isUpdating || isArchived}
                >
                  <Ionicons name={s.icon} size={14} color={isActive ? THEME.background : THEME.textMuted} />
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.statusSelectedLabel}>{activeStatusLabel}</Text>
          {isArchived ? (
            <View style={{ marginTop: 12 }}>
              <View
                style={{
                  backgroundColor: "rgba(239,68,68,0.12)",
                  borderColor: THEME.destructive,
                  borderWidth: 1,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  borderRadius: 14,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <Ionicons name="archive" size={18} color={THEME.destructive} />
                <Text style={{ color: THEME.text, fontWeight: "700", flex: 1 }}>Archived</Text>
              </View>
            </View>
          ) : null}
        </View>

        <View>
          <Text style={styles.sectionTitle}>Assignment</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.label}>Assigned To</Text>
              <Text style={styles.value} numberOfLines={1}>
                {lead.assignedToEmail || "Unassigned"}
              </Text>
            </View>
            <View style={[styles.row, styles.rowLast, { justifyContent: "flex-end" }]}>
              <Button
                onPress={() => {
                  const currentEmail = (lead.assignedToEmail ?? "").trim().toLowerCase();
                  setAssignSelectedEmail(currentEmail.length > 0 ? currentEmail : null);
                  setAssignSelectedName(null);
                  setAssignNoteDraft("");
                  setAssignPriority("medium");
                  setIsAssignPickerOpen(true);
                }}
                disabled={isUpdating}
              >
                Assign task
              </Button>
            </View>
          </View>
        </View>

        <Modal visible={isAssignPickerOpen} transparent animationType="fade" onRequestClose={() => setIsAssignPickerOpen(false)}>
          <Pressable style={[styles.modalOverlay, { justifyContent: "center" }]} onPress={() => setIsAssignPickerOpen(false)}>
            <Pressable style={[styles.modalCard, { width: "100%", maxWidth: 520, alignSelf: "center" }]} onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalHeaderRow}>
                <Text style={styles.modalTitle}>Assign task</Text>
                <Pressable onPress={() => setIsAssignPickerOpen(false)} style={styles.modalCloseBtn}>
                  <Ionicons name="close" size={18} color={THEME.textMuted} />
                </Pressable>
              </View>
              <Text style={styles.modalSubtitle}>Select a staff member, add a note, set priority.</Text>

              <TextInput
                value={assignNoteDraft}
                onChangeText={setAssignNoteDraft}
                placeholder="Note (optional)"
                placeholderTextColor={THEME.textMuted}
                style={styles.followUpNoteInput}
                multiline
              />

              <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
                {(["low", "medium", "high"] as const).map((p) => {
                  const active = assignPriority === p;
                  return (
                    <Pressable
                      key={p}
                      onPress={() => setAssignPriority(p)}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor: active ? THEME.primary : THEME.border,
                        backgroundColor: active ? "rgba(250,204,21,0.16)" : THEME.background,
                      }}
                    >
                      <Text style={{ color: active ? THEME.primary : THEME.textMuted, fontWeight: "800", fontSize: 12 }}>
                        {p === "low" ? "Low" : p === "medium" ? "Medium" : "High"}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <ScrollView style={{ maxHeight: 320 }} keyboardShouldPersistTaps="handled">
                {actorEmail ? (
                  <Pressable
                    onPress={() => {
                      setAssignSelectedEmail(actorEmail);
                      setAssignSelectedName(userProfile?.name?.trim() || user?.email || "Me");
                    }}
                    disabled={isUpdating}
                    style={{
                      paddingVertical: 12,
                      borderBottomWidth: 1,
                      borderBottomColor: THEME.border,
                      backgroundColor: assignSelectedEmail === actorEmail ? "rgba(250,204,21,0.10)" : "transparent",
                    }}
                  >
                    <Text style={{ color: THEME.text, fontWeight: "900" }}>Me</Text>
                    <Text style={{ color: THEME.textMuted, fontSize: 12, marginTop: 4 }} numberOfLines={1}>
                      {actorEmail}
                    </Text>
                  </Pressable>
                ) : null}

                {staffUsers.map((u) => {
                  const email = u.email.trim().toLowerCase();
                  const selected = assignSelectedEmail === email;
                  return (
                    <Pressable
                      key={u.id}
                      onPress={() => {
                        setAssignSelectedEmail(email);
                        setAssignSelectedName(u.name);
                      }}
                      disabled={isUpdating}
                      style={{
                        paddingVertical: 12,
                        borderBottomWidth: 1,
                        borderBottomColor: THEME.border,
                        backgroundColor: selected ? "rgba(250,204,21,0.10)" : "transparent",
                      }}
                    >
                      <Text style={{ color: THEME.text, fontWeight: "900" }} numberOfLines={1}>
                        {u.name}
                      </Text>
                      <Text style={{ color: THEME.textMuted, fontSize: 12, marginTop: 4 }} numberOfLines={1}>
                        {email}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              <View style={{ flexDirection: "row", gap: 10, justifyContent: "flex-end", marginTop: 14 }}>
                <Button variant="outline" onPress={handleUnassign} disabled={isUpdating || !lead.assignedToEmail}>
                  Unassign
                </Button>
                <Button onPress={() => void handleConfirmAssign()} disabled={isUpdating || !assignSelectedEmail}>
                  Assign task
                </Button>
              </View>
            </Pressable>
          </Pressable>
        </Modal>

        <View>
          <Text style={styles.sectionTitle}>Follow-up</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.label}>Due</Text>
              <Text style={styles.value}>{lead.followUpAt ? new Date(lead.followUpAt).toLocaleString() : "—"}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Done</Text>
              <Text style={styles.value}>{lead.followUpDone ? "Yes" : "No"}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Notes</Text>
              <Text style={styles.value} numberOfLines={3}>
                {lead.followUpNote && lead.followUpNote.trim().length > 0 ? lead.followUpNote.trim() : "—"}
              </Text>
            </View>
            <View style={[styles.row, styles.rowLast, { justifyContent: "flex-end" }]}>
              <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
                <Button
                  onPress={() => {
                    const when = lead.followUpAt ? new Date(lead.followUpAt) : new Date();
                    when.setSeconds(0, 0);
                    if (!lead.followUpAt) when.setHours(9, 0, 0, 0);
                    setPendingFollowUpDate(when);
                    setFollowUpNoteDraft(lead.followUpNote ?? "");
                    setIsFollowUpTimeOpen(true);
                  }}
                  disabled={isUpdating}
                >
                  Set follow-up
                </Button>
                {lead.followUpAt ? (
                  <Button variant="outline" onPress={() => handleSetFollowUpPreset("clear")} disabled={isUpdating}>
                    Clear
                  </Button>
                ) : null}
                <Button variant="outline" onPress={handleToggleFollowUpDone} disabled={isUpdating}>
                  {lead.followUpDone ? "Mark pending" : "Mark done"}
                </Button>
              </View>
            </View>
            {followUpSummary ? <Text style={styles.followUpHint}>Next follow-up: {followUpSummary}</Text> : null}
          </View>
        </View>

        {!isArchived ? (
          <View>
            <Text style={styles.sectionTitle}>Archive</Text>
            <View style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.label}>Remove from pipeline</Text>
                <Text style={styles.value}>—</Text>
              </View>
              <View style={[styles.row, styles.rowLast, { justifyContent: "flex-end" }]}>
                <Button variant="destructive" onPress={handleArchiveLead} disabled={isUpdating} icon="archive">
                  Archive lead
                </Button>
              </View>
            </View>
          </View>
        ) : null}

        {/* Customer Details */}
        <View>
            <Text style={styles.sectionTitle}>Customer Info</Text>
            <View style={styles.card}>
                <View style={styles.row}>
                    <Text style={styles.label}>Name</Text>
                    <Text style={styles.value}>{lead.customer?.name || "Unknown"}</Text>
                </View>
                {lead.customer.email && (
                    <View style={styles.row}>
                        <Text style={styles.label}>Email</Text>
                        <Text style={styles.value} numberOfLines={1}>{lead.customer.email}</Text>
                    </View>
                )}
                {lead.customer.phone && (
                    <View style={[styles.row, styles.rowLast]}>
                        <Text style={styles.label}>Phone</Text>
                        <Text style={styles.value}>{lead.customer.phone}</Text>
                    </View>
                )}
            </View>
        </View>

        {lead.vehicle || lead.vehicleId || lead.vehicleSnapshot ? (
            <View>
                <Text style={styles.sectionTitle}>Interested In</Text>
                <View style={styles.card}>
                    <View style={styles.row}>
                        <Text style={styles.label}>Vehicle</Text>
                        <Text style={styles.value} numberOfLines={1}>
                          {lead.vehicle?.name ||
                            `${String((lead.vehicleSnapshot?.make as string) || "").trim()} ${String((lead.vehicleSnapshot?.model as string) || "").trim()}`.trim() ||
                            "—"}
                        </Text>
                    </View>
                    {lead.vehicle?.stockNumber ? (
                      <View style={styles.row}>
                          <Text style={styles.label}>Stock Number</Text>
                          <Text style={styles.value}>{lead.vehicle.stockNumber}</Text>
                      </View>
                    ) : null}
                    {(lead.vehicleSnapshot?.price || lead.vehicleSnapshot?.year) ? (
                      <View style={[styles.row, styles.rowLast]}>
                          <Text style={styles.label}>Details</Text>
                          <Text style={styles.value} numberOfLines={2}>
                            {[
                              lead.vehicleSnapshot?.year ? String(lead.vehicleSnapshot.year) : null,
                              lead.vehicleSnapshot?.price ? formatCurrency(Number(lead.vehicleSnapshot.price)) : null,
                            ]
                              .filter(Boolean)
                              .join(" • ") || "—"}
                          </Text>
                      </View>
                    ) : (
                      <View style={[styles.row, styles.rowLast]}>
                          <Text style={styles.label}>Details</Text>
                          <Text style={styles.value}>—</Text>
                      </View>
                    )}
                </View>
            </View>
        ) : null}

        {submissionMessage || (submissionDetails && (submissionDetails.details.length > 0 || submissionDetails.extras.length > 0)) ? (
            <View>
                <Text style={styles.sectionTitle}>Submission Details</Text>
                <View style={styles.card}>
                    {submissionMessage ? (
                      <View style={[styles.row, { alignItems: "flex-start" }]}>
                          <Text style={styles.label}>Message</Text>
                          <Text style={[styles.value, { textAlign: "left" }]}>{submissionMessage}</Text>
                      </View>
                    ) : null}

                    {submissionDetails?.details.map((d, idx) => (
                      <View
                        key={`${d.label}-${idx}`}
                        style={[
                          styles.row,
                          idx === (submissionDetails.details.length - 1) && submissionDetails.extras.length === 0 ? styles.rowLast : null,
                        ]}
                      >
                        <Text style={styles.label}>{d.label}</Text>
                        <Text style={styles.value} numberOfLines={2}>{d.value}</Text>
                      </View>
                    ))}

                    {submissionDetails?.extras.length ? (
                      <View style={{ marginTop: 12 }}>
                        <Pressable
                          onPress={() => setShowSubmissionExtras((v) => !v)}
                          style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}
                        >
                          <Text style={styles.sectionTitle}>More Details</Text>
                          <Ionicons name={showSubmissionExtras ? "chevron-up" : "chevron-down"} size={18} color={THEME.textMuted} />
                        </Pressable>
                        {showSubmissionExtras ? (
                          <View style={{ gap: 10 }}>
                            {submissionDetails.extras.map((x, idx) => (
                              <View key={`${x.label}-${idx}`} style={{ flexDirection: "row", justifyContent: "space-between", gap: 16 }}>
                                <Text style={[styles.label, { flex: 1 }]} numberOfLines={1}>
                                  {x.label}
                                </Text>
                                <Text style={[styles.value, { flex: 1 }]} numberOfLines={3}>
                                  {x.value}
                                </Text>
                              </View>
                            ))}
                          </View>
                        ) : null}
                      </View>
                    ) : null}
                </View>
            </View>
        ) : null}

        <View style={{ height: 40 }} />
      </ScrollView>

      <Modal visible={isFollowUpTimeOpen} transparent animationType="fade" onRequestClose={() => setIsFollowUpTimeOpen(false)}>
        <Pressable
          style={styles.modalOverlay}
          onPress={() => {
            if (isKeyboardVisible) {
              Keyboard.dismiss();
              return;
            }
            setIsFollowUpTimeOpen(false);
          }}
        >
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Pick a time</Text>
              <Pressable
                onPress={() => {
                  Keyboard.dismiss();
                  setIsFollowUpTimeOpen(false);
                }}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={18} color={THEME.text} />
              </Pressable>
            </View>

            <Text style={styles.modalSubtitle}>
              {pendingFollowUpDate
                ? pendingFollowUpDate.toLocaleDateString("en-ZA", { weekday: "long", day: "2-digit", month: "long" })
                : ""}
            </Text>

            <View style={{ flexDirection: "row", gap: 8, marginBottom: 12, justifyContent: "center", flexWrap: "wrap" }}>
              {[
                { label: "Today", days: 0 },
                { label: "Tomorrow", days: 1 },
                { label: "+7 days", days: 7 },
              ].map((d) => (
                <Pressable
                  key={d.label}
                  disabled={isUpdating}
                  onPress={() => {
                    const base = pendingFollowUpDate ? new Date(pendingFollowUpDate) : new Date();
                    const next = new Date(base);
                    next.setDate(next.getDate() + d.days);
                    next.setSeconds(0, 0);
                    setPendingFollowUpDate(next);
                  }}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: THEME.border,
                    backgroundColor: THEME.background,
                  }}
                >
                  <Text style={{ color: THEME.textMuted, fontWeight: "800", fontSize: 12 }}>{d.label}</Text>
                </Pressable>
              ))}
            </View>

            <TextInput
              value={followUpNoteDraft}
              onChangeText={setFollowUpNoteDraft}
              placeholder="Add follow-up notes..."
              placeholderTextColor={THEME.textMuted}
              multiline
              blurOnSubmit
              onSubmitEditing={() => Keyboard.dismiss()}
              style={styles.followUpNoteInput}
            />

            <View style={styles.timeGrid}>
              {timeOptions.map((t) => (
                <Pressable
                  key={t.label}
                  style={styles.timeChip}
                  disabled={isUpdating || !pendingFollowUpDate}
                  onPress={async () => {
                    if (!lead || !pendingFollowUpDate) return;
                    if (!actorEmail) {
                      Alert.alert("Error", "Missing signed-in email address");
                      return;
                    }
                    const next = new Date(pendingFollowUpDate);
                    next.setHours(t.hour, t.minute, 0, 0);
                    const note = followUpNoteDraft.trim();
                    setIsUpdating(true);
                    try {
                      Keyboard.dismiss();
                      await setLeadFollowUp({ id: lead.id, followUpAt: next, followUpNote: note.length > 0 ? note : null, actorEmail });
                      await syncFollowUpLocalReminders({
                        leadId: lead.id,
                        customerName: lead.customer?.name || "Customer",
                        followUpAt: next,
                        followUpNote: note.length > 0 ? note : null,
                        leadSummary: `${TYPE_LABEL[lead.type]}${lead.source ? ` • Source: ${lead.source}` : ""}${lead.vehicle?.name ? ` • Vehicle: ${lead.vehicle.name}` : ""}`,
                        done: false,
                      });
                      setIsFollowUpTimeOpen(false);
                      setPendingFollowUpDate(null);
                    } catch (e) {
                      Alert.alert("Error", formatErrorMessage(e, "Failed to update follow-up"));
                    } finally {
                      setIsUpdating(false);
                    }
                  }}
                >
                  <Text style={styles.timeChipText}>{t.label}</Text>
                </Pressable>
              ))}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
