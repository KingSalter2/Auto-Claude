import { Linking, Pressable, StyleSheet, Text, View, ScrollView, Alert, ActivityIndicator, Dimensions } from "react-native";
import { useEffect, useMemo, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";

import { Screen } from "../../src/components/common/Screen";
import { Button } from "../../src/components/ui/Button";
import type { LeadStatus, LeadSubmission } from "../../src/models/lead";
import { getLead, updateLeadStatus } from "../../src/services/leadService";
import { timeAgo, formatCurrency } from "../../src/utils/format";
import { useAuth } from "../../src/auth/AuthContext";
import { EmptyState } from "../../src/components/common/EmptyState";

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

const STATUS_CHOICES: Array<{ label: string; value: LeadStatus; icon: keyof typeof Ionicons.glyphMap }> = [
  { label: "New", value: "new", icon: "flash" },
  { label: "Reviewed", value: "reviewed", icon: "eye" },
  { label: "Contacted", value: "contacted", icon: "call" },
  { label: "Archived", value: "archived", icon: "archive" },
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
  const { canAccess } = useAuth();
  const canSeeLeads = canAccess("Leads & CRM");
  const params = useLocalSearchParams<{ id: string }>();
  const id = params.id;
  const insets = useSafeAreaInsets();

  const [lead, setLead] = useState<LeadSubmission | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

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
    let cancelled = false;
    if (!canSeeLeads) {
      setLead(null);
      setIsLoading(false);
      setError(null);
      return () => {
        cancelled = true;
      };
    }
    (async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await getLead(id);
        if (!cancelled) setLead(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load lead");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canSeeLeads, id]);

  const handleStatusChange = async (newStatus: LeadStatus) => {
      if (!lead) return;
      setIsUpdating(true);
      try {
          await updateLeadStatus(lead.id, newStatus);
          setLead(prev => prev ? { ...prev, status: newStatus } : null);
      } catch (e) {
          Alert.alert("Error", "Failed to update status");
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
        
        {/* Status Workflow */}
        <View>
            <Text style={styles.sectionTitle}>Status</Text>
            <View style={styles.statusContainer}>
                {STATUS_CHOICES.map((s) => {
                    const isActive = lead.status === s.value;
                    return (
                        <Pressable 
                            key={s.value} 
                            style={[styles.statusItem, isActive && styles.statusItemActive]}
                            onPress={() => handleStatusChange(s.value)}
                            disabled={isUpdating}
                        >
                            <Ionicons 
                                name={s.icon} 
                                size={14} 
                                color={isActive ? THEME.background : THEME.textMuted} 
                            />
                            {isActive && (
                                <Text style={[styles.statusText, styles.statusTextActive]}>
                                    {s.label}
                                </Text>
                            )}
                        </Pressable>
                    );
                })}
            </View>
        </View>

        {/* Quick Actions */}
        {contactActions.length > 0 && (
            <View>
                <Text style={styles.sectionTitle}>Quick Actions</Text>
                <View style={styles.actionsGrid}>
                    {contactActions.map((action, idx) => (
                        <Pressable 
                            key={idx} 
                            style={[styles.actionButton]} 
                            onPress={action.onPress}
                        >
                            <View style={{ 
                                width: 40, height: 40, borderRadius: 20, 
                                backgroundColor: action.color + '20', 
                                alignItems: 'center', justifyContent: 'center' 
                            }}>
                                <Ionicons name={action.icon} size={20} color={action.color} />
                            </View>
                        </Pressable>
                    ))}
                </View>
            </View>
        )}

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
                        <Text style={[styles.sectionTitle, { marginBottom: 10 }]}>More Details</Text>
                        <View style={{ gap: 10 }}>
                          {submissionDetails.extras.map((x, idx) => (
                            <View key={`${x.label}-${idx}`} style={{ flexDirection: "row", justifyContent: "space-between", gap: 16 }}>
                              <Text style={[styles.label, { flex: 1 }]} numberOfLines={1}>{x.label}</Text>
                              <Text style={[styles.value, { flex: 1 }]} numberOfLines={3}>{x.value}</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    ) : null}
                </View>
            </View>
        ) : null}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}
