import { Ionicons } from "@expo/vector-icons";
import { addDoc, collection, onSnapshot, orderBy, query, serverTimestamp, Timestamp } from "firebase/firestore";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  Dimensions,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Calendar } from "react-native-calendars";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "../../src/auth/AuthContext";
import { Badge } from "../../src/components/ui/Badge";
import { EmptyState } from "../../src/components/common/EmptyState";
import { firebaseDb } from "../../src/lib/firebase";
import type { LeadSubmission, LeadType } from "../../src/models/lead";
import { timeAgo } from "../../src/utils/format";

const COLORS = {
  background: "#09090b",
  card: "#18181b",
  cardHighlight: "#27272a",
  primary: "#FACC15",
  primaryForeground: "#000000",
  text: "#FFFFFF",
  textMuted: "#A1A1AA",
  border: "#27272a",
  danger: "#ef4444",
};

type ManualContact = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  createdAt: string | null;
};

type ContactRow = {
  key: string;
  name: string;
  email: string | null;
  phone: string | null;
  createdAt: string | null;
  leadTypes: Set<LeadType>;
  latestLeadStatus: LeadSubmission["status"] | null;
};

function normalizeEmail(value: unknown) {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return email ? email : null;
}

function digitsOnly(value: unknown) {
  if (typeof value !== "string") return null;
  const digits = value.replace(/\D/g, "");
  return digits ? digits : null;
}

function contactKeyFrom(email: string | null, phoneDigits: string | null, fallback?: string) {
  if (email) return `email:${email}`;
  if (phoneDigits) return `phone:${phoneDigits}`;
  return fallback ? `id:${fallback}` : null;
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

function typeLabel(t: LeadType) {
  switch (t) {
    case "vehicle_enquiry":
      return "Vehicle Enquiries";
    case "trade_in":
      return "Trade-Ins";
    case "finance":
      return "Finance";
    case "test_drive":
      return "Test Drives";
    case "contact":
      return "Contact";
    default:
      return "Contact";
  }
}

export default function ContactsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { canAccess, userProfile } = useAuth();
  const canSeeLeads = canAccess("Leads & CRM");

  const [leads, setLeads] = useState<LeadSubmission[]>([]);
  const [manualContacts, setManualContacts] = useState<ManualContact[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | LeadType>("all");

  const [showDateFilter, setShowDateFilter] = useState(false);
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);

  const [selectedContact, setSelectedContact] = useState<ContactRow | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (!firebaseDb) {
      setLeads([]);
      return;
    }
    if (!canSeeLeads) {
      setLeads([]);
      return;
    }

    const q = query(collection(firebaseDb, "lead_submissions"), orderBy("createdAt", "desc"));
    return onSnapshot(
      q,
      (snap) => {
        const next = snap.docs.map((d) => {
          const data = d.data() as Record<string, unknown>;
          const customer =
            typeof data.customer === "object" && data.customer !== null ? (data.customer as Record<string, unknown>) : null;
          const vehicle = typeof data.vehicle === "object" && data.vehicle !== null ? (data.vehicle as Record<string, unknown>) : null;
          return {
            id: d.id,
            type: (data.type as LeadType) ?? "contact",
            status: (data.status as LeadSubmission["status"]) ?? "new",
            createdAt: toIso(data.createdAt) ?? new Date().toISOString(),
            source: typeof data.source === "string" ? data.source : null,
            assignedToEmail: typeof data.assignedToEmail === "string" ? data.assignedToEmail : null,
            assignedAt: toIso(data.assignedAt),
            followUpAt: toIso(data.followUpAt),
            followUpDone: typeof data.followUpDone === "boolean" ? data.followUpDone : null,
            customer: customer
              ? {
                  name: typeof customer.name === "string" ? customer.name : null,
                  email: typeof customer.email === "string" ? customer.email : null,
                  phone: typeof customer.phone === "string" ? customer.phone : null,
                }
              : { name: null, email: null, phone: null },
            vehicle: vehicle
              ? {
                  id: typeof vehicle.id === "string" ? vehicle.id : null,
                  name: typeof vehicle.name === "string" ? vehicle.name : null,
                  stockNumber: typeof vehicle.stockNumber === "string" ? vehicle.stockNumber : null,
                }
              : null,
            payload: typeof data.payload === "object" && data.payload !== null ? (data.payload as Record<string, unknown>) : {},
          } satisfies LeadSubmission;
        });
        setLeads(next);
      },
      () => setLeads([]),
    );
  }, [canSeeLeads]);

  useEffect(() => {
    if (!firebaseDb) {
      setManualContacts([]);
      return;
    }
    const q = query(collection(firebaseDb, "contacts"), orderBy("createdAt", "desc"));
    return onSnapshot(
      q,
      (snap) => {
        const next = snap.docs.map((d) => {
          const data = d.data() as Record<string, unknown>;
          return {
            id: d.id,
            name: typeof data.name === "string" ? data.name : null,
            email: typeof data.email === "string" ? data.email : null,
            phone: typeof data.phone === "string" ? data.phone : null,
            createdAt: toIso(data.createdAt),
          } satisfies ManualContact;
        });
        setManualContacts(next);
      },
      () => setManualContacts([]),
    );
  }, []);

  const contacts = useMemo<ContactRow[]>(() => {
    const byKey = new Map<string, ContactRow>();

    for (const lead of leads) {
      const email = normalizeEmail(lead.customer?.email);
      const phoneDigits = digitsOnly(lead.customer?.phone);
      const key = contactKeyFrom(email, phoneDigits);
      if (!key) continue;

      const name = lead.customer?.name?.trim() ? lead.customer.name.trim() : "Unknown";
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, {
          key,
          name,
          email,
          phone: lead.customer?.phone ?? null,
          createdAt: lead.createdAt,
          leadTypes: new Set([lead.type]),
          latestLeadStatus: lead.status ?? null,
        });
        continue;
      }

      existing.leadTypes.add(lead.type);
      if (existing.name === "Unknown" && name !== "Unknown") existing.name = name;
      if (!existing.email && email) existing.email = email;
      if (!existing.phone && lead.customer?.phone) existing.phone = lead.customer.phone;

      const existingCreated = existing.createdAt ? Date.parse(existing.createdAt) : Number.NaN;
      const leadCreated = Date.parse(lead.createdAt);
      if (Number.isFinite(leadCreated) && (!Number.isFinite(existingCreated) || leadCreated < existingCreated)) existing.createdAt = lead.createdAt;
      if (Number.isFinite(leadCreated) && (!Number.isFinite(existingCreated) || leadCreated > existingCreated)) existing.latestLeadStatus = lead.status ?? null;
    }

    for (const c of manualContacts) {
      const email = normalizeEmail(c.email);
      const phoneDigits = digitsOnly(c.phone);
      const key = contactKeyFrom(email, phoneDigits, c.id);
      if (!key) continue;

      const name = c.name?.trim() ? c.name.trim() : "Unknown";
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, { key, name, email, phone: c.phone, createdAt: c.createdAt, leadTypes: new Set(), latestLeadStatus: null });
        continue;
      }
      if (existing.name === "Unknown" && name !== "Unknown") existing.name = name;
      if (!existing.email && email) existing.email = email;
      if (!existing.phone && c.phone) existing.phone = c.phone;
      const existingCreated = existing.createdAt ? Date.parse(existing.createdAt) : Number.NaN;
      const created = c.createdAt ? Date.parse(c.createdAt) : Number.NaN;
      if (Number.isFinite(created) && (!Number.isFinite(existingCreated) || created < existingCreated)) existing.createdAt = c.createdAt;
    }

    const rows = Array.from(byKey.values());
    rows.sort((a, b) => (Date.parse(b.createdAt ?? "") || 0) - (Date.parse(a.createdAt ?? "") || 0));
    return rows;
  }, [leads, manualContacts]);

  const filteredContacts = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const fromMs = startDate ? Date.parse(`${startDate}T00:00:00.000Z`) : null;
    const toMs = endDate ? Date.parse(`${endDate}T23:59:59.999Z`) : null;

    return contacts.filter((c) => {
      if (typeFilter !== "all" && !c.leadTypes.has(typeFilter)) return false;
      const createdMs = c.createdAt ? Date.parse(c.createdAt) : Number.NaN;
      if (fromMs != null && Number.isFinite(createdMs) && createdMs < fromMs) return false;
      if (toMs != null && Number.isFinite(createdMs) && createdMs > toMs) return false;
      if (!term) return true;
      const bits = `${c.name} ${c.email ?? ""} ${c.phone ?? ""}`.toLowerCase();
      return bits.includes(term);
    });
  }, [contacts, endDate, searchTerm, startDate, typeFilter]);

  const selectedLeads = useMemo(() => {
    if (!selectedContact) return [];
    return leads
      .filter((l) => {
        const email = normalizeEmail(l.customer?.email);
        const phoneDigits = digitsOnly(l.customer?.phone);
        const k = contactKeyFrom(email, phoneDigits);
        return k === selectedContact.key;
      })
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }, [leads, selectedContact]);

  const markedDates = useMemo(() => {
    if (!startDate && !endDate) return {};
    if (startDate && !endDate) return { [startDate]: { selected: true, selectedColor: COLORS.primary } };
    if (startDate && endDate) {
      const s = Date.parse(startDate);
      const e = Date.parse(endDate);
      if (!Number.isFinite(s) || !Number.isFinite(e)) return {};
      const start = new Date(Math.min(s, e));
      const end = new Date(Math.max(s, e));
      const out: Record<string, { selected?: boolean; startingDay?: boolean; endingDay?: boolean; color?: string; textColor?: string }> = {};
      const cur = new Date(start);
      while (cur <= end) {
        const key = cur.toISOString().slice(0, 10);
        out[key] = {
          selected: true,
          color: COLORS.primary,
          textColor: COLORS.primaryForeground,
          startingDay: key === start.toISOString().slice(0, 10),
          endingDay: key === end.toISOString().slice(0, 10),
        };
        cur.setDate(cur.getDate() + 1);
      }
      return out;
    }
    return {};
  }, [endDate, startDate]);

  const onRefresh = async () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 500);
  };

  const clearDateFilter = () => {
    setStartDate(null);
    setEndDate(null);
  };

  const handleDayPress = (day: { dateString: string }) => {
    const picked = day.dateString;
    if (!startDate || (startDate && endDate)) {
      setStartDate(picked);
      setEndDate(null);
      return;
    }
    const s = Date.parse(startDate);
    const e = Date.parse(picked);
    if (!Number.isFinite(s) || !Number.isFinite(e)) {
      setStartDate(picked);
      setEndDate(null);
      return;
    }
    if (e < s) {
      setEndDate(startDate);
      setStartDate(picked);
    } else {
      setEndDate(picked);
    }
  };

  const createContact = async () => {
    if (!firebaseDb) return;
    const name = newName.trim() ? newName.trim() : null;
    const email = normalizeEmail(newEmail);
    const phone = newPhone.trim() ? newPhone.trim() : null;
    if (!email && !phone) return;

    setIsCreating(true);
    try {
      await addDoc(collection(firebaseDb, "contacts"), {
        name,
        email: email ?? null,
        phone,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdByEmail: userProfile?.email?.trim().toLowerCase() ?? null,
        source: "manual",
      });
      setShowCreate(false);
      setNewName("");
      setNewEmail("");
      setNewPhone("");
    } finally {
      setIsCreating(false);
    }
  };

  const screenWidth = Dimensions.get("window").width;

  if (!canSeeLeads) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
        <EmptyState title="No access" description="You do not have permission to view contacts." />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />

      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Contacts</Text>
          <Text style={styles.headerSubtitle}>From leads and manual contacts</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable style={styles.iconButton} onPress={() => setShowDateFilter(true)}>
            <Ionicons name="calendar-outline" size={22} color={COLORS.text} />
          </Pressable>
          <Pressable style={styles.iconButton} onPress={() => router.push("/notifications")}>
            <Ionicons name="notifications-outline" size={22} color={COLORS.text} />
          </Pressable>
          <Pressable style={styles.iconButton} onPress={() => setShowCreate(true)}>
            <Ionicons name="add-circle-outline" size={22} color={COLORS.text} />
          </Pressable>
        </View>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={18} color={COLORS.textMuted} />
        <TextInput
          value={searchTerm}
          onChangeText={setSearchTerm}
          placeholder="Search contacts..."
          placeholderTextColor={COLORS.textMuted}
          style={styles.searchInput}
        />
      </View>

      <View style={styles.filtersRow}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={["all", "vehicle_enquiry", "trade_in", "finance", "test_drive", "contact"] as const}
          keyExtractor={(x) => x}
          contentContainerStyle={{ gap: 8, paddingHorizontal: 2 }}
          renderItem={({ item }) => (
            <Pressable onPress={() => setTypeFilter(item as "all" | LeadType)}>
              <Badge
                variant={typeFilter === item ? "default" : "muted"}
                style={typeFilter === item ? { backgroundColor: COLORS.primary } : undefined}
              >
                <Text style={{ color: typeFilter === item ? COLORS.primaryForeground : COLORS.text, fontWeight: "700" }}>
                  {item === "all" ? "All" : typeLabel(item as LeadType)}
                </Text>
              </Badge>
            </Pressable>
          )}
        />
      </View>

      {(startDate || endDate) && (
        <View style={{ flexDirection: "row", justifyContent: "center", marginBottom: 12 }}>
          <Pressable onPress={clearDateFilter}>
            <Badge variant="default" style={{ paddingHorizontal: 16, paddingVertical: 8, backgroundColor: COLORS.primary }}>
              <Text style={{ color: COLORS.primaryForeground, fontWeight: "800" }}>
                {startDate} {endDate ? ` - ${endDate}` : ""} <Ionicons name="close-circle" size={14} />
              </Text>
            </Badge>
          </Pressable>
        </View>
      )}

      <FlatList
        data={filteredContacts}
        keyExtractor={(item) => item.key}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        contentContainerStyle={{ paddingBottom: 120 }}
        ListEmptyComponent={<EmptyState title="No contacts" description="No contacts match your filters." />}
        renderItem={({ item }) => (
          <Pressable style={styles.contactCard} onPress={() => setSelectedContact(item)}>
            <View style={{ flex: 1 }}>
              <Text style={styles.contactName}>{item.name}</Text>
              <Text style={styles.contactSub}>{item.email ?? item.phone ?? "—"}</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                {item.leadTypes.size === 0 ? (
                  <Badge variant="muted">
                    <Text style={{ color: COLORS.text, fontWeight: "700" }}>Manual</Text>
                  </Badge>
                ) : (
                  Array.from(item.leadTypes.values())
                    .slice(0, 3)
                    .map((t) => (
                      <Badge key={t} variant="muted">
                        <Text style={{ color: COLORS.text, fontWeight: "700" }}>{typeLabel(t)}</Text>
                      </Badge>
                    ))
                )}
                {item.leadTypes.size > 3 ? (
                  <Badge variant="muted">
                    <Text style={{ color: COLORS.text, fontWeight: "700" }}>+{item.leadTypes.size - 3}</Text>
                  </Badge>
                ) : null}
              </View>
            </View>
            <View style={{ alignItems: "flex-end", justifyContent: "space-between" }}>
              <Badge
                variant={item.latestLeadStatus === "new" ? "default" : "muted"}
                style={item.latestLeadStatus === "new" ? { backgroundColor: COLORS.primary } : undefined}
              >
                <Text style={{ color: item.latestLeadStatus === "new" ? COLORS.primaryForeground : COLORS.text, fontWeight: "900" }}>
                  {(item.latestLeadStatus ?? "—").toUpperCase()}
                </Text>
              </Badge>
              <Text style={styles.contactTime}>{item.createdAt ? timeAgo(item.createdAt) : "—"}</Text>
            </View>
          </Pressable>
        )}
      />

      <Modal visible={showDateFilter} transparent animationType="fade" onRequestClose={() => setShowDateFilter(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { width: Math.min(screenWidth - 32, 420) }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filter by date</Text>
              <Pressable onPress={() => setShowDateFilter(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </Pressable>
            </View>
            <Calendar
              onDayPress={handleDayPress}
              markedDates={markedDates}
              markingType="period"
              theme={{
                backgroundColor: COLORS.card,
                calendarBackground: COLORS.card,
                dayTextColor: COLORS.text,
                monthTextColor: COLORS.text,
                textDisabledColor: COLORS.textMuted,
                arrowColor: COLORS.primary,
                selectedDayBackgroundColor: COLORS.primary,
                selectedDayTextColor: COLORS.primaryForeground,
                todayTextColor: COLORS.primary,
              }}
            />
            <View style={styles.modalActions}>
              <Pressable style={[styles.modalButton, styles.modalButtonSecondary]} onPress={clearDateFilter}>
                <Text style={styles.modalButtonTextSecondary}>Clear</Text>
              </Pressable>
              <Pressable style={[styles.modalButton, styles.modalButtonPrimary]} onPress={() => setShowDateFilter(false)}>
                <Text style={styles.modalButtonTextPrimary}>Apply</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={Boolean(selectedContact)} transparent animationType="fade" onRequestClose={() => setSelectedContact(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { width: Math.min(screenWidth - 32, 520) }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{selectedContact?.name ?? "Contact"}</Text>
              <Pressable onPress={() => setSelectedContact(null)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </Pressable>
            </View>

            {selectedContact ? (
              <View style={{ gap: 12 }}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Email</Text>
                  <Text style={styles.detailValue}>{selectedContact.email ?? "—"}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Phone</Text>
                  <Text style={styles.detailValue}>{selectedContact.phone ?? "—"}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Created</Text>
                  <Text style={styles.detailValue}>{selectedContact.createdAt ? selectedContact.createdAt.slice(0, 10) : "—"}</Text>
                </View>

                <View style={{ marginTop: 8 }}>
                  <Text style={styles.sectionLabel}>Related Leads</Text>
                  {selectedLeads.length === 0 ? (
                    <Text style={{ color: COLORS.textMuted }}>No leads found.</Text>
                  ) : (
                    <View style={{ gap: 10, marginTop: 10 }}>
                      {selectedLeads.slice(0, 30).map((l) => (
                        <Pressable
                          key={l.id}
                          style={styles.leadRow}
                          onPress={() => {
                            setSelectedContact(null);
                            router.push(`/leads/${encodeURIComponent(l.id)}`);
                          }}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={styles.leadType}>{typeLabel(l.type)}</Text>
                            <Text style={styles.leadSub}>{l.vehicle?.name ?? "—"}</Text>
                          </View>
                          <View style={{ alignItems: "flex-end" }}>
                            <Badge variant={l.status === "new" ? "default" : "muted"} style={l.status === "new" ? { backgroundColor: COLORS.primary } : undefined}>
                              <Text style={{ color: l.status === "new" ? COLORS.primaryForeground : COLORS.text, fontWeight: "900" }}>
                                {l.status.toUpperCase()}
                              </Text>
                            </Badge>
                            <Text style={styles.leadTime}>{timeAgo(l.createdAt)}</Text>
                          </View>
                        </Pressable>
                      ))}
                    </View>
                  )}
                </View>
              </View>
            ) : null}
          </View>
        </View>
      </Modal>

      <Modal visible={showCreate} transparent animationType="fade" onRequestClose={() => setShowCreate(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { width: Math.min(screenWidth - 32, 520) }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Contact</Text>
              <Pressable onPress={() => setShowCreate(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </Pressable>
            </View>

            <View style={{ gap: 10 }}>
              <TextInput
                value={newName}
                onChangeText={setNewName}
                placeholder="Name"
                placeholderTextColor={COLORS.textMuted}
                style={styles.input}
              />
              <TextInput
                value={newEmail}
                onChangeText={setNewEmail}
                placeholder="Email"
                placeholderTextColor={COLORS.textMuted}
                style={styles.input}
                autoCapitalize="none"
              />
              <TextInput
                value={newPhone}
                onChangeText={setNewPhone}
                placeholder="Phone"
                placeholderTextColor={COLORS.textMuted}
                style={styles.input}
                keyboardType="phone-pad"
              />
            </View>

            <View style={[styles.modalActions, { marginTop: 14 }]}>
              <Pressable style={[styles.modalButton, styles.modalButtonSecondary]} onPress={() => setShowCreate(false)} disabled={isCreating}>
                <Text style={styles.modalButtonTextSecondary}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.modalButton, styles.modalButtonPrimary]} onPress={createContact} disabled={isCreating}>
                <Text style={styles.modalButtonTextPrimary}>{isCreating ? "Saving..." : "Create"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  headerTitle: { color: COLORS.text, fontSize: 26, fontWeight: "900" },
  headerSubtitle: { color: COLORS.textMuted, marginTop: 2 },
  headerActions: { flexDirection: "row", gap: 10, alignItems: "center" },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: COLORS.card,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  searchInput: { flex: 1, color: COLORS.text, fontSize: 14 },
  filtersRow: { marginBottom: 12 },
  contactCard: {
    flexDirection: "row",
    gap: 14,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  contactName: { color: COLORS.text, fontSize: 16, fontWeight: "900" },
  contactSub: { color: COLORS.textMuted, marginTop: 4 },
  contactTime: { color: COLORS.textMuted, marginTop: 12, fontSize: 12 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center", padding: 16 },
  modalContent: { backgroundColor: COLORS.card, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: COLORS.border },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  modalTitle: { color: COLORS.text, fontSize: 18, fontWeight: "900" },
  modalActions: { flexDirection: "row", gap: 10, justifyContent: "flex-end", marginTop: 10 },
  modalButton: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12 },
  modalButtonPrimary: { backgroundColor: COLORS.primary },
  modalButtonSecondary: { backgroundColor: COLORS.cardHighlight, borderWidth: 1, borderColor: COLORS.border },
  modalButtonTextPrimary: { color: COLORS.primaryForeground, fontWeight: "900" },
  modalButtonTextSecondary: { color: COLORS.text, fontWeight: "800" },
  detailRow: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  detailLabel: { color: COLORS.textMuted, fontWeight: "800" },
  detailValue: { color: COLORS.text, fontWeight: "800", flex: 1, textAlign: "right" },
  sectionLabel: { color: COLORS.textMuted, fontWeight: "900", marginTop: 10 },
  leadRow: { flexDirection: "row", gap: 12, padding: 12, backgroundColor: COLORS.cardHighlight, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border },
  leadType: { color: COLORS.text, fontWeight: "900" },
  leadSub: { color: COLORS.textMuted, marginTop: 2 },
  leadTime: { color: COLORS.textMuted, marginTop: 8, fontSize: 12 },
  input: {
    backgroundColor: COLORS.cardHighlight,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: COLORS.text,
  },
});
