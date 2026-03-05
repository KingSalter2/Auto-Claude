import { FlatList, Pressable, StatusBar, StyleSheet, Text, View } from "react-native";
import { useEffect, useMemo, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Calendar } from "react-native-calendars";
import { Timestamp, collection, limit, onSnapshot, orderBy, query, where } from "firebase/firestore";
import * as Notifications from "expo-notifications";

import { firebaseDb } from "../src/lib/firebase";

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

type EventFilter = "today" | "overdue" | "upcoming" | "past" | "all";
type AppointmentType = "test-drive" | "finance" | "follow-up" | "delivery" | "meeting" | "other";

type Appointment = {
  id: string;
  title: string;
  customer: string;
  startAtMs: number;
  type: AppointmentType;
  location: string;
  assignedTo: string | null;
  leadSubmissionId: string | null;
  notes?: string | null;
  leadSummary?: string | null;
};

function toDateKey(ms: number) {
  return new Date(ms).toISOString().slice(0, 10);
}

function formatEventTime(ms: number) {
  return new Date(ms).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" });
}

function formatEventDate(ms: number) {
  return new Date(ms).toLocaleDateString("en-ZA", { weekday: "short", day: "2-digit", month: "short" });
}

export default function CalendarScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();

  const initialDateParam = typeof params.date === "string" ? params.date : null;
  const [selectedDateKey, setSelectedDateKey] = useState(() => initialDateParam ?? toDateKey(Date.now()));
  const [eventFilter, setEventFilter] = useState<EventFilter>("upcoming");
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [followUps, setFollowUps] = useState<Appointment[]>([]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const scheduled = await Notifications.getAllScheduledNotificationsAsync().catch(() => []);
      for (const n of scheduled) {
        const raw = n.content.data as unknown;
        const data = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
        if (data.kind === "followup") {
          await Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {});
        }
      }

      const permission = await Notifications.getPermissionsAsync().catch(() => null);
      const granted = permission?.granted ?? permission?.ios?.status === Notifications.IosAuthorizationStatus.AUTHORIZED;
      if (!granted) {
        const req = await Notifications.requestPermissionsAsync().catch(() => null);
        const ok = req?.granted ?? req?.ios?.status === Notifications.IosAuthorizationStatus.AUTHORIZED;
        if (!ok) return;
      }

      const now = Date.now();
      const horizonMs = 14 * 24 * 60 * 60 * 1000;
      const upcoming = followUps
        .filter((f) => f.type === "follow-up" && !!f.leadSubmissionId)
        .filter((f) => f.startAtMs > now && f.startAtMs - now < horizonMs)
        .slice(0, 100);

      for (const f of upcoming) {
        if (cancelled) return;
        const leadId = f.leadSubmissionId as string;
        const baseBody = [f.leadSummary ?? "", f.notes ?? ""].filter(Boolean).join("\n");
        const times = [
          { minutes: 30, label: "30 min" },
          { minutes: 15, label: "15 min" },
          { minutes: 0, label: "now" },
        ] as const;

        for (const t of times) {
          const triggerMs = f.startAtMs - t.minutes * 60_000;
          if (triggerMs <= now + 3_000) continue;
          await Notifications.scheduleNotificationAsync({
            content: {
              title: t.minutes === 0 ? `Follow-up due: ${f.customer}` : `Follow-up in ${t.label}: ${f.customer}`,
              body: baseBody || "Tap to open the lead.",
              data: { type: "lead", leadId, kind: "followup", minutes: t.minutes },
            },
            trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(triggerMs) },
          }).catch(() => {});
        }
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [followUps]);

  useEffect(() => {
    if (!initialDateParam) return;
    setSelectedDateKey(initialDateParam);
  }, [initialDateParam]);

  useEffect(() => {
    const q = query(collection(firebaseDb, "appointments"), orderBy("startAt", "asc"), limit(500));
    return onSnapshot(
      q,
      (snapshot) => {
        const next = snapshot.docs.map((d) => {
          const data = d.data() as {
            title?: string;
            customer?: string;
            startAt?: Timestamp | null;
            type?: AppointmentType;
            location?: string;
            assignedTo?: string | null;
            leadSubmissionId?: string | null;
            notes?: string | null;
            leadSummary?: string | null;
          };

          const startAtMs = data.startAt?.toDate?.().getTime?.() ?? Date.now();
          return {
            id: d.id,
            title: data.title ?? "Appointment",
            customer: data.customer ?? "Unknown Customer",
            startAtMs,
            type: data.type ?? "other",
            location: data.location ?? "",
            assignedTo: data.assignedTo ?? null,
            leadSubmissionId: data.leadSubmissionId ?? null,
            notes: typeof data.notes === "string" ? data.notes : null,
            leadSummary: typeof data.leadSummary === "string" ? data.leadSummary : null,
          } satisfies Appointment;
        });
        setAppointments(next);
      },
      () => setAppointments([]),
    );
  }, []);

  useEffect(() => {
    const floor = Timestamp.fromDate(new Date(2000, 0, 1));
    const q = query(collection(firebaseDb, "lead_submissions"), where("followUpAt", ">=", floor), orderBy("followUpAt", "asc"), limit(500));
    return onSnapshot(
      q,
      (snapshot) => {
        const next = snapshot.docs
          .map((d) => {
            const data = d.data() as Record<string, unknown>;
            const followUpAtRaw = data.followUpAt;
            const followUpAtMs =
              followUpAtRaw instanceof Timestamp
                ? followUpAtRaw.toDate().getTime()
                : typeof followUpAtRaw === "object" && followUpAtRaw !== null && "toDate" in followUpAtRaw && typeof (followUpAtRaw as { toDate: () => Date }).toDate === "function"
                  ? (followUpAtRaw as { toDate: () => Date }).toDate().getTime()
                  : null;
            if (!followUpAtMs) return null;
            if (data.followUpDone === true) return null;

            const customerObj =
              typeof data.customer === "object" && data.customer !== null ? (data.customer as Record<string, unknown>) : null;
            const vehicleObj =
              typeof data.vehicle === "object" && data.vehicle !== null ? (data.vehicle as Record<string, unknown>) : null;
            const customerName = (typeof customerObj?.name === "string" ? customerObj?.name : null) ?? "Unknown Customer";
            const vehicleName =
              (typeof vehicleObj?.name === "string" ? vehicleObj?.name : null) ??
              (typeof vehicleObj?.stockNumber === "string" ? vehicleObj?.stockNumber : null) ??
              "";
            const assignedTo = typeof data.assignedToEmail === "string" ? data.assignedToEmail : null;
            const followUpNote = typeof data.followUpNote === "string" ? data.followUpNote : null;
            const leadTypeRaw = typeof data.type === "string" ? data.type : "lead";
            const leadType =
              leadTypeRaw === "vehicle_enquiry"
                ? "Vehicle Enquiry"
                : leadTypeRaw === "test_drive"
                  ? "Test Drive"
                  : leadTypeRaw === "trade_in"
                    ? "Trade-In"
                    : leadTypeRaw === "finance"
                      ? "Finance"
                      : leadTypeRaw === "contact"
                        ? "Contact"
                        : "Lead";
            const source = typeof data.source === "string" ? data.source : "";
            const leadSummary = [leadType, source ? `Source: ${source}` : "", vehicleName ? `Vehicle: ${vehicleName}` : ""]
              .filter(Boolean)
              .join(" • ");

            return {
              id: `lead_${d.id}__followup`,
              title: "Follow-up",
              customer: customerName,
              startAtMs: followUpAtMs,
              type: "follow-up",
              location: vehicleName,
              assignedTo,
              leadSubmissionId: d.id,
              notes: followUpNote,
              leadSummary,
            } satisfies Appointment;
          })
          .filter(Boolean) as Appointment[];
        setFollowUps(next);
      },
      () => setFollowUps([]),
    );
  }, []);

  const allEvents = useMemo(() => {
    const merged = new Map<string, Appointment>();
    for (const a of appointments) merged.set(a.id, a);
    for (const f of followUps) if (!merged.has(f.id)) merged.set(f.id, f);
    return Array.from(merged.values());
  }, [appointments, followUps]);

  const markedDates = useMemo(() => {
    const marks: Record<string, { marked?: boolean; dotColor?: string; selected?: boolean; selectedColor?: string }> = {};
    for (const a of allEvents) {
      const key = toDateKey(a.startAtMs);
      marks[key] = { ...(marks[key] ?? {}), marked: true, dotColor: COLORS.primary };
    }
    marks[selectedDateKey] = { ...(marks[selectedDateKey] ?? {}), selected: true, selectedColor: COLORS.primary };
    return marks;
  }, [allEvents, selectedDateKey]);

  const filteredAppointments = useMemo(() => {
    const now = Date.now();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayStartMs = todayStart.getTime();
    const todayEndMs = todayStartMs + 24 * 60 * 60 * 1000;

    const base =
      eventFilter === "all"
        ? allEvents
        : eventFilter === "today"
          ? allEvents.filter((a) => a.startAtMs >= todayStartMs && a.startAtMs < todayEndMs)
          : eventFilter === "overdue"
            ? allEvents.filter((a) => a.type === "follow-up" && a.startAtMs < now)
          : eventFilter === "past"
            ? allEvents.filter((a) => a.startAtMs < now)
            : allEvents.filter((a) => a.startAtMs >= now);

    const selectedDay = allEvents.filter((a) => toDateKey(a.startAtMs) === selectedDateKey);
    const merged = eventFilter === "today" || eventFilter === "all" ? base : base;
    const sorted = [...merged].sort((a, b) => {
      if (eventFilter === "past") return b.startAtMs - a.startAtMs;
      return a.startAtMs - b.startAtMs;
    });

    if (eventFilter === "all") return sorted;
    if (eventFilter === "today") return sorted;
    if (selectedDay.length > 0 && eventFilter === "upcoming") {
      const selectedSorted = [...selectedDay].sort((a, b) => a.startAtMs - b.startAtMs);
      const selectedIsToday = selectedDateKey === toDateKey(Date.now());
      if (!selectedIsToday) return selectedSorted;
    }
    return sorted;
  }, [allEvents, eventFilter, selectedDateKey]);

  const scheduleTitle =
    eventFilter === "today"
      ? "Today's Schedule"
        : eventFilter === "overdue"
          ? "Overdue Follow-ups"
      : eventFilter === "upcoming"
        ? "Upcoming Events"
        : eventFilter === "past"
          ? "Past Events"
          : "All Events";

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />

      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color={COLORS.primaryForeground} />
        </Pressable>
        <Text style={styles.headerTitle}>Calendar</Text>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        data={filteredAppointments}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View>
            <View style={styles.calendarCard}>
              <Calendar
                theme={{
                  backgroundColor: COLORS.card,
                  calendarBackground: COLORS.card,
                  textSectionTitleColor: COLORS.textMuted,
                  selectedDayBackgroundColor: COLORS.primary,
                  selectedDayTextColor: COLORS.primaryForeground,
                  todayTextColor: COLORS.primary,
                  dayTextColor: COLORS.text,
                  textDisabledColor: "#444",
                  dotColor: COLORS.primary,
                  selectedDotColor: COLORS.text,
                  arrowColor: COLORS.primary,
                  monthTextColor: COLORS.text,
                  indicatorColor: COLORS.primary,
                }}
                markedDates={markedDates}
                onDayPress={(d) => setSelectedDateKey(d.dateString)}
              />
            </View>

            <View style={styles.filters}>
              {(
                [
                  { key: "today", label: "Today" },
                  { key: "upcoming", label: "Upcoming" },
                  { key: "overdue", label: "Overdue" },
                  { key: "past", label: "Past" },
                  { key: "all", label: "All" },
                ] as const
              ).map((f) => {
                const active = eventFilter === f.key;
                return (
                  <Pressable
                    key={f.key}
                    onPress={() => {
                      setEventFilter(f.key);
                      if (f.key === "today") setSelectedDateKey(toDateKey(Date.now()));
                    }}
                    style={[styles.filterChip, active && styles.filterChipActive]}
                  >
                    <Text style={[styles.filterText, active && styles.filterTextActive]}>{f.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{scheduleTitle}</Text>
              <Text style={styles.sectionSubtitle}>{selectedDateKey}</Text>
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.eventItem}
            onPress={() => {
              if (item.leadSubmissionId) router.push(`/leads/${encodeURIComponent(item.leadSubmissionId)}`);
            }}
          >
            <View style={styles.eventTopRow}>
              <View style={styles.eventTime}>
                <Ionicons name="time" size={16} color={COLORS.primary} />
                <Text style={styles.eventTimeText}>
                  {formatEventDate(item.startAtMs)} • {formatEventTime(item.startAtMs)}
                </Text>
              </View>
              <View style={styles.typePill}>
                <Text style={styles.typePillText}>{item.type}</Text>
              </View>
            </View>
            <Text style={styles.eventTitle} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.eventSub} numberOfLines={1}>
              {item.customer}
              {item.location ? ` • ${item.location}` : ""}
            </Text>
            {item.leadSummary || item.notes ? (
              <Text style={styles.eventNote} numberOfLines={2}>
                {[item.leadSummary ?? "", item.notes ?? ""].filter(Boolean).join(" — ")}
              </Text>
            ) : null}
          </Pressable>
        )}
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Ionicons name="calendar-outline" size={28} color={COLORS.textMuted} />
            <Text style={styles.emptyText}>No events found</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.text,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  calendarCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
    marginBottom: 14,
  },
  filters: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
    marginBottom: 14,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterText: {
    color: COLORS.text,
    fontWeight: "800",
    fontSize: 12,
  },
  filterTextActive: {
    color: COLORS.primaryForeground,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: COLORS.text,
  },
  sectionSubtitle: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.textMuted,
  },
  eventItem: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  eventTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  eventTime: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  eventTimeText: {
    color: COLORS.textMuted,
    fontWeight: "700",
    fontSize: 12,
  },
  typePill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: COLORS.cardHighlight,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  typePillText: {
    color: COLORS.text,
    fontWeight: "800",
    fontSize: 11,
  },
  eventTitle: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 14,
  },
  eventSub: {
    marginTop: 3,
    color: COLORS.textMuted,
    fontWeight: "600",
    fontSize: 12,
  },
  eventNote: {
    marginTop: 6,
    color: COLORS.textMuted,
    fontWeight: "500",
    fontSize: 12,
  },
  emptyCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 8,
    marginTop: 8,
  },
  emptyText: {
    color: COLORS.textMuted,
    fontWeight: "700",
  },
});
