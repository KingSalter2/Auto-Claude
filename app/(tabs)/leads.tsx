import { Pressable, StyleSheet, Text, View, FlatList, RefreshControl, StatusBar, Dimensions, Modal } from "react-native";
import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Calendar } from "react-native-calendars";
import { collection, doc, limit, onSnapshot, orderBy, query, serverTimestamp, Timestamp, updateDoc, where } from "firebase/firestore";

import { subscribeRecentLeads } from "../../src/services/leadService";
import type { CrmStage, LeadStatus, LeadSubmission } from "../../src/models/lead";
import { timeAgo } from "../../src/utils/format";
import { useAuth } from "../../src/auth/AuthContext";
import { EmptyState } from "../../src/components/common/EmptyState";
import { Badge } from "../../src/components/ui/Badge";
import { firebaseDb } from "../../src/lib/firebase";

// Modern Dark Theme Colors (matching Dashboard)
const COLORS = {
  background: "#09090b",
  card: "#18181b", 
  cardHighlight: "#27272a",
  primary: "#FACC15", // Yellow
  primaryForeground: "#000000",
  text: "#FFFFFF",
  textMuted: "#A1A1AA",
  border: "#27272a",
  danger: "#ef4444",
};

const CRM_STAGE_CHOICES: Array<{ label: string; value: CrmStage | "all" }> = [
  { label: "All", value: "all" },
  { label: "New", value: "new" },
  { label: "Contacted", value: "contacted" },
  { label: "Test Drive", value: "test_drive" },
  { label: "Finance", value: "finance" },
  { label: "Unqualified", value: "unqualified" },
  { label: "Sold", value: "sold" },
];

type TaskStatus = "pending" | "in-progress" | "completed" | "rejected";
type TaskType =
  | "general"
  | "lead"
  | "follow_up"
  | "appointment"
  | "trade_in"
  | "finance"
  | "delivery"
  | "vehicle_prep"
  | "admin";
type AssignedTask = {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: "low" | "medium" | "high";
  dueDate: Date | null;
  type: TaskType;
  leadSubmissionId?: string | null;
};

const TASK_STATUS_CHOICES: Array<{ label: string; value: TaskStatus | "all" }> = [
  { label: "All", value: "all" },
  { label: "Not Started", value: "pending" },
  { label: "In Progress", value: "in-progress" },
  { label: "Completed", value: "completed" },
  { label: "Rejected", value: "rejected" },
];

type TopTab = "leads" | "assigned" | "archived";

const TOP_TABS: Array<{ key: TopTab; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { key: "leads", label: "Leads", icon: "list" },
  { key: "assigned", label: "Work", icon: "briefcase" },
  { key: "archived", label: "Archived", icon: "archive" },
];

export default function LeadsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { canAccess, user, userProfile } = useAuth();
  const insets = useSafeAreaInsets();
  const canSeeLeads = canAccess("Leads & CRM");
  const actorEmail = (userProfile?.email ?? user?.email ?? null)?.trim().toLowerCase() ?? null;
  const isAdmin = userProfile?.role === "Admin";

  const [leads, setLeads] = useState<LeadSubmission[]>([]);
  const [tasks, setTasks] = useState<AssignedTask[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [filterStatus, setFilterStatus] = useState<LeadStatus | "all">("all");
  const [filterStage, setFilterStage] = useState<CrmStage | "all">("all");
  const [taskStatusFilter, setTaskStatusFilter] = useState<TaskStatus | "all">("all");
  const [topTab, setTopTab] = useState<TopTab>("leads");
  const [hasSetInitialTopTab, setHasSetInitialTopTab] = useState(false);
  const [taskDueFilter, setTaskDueFilter] = useState<"today" | "overdue" | "all">("all");
  const [showAssignedLeads, setShowAssignedLeads] = useState(false);
  const [taskStatusModalTask, setTaskStatusModalTask] = useState<AssignedTask | null>(null);
  const [showLeadFilters, setShowLeadFilters] = useState(false);
  
  // Date Filtering State
  const [isCalendarVisible, setIsCalendarVisible] = useState(false);
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);

  const visibleTabs = useMemo(() => {
    if (isAdmin) return TOP_TABS;
    return TOP_TABS.filter((t) => t.key === "assigned");
  }, [isAdmin]);

  useEffect(() => {
    if (!canSeeLeads) return;
    if (hasSetInitialTopTab) return;
    if (!userProfile && !user) return;
    setTopTab(isAdmin ? "leads" : "assigned");
    setHasSetInitialTopTab(true);
  }, [canSeeLeads, hasSetInitialTopTab, isAdmin, user, userProfile]);

  useEffect(() => {
    if (params.status && typeof params.status === 'string') {
      setFilterStatus(params.status as LeadStatus | "all");
    } else {
      setFilterStatus("all");
    }
  }, [params.status]);

  const taskStatusLabel = useCallback((status: TaskStatus) => {
    switch (status) {
      case "pending":
        return "Not Started";
      case "in-progress":
        return "In Progress";
      case "completed":
        return "Completed";
      case "rejected":
        return "Rejected";
      default:
        return String(status);
    }
  }, []);

  const updateTaskStatus = useCallback(
    async (taskId: string, nextStatus: TaskStatus) => {
      await updateDoc(doc(firebaseDb, "tasks", taskId), { status: nextStatus, updatedAt: serverTimestamp() });
    },
    [],
  );

  useEffect(() => {
    if (!canSeeLeads) {
      setLeads([]);
      return;
    }
    const unsub = subscribeRecentLeads({ onNext: setLeads, take: 200 });
    return () => unsub();
  }, [canSeeLeads]);

  useEffect(() => {
    if (topTab === "assigned") {
      setFilterStatus("all");
      router.setParams({ status: "all" });
      setFilterStage("all");
      setShowAssignedLeads(false);
      setShowLeadFilters(false);
      setStartDate(null);
      setEndDate(null);
      setIsCalendarVisible(false);
    }
  }, [router, topTab]);

  useEffect(() => {
    if (topTab !== "assigned") {
      setTasks([]);
      return;
    }
    if (!actorEmail) {
      setTasks([]);
      return;
    }
    const q = query(
      collection(firebaseDb, "tasks"),
      where("assignedToEmail", "==", actorEmail),
      orderBy("dueDate", "asc"),
      limit(100),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const statusValues: TaskStatus[] = ["pending", "in-progress", "completed", "rejected"];
        const priorityValues: Array<AssignedTask["priority"]> = ["low", "medium", "high"];
        const typeValues: TaskType[] = [
          "general",
          "lead",
          "follow_up",
          "appointment",
          "trade_in",
          "finance",
          "delivery",
          "vehicle_prep",
          "admin",
        ];
        const toDate = (value: unknown) => {
          if (value instanceof Timestamp) return value.toDate();
          if (value instanceof Date) return value;
          if (typeof value === "string") {
            const d = new Date(value);
            if (!Number.isNaN(d.getTime())) return d;
          }
          return null;
        };

        const mapped = snap.docs.map((d) => {
          const data = d.data() as Record<string, unknown>;
          const title = typeof data.title === "string" ? data.title : "";
          const description = typeof data.description === "string" ? data.description : "";
          const status = statusValues.includes(data.status as TaskStatus) ? (data.status as TaskStatus) : "pending";
          const priority = priorityValues.includes(data.priority as AssignedTask["priority"]) ? (data.priority as AssignedTask["priority"]) : "medium";
          const dueDate = toDate(data.dueDate);
          const type = typeValues.includes(data.type as TaskType) ? (data.type as TaskType) : "general";
          const leadSubmissionId = typeof data.leadSubmissionId === "string" ? data.leadSubmissionId : null;
          return { id: d.id, title, description, status, priority, dueDate, type, leadSubmissionId } satisfies AssignedTask;
        });
        setTasks(mapped);
      },
      () => setTasks([]),
    );
    return () => unsub();
  }, [actorEmail, topTab]);

  useEffect(() => {
    if (topTab !== "assigned") setTaskDueFilter("all");
  }, [topTab]);

  const getEffectiveStage = useCallback((l: LeadSubmission): CrmStage => {
    if (l.crmStage) return l.crmStage;
    return l.status === "new" ? "new" : "contacted";
  }, []);

  const filteredLeads = useMemo(() => {
    let result = leads;

    if (topTab === "archived") {
      result = result.filter((l) => l.status === "archived");
    } else {
      result = result.filter((l) => l.status !== "archived");
    }

    if (topTab === "assigned") {
      const email = actorEmail ?? "";
      result = result.filter((l) => (l.assignedToEmail ?? "").trim().toLowerCase() === email);
    }

    if (filterStatus !== "all") {
      result = result.filter((l) => l.status === filterStatus);
    }

    // Pipeline Filter
    if (topTab === "leads" && filterStage !== "all") {
      result = result.filter((l) => getEffectiveStage(l) === filterStage);
    }

    // Date Filter
    if (startDate) {
        const start = new Date(startDate).getTime();
        const end = endDate ? new Date(endDate).getTime() : start + 86400000; // Default to 1 day if no end date
        
        result = result.filter((l) => {
            const leadDate = new Date(l.createdAt).getTime();
            // Add padding to end date to include the full day
            const endPadding = endDate ? 86400000 : 0; 
            return leadDate >= start && leadDate < (end + endPadding);
        });
    }

    return result;
  }, [leads, topTab, actorEmail, filterStatus, filterStage, startDate, endDate, getEffectiveStage]);

  const allowedTaskTypes = useMemo(() => {
    const role = userProfile?.role ?? null;
    if (role === "F&I Manager") return new Set<TaskType>(["finance", "follow_up", "general"]);
    if (role === "Receptionist") return new Set<TaskType>(["appointment", "general"]);
    if (role === "Sales Executive") return new Set<TaskType>(["lead", "follow_up", "appointment", "trade_in", "delivery", "general"]);
    return null;
  }, [userProfile?.role]);

  const filteredTasks = useMemo(() => {
    const byRole = allowedTaskTypes ? tasks.filter((t) => allowedTaskTypes.has(t.type)) : tasks;
    const byStatus = taskStatusFilter === "all" ? byRole : byRole.filter((t) => t.status === taskStatusFilter);
    if (taskDueFilter === "all") return byStatus;

    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    if (taskDueFilter === "today") {
      return byStatus.filter((t) => {
        if (!t.dueDate) return false;
        return t.dueDate >= start && t.dueDate < end;
      });
    }

    return byStatus.filter((t) => {
      if (!t.dueDate) return false;
      if (t.status === "completed") return false;
      return t.dueDate < start;
    });
  }, [allowedTaskTypes, taskDueFilter, taskStatusFilter, tasks]);

  const taskCounts = useMemo(() => {
    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    const today = tasks.filter((t) => t.dueDate && t.dueDate >= start && t.dueDate < end);
    const overdue = tasks.filter((t) => t.dueDate && t.status !== "completed" && t.dueDate < start);
    return { today: today.length, overdue: overdue.length };
  }, [tasks]);

  // Calendar Marked Dates
  const markedDates = useMemo(() => {
    if (!startDate) return {};
    
    type CalendarMark = {
      startingDay?: boolean;
      endingDay?: boolean;
      color?: string;
      textColor?: string;
      selected?: boolean;
    };
    const marks: Record<string, CalendarMark> = {};
    marks[startDate] = { startingDay: true, color: COLORS.primary, textColor: 'black' };
    
    if (endDate) {
        marks[endDate] = { endingDay: true, color: COLORS.primary, textColor: 'black' };
        
        // Fill days in between
        const curr = new Date(startDate);
        const last = new Date(endDate);
        curr.setDate(curr.getDate() + 1);
        
        while (curr < last) {
            const dateStr = curr.toISOString().split('T')[0];
            marks[dateStr] = { color: COLORS.primary + '80', textColor: 'white' };
            curr.setDate(curr.getDate() + 1);
        }
    } else {
        marks[startDate] = { selected: true, color: COLORS.primary, textColor: 'black' };
    }
    
    return marks;
  }, [startDate, endDate]);

  const onDayPress = (day: { dateString: string }) => {
    if (!startDate || (startDate && endDate)) {
        setStartDate(day.dateString);
        setEndDate(null);
    } else {
        // Check if selected date is before start date
        if (new Date(day.dateString) < new Date(startDate)) {
            setStartDate(day.dateString);
            setEndDate(null);
        } else {
            setEndDate(day.dateString);
        }
    }
  };

  const clearDateFilter = () => {
    setStartDate(null);
    setEndDate(null);
    setIsCalendarVisible(false);
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  // Stats for the "Score" widget
  const stats = useMemo(() => {
    const active = leads.filter((l) => l.status !== "archived");
    const total = active.length;
    const contacted = active.filter((l) => l.status === "contacted" || l.status === "reviewed").length;
    const newLeads = active.filter((l) => l.status === "new").length;
    const score = total > 0 ? Math.round((contacted / total) * 100) : 0;
    return { total, contacted, newLeads, score };
  }, [leads]);

  const assignedLeads = useMemo(() => {
    if (topTab !== "assigned") return [];
    const email = actorEmail ?? "";
    return leads
      .filter((l) => l.status !== "archived")
      .filter((l) => (l.assignedToEmail ?? "").trim().toLowerCase() === email);
  }, [actorEmail, leads, topTab]);

  const renderLeadItem = ({ item }: { item: LeadSubmission }) => (
    <Pressable 
      style={styles.leadCard} 
      onPress={() => router.push(`/leads/${item.id}`)}
    >
        <View style={styles.leadIconContainer}>
            <Ionicons name="person" size={20} color={COLORS.text} />
        </View>
        
        <View style={styles.leadContent}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <Text style={styles.leadTitle}>{item.customer?.name || "Unknown"}</Text>
              <Badge
                variant="muted"
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  backgroundColor: COLORS.cardHighlight,
                  borderColor: COLORS.border,
                }}
              >
                <Text style={{ color: COLORS.textMuted, fontSize: 10, fontWeight: "600" }}>
                  {getEffectiveStage(item).replace(/_/g, " ").toUpperCase()}
                </Text>
              </Badge>
            </View>
            <Text style={styles.leadSubtitle}>
                {item.vehicle?.name || "General Enquiry"}
            </Text>
            <View style={styles.leadMetaRow}>
                <Ionicons name="time-outline" size={12} color={COLORS.danger} />
                <Text style={styles.leadMetaText}>{timeAgo(item.createdAt)}</Text>
            </View>
            {item.followUpAt && item.followUpDone !== true ? (
              <View style={styles.followUpRow}>
                <Ionicons name="calendar-outline" size={12} color={COLORS.textMuted} />
                <Text style={styles.followUpText}>
                  Next follow-up:{" "}
                  {new Date(item.followUpAt).toLocaleString("en-ZA", {
                    weekday: "short",
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
              </View>
            ) : null}
        </View>

        <View style={styles.leadAction}>
            {item.status === 'new' && (
                <View style={styles.checkbox} />
            )}
        </View>
    </Pressable>
  );

  const renderTaskItem = ({ item }: { item: AssignedTask }) => {
    const primaryAction =
      item.status === "pending"
        ? { label: "Start", next: "in-progress" as const }
        : item.status === "in-progress"
          ? { label: "Complete", next: "completed" as const }
          : null;

    return (
      <Pressable
        onPress={() => {
          if (item.leadSubmissionId) router.push(`/leads/${item.leadSubmissionId}`);
        }}
        disabled={!item.leadSubmissionId}
        style={{
          backgroundColor: COLORS.card,
          borderRadius: 14,
          padding: 14,
          borderWidth: 1,
          borderColor: COLORS.border,
          marginBottom: 10,
          opacity: item.leadSubmissionId ? 1 : 0.95,
        }}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: COLORS.text, fontWeight: "800", fontSize: 14 }} numberOfLines={1}>
              {item.title || "Task"}
            </Text>
            {item.description ? (
              <Text style={{ color: COLORS.textMuted, fontSize: 12, marginTop: 6 }} numberOfLines={2}>
                {item.description}
              </Text>
            ) : null}
          </View>

          <View style={{ alignItems: "flex-end", gap: 8 }}>
            <Badge
              variant="muted"
              style={{
                paddingHorizontal: 10,
                paddingVertical: 4,
                backgroundColor: COLORS.cardHighlight,
                borderColor: COLORS.border,
              }}
            >
              <Text style={{ color: COLORS.textMuted, fontSize: 10, fontWeight: "700" }}>{item.priority.toUpperCase()}</Text>
            </Badge>

            {item.type !== "general" ? (
              <Badge
                variant="muted"
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  backgroundColor: COLORS.cardHighlight,
                  borderColor: COLORS.border,
                }}
              >
                <Text style={{ color: COLORS.textMuted, fontSize: 10, fontWeight: "700" }}>
                  {item.type.replace("_", " ").toUpperCase()}
                </Text>
              </Badge>
            ) : null}

            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Pressable onPress={() => setTaskStatusModalTask(item)} hitSlop={10}>
                <Badge
                  variant="muted"
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    backgroundColor: COLORS.cardHighlight,
                    borderColor: COLORS.border,
                  }}
                >
                  <Text style={{ color: COLORS.textMuted, fontSize: 10, fontWeight: "700" }}>{taskStatusLabel(item.status)}</Text>
                </Badge>
              </Pressable>

              {primaryAction ? (
                <Pressable
                  onPress={() => void updateTaskStatus(item.id, primaryAction.next).catch(() => {})}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 999,
                    backgroundColor: COLORS.primary,
                    borderWidth: 1,
                    borderColor: COLORS.primary,
                  }}
                >
                  <Text style={{ color: COLORS.primaryForeground, fontWeight: "900", fontSize: 12 }}>{primaryAction.label}</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        </View>

        {item.dueDate ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 }}>
            <Ionicons name="calendar-outline" size={12} color={COLORS.textMuted} />
            <Text style={{ color: COLORS.textMuted, fontSize: 12 }}>
              Due:{" "}
              {item.dueDate.toLocaleString("en-ZA", {
                weekday: "short",
                day: "2-digit",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>
          </View>
        ) : null}
      </Pressable>
    );
  };

  if (!canSeeLeads) {
    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <EmptyState title="No access" description="Your account is not enabled for Leads & CRM." icon="lock-closed-outline" />
        </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
      
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.navigate('/')} style={styles.backButton}>
            <Ionicons name="arrow-back" size={20} color="#000000" />
        </Pressable>
        <Text style={styles.headerTitle}>{topTab === "assigned" ? "Work" : "Leads"}</Text>
        {topTab === "assigned" ? (
          <View style={{ width: 40 }} />
        ) : (
          <Pressable
            style={styles.calendarButton}
            onPress={() => {
              setShowLeadFilters(true);
              setIsCalendarVisible(true);
            }}
          >
            <Ionicons name={startDate ? "calendar" : "calendar-outline"} size={24} color={startDate ? COLORS.primary : COLORS.text} />
          </Pressable>
        )}
      </View>

      {/* Date Filter Modal */}
      <Modal
        visible={isCalendarVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsCalendarVisible(false)}
      >
        <View style={styles.modalOverlay}>
            <Pressable style={styles.modalBackdrop} onPress={() => setIsCalendarVisible(false)} />
            <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Filter by Date</Text>
                    <Pressable onPress={() => setIsCalendarVisible(false)}>
                        <Ionicons name="close" size={24} color={COLORS.text} />
                    </Pressable>
                </View>
                
                <Calendar
                    theme={{
                        backgroundColor: COLORS.card,
                        calendarBackground: COLORS.card,
                        textSectionTitleColor: COLORS.textMuted,
                        selectedDayBackgroundColor: COLORS.primary,
                        selectedDayTextColor: COLORS.primaryForeground,
                        todayTextColor: COLORS.primary,
                        dayTextColor: COLORS.text,
                        textDisabledColor: '#444',
                        dotColor: COLORS.primary,
                        selectedDotColor: COLORS.text,
                        arrowColor: COLORS.primary,
                        monthTextColor: COLORS.text,
                        indicatorColor: COLORS.primary,
                    }}
                    markedDates={markedDates}
                    markingType="period"
                    onDayPress={onDayPress}
                />

                <View style={styles.modalFooter}>
                    <Pressable style={styles.modalButtonSecondary} onPress={clearDateFilter}>
                        <Text style={styles.modalButtonTextSecondary}>Clear</Text>
                    </Pressable>
                    <Pressable style={styles.modalButtonPrimary} onPress={() => setIsCalendarVisible(false)}>
                        <Text style={styles.modalButtonTextPrimary}>Apply</Text>
                    </Pressable>
                </View>
            </View>
        </View>
      </Modal>

      {visibleTabs.length > 1 ? (
        <View style={styles.topTabs}>
          {visibleTabs.map((t) => {
            const active = topTab === t.key;
            return (
              <Pressable key={t.key} onPress={() => setTopTab(t.key)} style={styles.topTab}>
                <Ionicons name={t.icon} size={20} color={active ? COLORS.text : COLORS.textMuted} />
                <Text style={[styles.topTabLabel, active && styles.topTabLabelActive]}>{t.label}</Text>
                <View style={[styles.topTabUnderline, active && styles.topTabUnderlineActive]} />
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {topTab === "assigned" ? (
        <FlatList
          data={filteredTasks}
          keyExtractor={(item) => item.id}
          renderItem={renderTaskItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <>
              <View style={styles.notificationCard}>
                <View style={styles.notificationContent}>
                  <Text style={styles.notificationTitle}>Today</Text>
                  <Text style={styles.notificationText}>
                    {taskCounts.today} due today • {taskCounts.overdue} overdue
                  </Text>
                </View>
                <View style={styles.notificationIcon}>
                  <Ionicons name="calendar" size={24} color={COLORS.card} />
                </View>
              </View>

              <View style={styles.stageFilterRow}>
                {[
                  { label: "All", value: "all" as const },
                  { label: "Today", value: "today" as const },
                  { label: "Overdue", value: "overdue" as const },
                ].map((s) => {
                  const active = taskDueFilter === s.value;
                  return (
                    <Pressable
                      key={s.value}
                      onPress={() => setTaskDueFilter(s.value)}
                      style={[styles.stageChip, active && styles.stageChipActive]}
                    >
                      <Text style={[styles.stageChipText, active && styles.stageChipTextActive]}>{s.label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.stageFilterRow}>
                {TASK_STATUS_CHOICES.filter((s) => s.value === "all" || s.value === "pending" || s.value === "in-progress" || s.value === "completed").map(
                  (s) => {
                    const active = taskStatusFilter === s.value;
                    return (
                      <Pressable
                        key={s.value}
                        onPress={() => setTaskStatusFilter(s.value)}
                        style={[styles.stageChip, active && styles.stageChipActive]}
                      >
                        <Text style={[styles.stageChipText, active && styles.stageChipTextActive]}>{s.label}</Text>
                      </Pressable>
                    );
                  },
                )}
              </View>

              <View style={styles.sectionHeader}>
                <Ionicons name="briefcase-outline" size={20} color={COLORS.primary} />
                <Text style={styles.sectionHeaderText}>Assigned Tasks</Text>
              </View>
            </>
          }
          ListEmptyComponent={
            <View style={{ backgroundColor: COLORS.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: COLORS.border }}>
              <Text style={{ color: COLORS.textMuted, fontSize: 12 }}>No tasks found.</Text>
            </View>
          }
          ListFooterComponent={
            <View style={{ paddingTop: 8, paddingBottom: 100 }}>
              <Pressable
                onPress={() => setShowAssignedLeads((v) => !v)}
                style={[styles.sectionHeader, { marginTop: 8, justifyContent: "space-between" }]}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <Ionicons name="people-outline" size={20} color={COLORS.primary} />
                  <Text style={styles.sectionHeaderText}>My Leads ({assignedLeads.length})</Text>
                </View>
                <Ionicons name={showAssignedLeads ? "chevron-up" : "chevron-down"} size={18} color={COLORS.textMuted} />
              </Pressable>

              {showAssignedLeads ? assignedLeads.slice(0, 20).map((l) => <View key={l.id}>{renderLeadItem({ item: l })}</View>) : null}
              {showAssignedLeads && assignedLeads.length > 20 ? (
                <Text style={{ color: COLORS.textMuted, fontSize: 12, marginTop: 6 }}>
                  Showing first 20 leads.
                </Text>
              ) : null}
            </View>
          }
        />
      ) : (
        <FlatList
          data={filteredLeads}
          keyExtractor={(item) => item.id}
          renderItem={renderLeadItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <>
              {isAdmin ? (
                <View style={styles.scoreSection}>
                  <View style={styles.scoreCircleOuter}>
                    <View style={styles.scoreCircleInner}>
                      <Ionicons name="people" size={32} color="#a855f7" />
                    </View>
                    <View style={[styles.progressRing, { borderTopColor: "#a855f7", borderRightColor: "#a855f7" }]} />
                  </View>
                  <Text style={styles.scoreTitle}>Total Active Leads</Text>
                  <Text style={styles.scoreSubtitle}>{stats.total} leads in pipeline</Text>
                </View>
              ) : null}

              {(filterStatus !== "all" || startDate) && (
                <View style={{ flexDirection: "row", justifyContent: "center", marginBottom: 20, gap: 8, flexWrap: "wrap" }}>
                  {filterStatus !== "all" && (
                    <Pressable
                      onPress={() => {
                        router.setParams({ status: "all" });
                        setFilterStatus("all");
                      }}
                    >
                      <Badge variant="default" style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
                        <Text style={{ color: "#000", fontWeight: "bold" }}>
                          Status: {filterStatus.toUpperCase()} <Ionicons name="close-circle" size={14} />
                        </Text>
                      </Badge>
                    </Pressable>
                  )}
                  {startDate && (
                    <Pressable onPress={clearDateFilter}>
                      <Badge variant="default" style={{ paddingHorizontal: 16, paddingVertical: 8, backgroundColor: COLORS.primary }}>
                        <Text style={{ color: "#000", fontWeight: "bold" }}>
                          {startDate} {endDate ? ` - ${endDate}` : ""} <Ionicons name="close-circle" size={14} />
                        </Text>
                      </Badge>
                    </Pressable>
                  )}
                </View>
              )}

              {topTab !== "archived" && isAdmin ? (
                <View style={styles.notificationCard}>
                  <View style={styles.notificationContent}>
                    <Text style={styles.notificationTitle}>Action Required</Text>
                    <Text style={styles.notificationText}>You have {stats.newLeads} new leads waiting for response.</Text>
                  </View>
                  <View style={styles.notificationIcon}>
                    <Ionicons name="notifications" size={24} color={COLORS.card} />
                  </View>
                </View>
              ) : null}

              {topTab === "leads" ? (
                <>
                  <Pressable
                    onPress={() => setShowLeadFilters((v) => !v)}
                    style={[
                      styles.notificationCard,
                      { marginTop: 0, marginBottom: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
                    ]}
                  >
                    <View>
                      <Text style={styles.notificationTitle}>Filters</Text>
                      <Text style={styles.notificationText}>
                        {filterStage === "all" ? "All stages" : String(filterStage).replace(/_/g, " ")} •{" "}
                        {startDate ? (endDate ? `${startDate} – ${endDate}` : startDate) : "All dates"}
                      </Text>
                    </View>
                    <Ionicons name={showLeadFilters ? "chevron-up" : "chevron-down"} size={20} color={COLORS.textMuted} />
                  </Pressable>

                  {showLeadFilters ? (
                    <View style={{ marginBottom: 6 }}>
                      <View style={styles.stageFilterRow}>
                        {CRM_STAGE_CHOICES.map((s) => {
                          const active = filterStage === s.value;
                          return (
                            <Pressable
                              key={s.value}
                              onPress={() => setFilterStage(s.value)}
                              style={[styles.stageChip, active && styles.stageChipActive]}
                            >
                              <Text style={[styles.stageChipText, active && styles.stageChipTextActive]}>{s.label}</Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  ) : null}
                </>
              ) : null}

              <View style={styles.sectionHeader}>
                <Ionicons name="sunny-outline" size={20} color={COLORS.primary} />
                <Text style={styles.sectionHeaderText}>
                  {topTab === "archived"
                    ? "Archived Leads"
                    : filterStage === "all"
                      ? "Leads"
                      : `${String(filterStage).replace(/_/g, " ")} Leads`}
                </Text>
              </View>
            </>
          }
          ListFooterComponent={<View style={{ height: 100 }} />}
        />
      )}

      <Modal
        visible={!!taskStatusModalTask}
        transparent
        animationType="fade"
        onRequestClose={() => setTaskStatusModalTask(null)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setTaskStatusModalTask(null)} />
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Update status</Text>
              <Pressable onPress={() => setTaskStatusModalTask(null)}>
                <Ionicons name="close" size={22} color={COLORS.textMuted} />
              </Pressable>
            </View>
            {(["pending", "in-progress", "completed"] as const).map((s) => (
              <Pressable
                key={s}
                onPress={() => {
                  if (!taskStatusModalTask) return;
                  void updateTaskStatus(taskStatusModalTask.id, s)
                    .then(() => setTaskStatusModalTask(null))
                    .catch(() => setTaskStatusModalTask(null));
                }}
                style={{
                  paddingVertical: 12,
                  paddingHorizontal: 14,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: COLORS.border,
                  backgroundColor: taskStatusModalTask?.status === s ? COLORS.cardHighlight : COLORS.card,
                  marginBottom: 10,
                }}
              >
                <Text style={{ color: COLORS.text, fontWeight: "800" }}>
                  {s === "pending" ? "Not Started" : s === "in-progress" ? "In Progress" : "Completed"}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </Modal>

      {/* Floating Action Button */}
      {/* <View style={styles.fabContainer}>
        <Pressable style={styles.fab} onPress={() => {  }}>
            <Text style={styles.fabText}>New Lead</Text>
            <Ionicons name="add-circle" size={24} color={COLORS.primaryForeground} />
        </Pressable>
      </View> */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  topTabs: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "flex-end",
    paddingHorizontal: 10,
    marginBottom: 18,
  },
  topTab: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    minWidth: 80,
  },
  topTabLabel: {
    marginTop: 6,
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: "800",
  },
  topTabLabelActive: {
    color: COLORS.text,
  },
  topTabUnderline: {
    marginTop: 10,
    height: 3,
    width: 28,
    borderRadius: 999,
    backgroundColor: "transparent",
  },
  topTabUnderlineActive: {
    backgroundColor: COLORS.primary,
  },
  calendarButton: {
    padding: 8,
  },
  scoreSection: {
    alignItems: 'center',
    marginVertical: 20,
  },
  scoreCircleOuter: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    position: 'relative',
  },
  scoreCircleInner: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.cardHighlight, // Slightly lighter
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressRing: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: 'transparent',
    transform: [{ rotate: '-45deg' }]
  },
  scoreTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  scoreSubtitle: {
    fontSize: 14,
    color: COLORS.textMuted,
  },
  notificationCard: {
    backgroundColor: COLORS.primary,
    borderRadius: 24,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.primaryForeground,
    marginBottom: 4,
  },
  notificationText: {
    fontSize: 12,
    color: 'rgba(0,0,0,0.7)',
    fontWeight: '500',
  },
  notificationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  sectionHeaderText: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  stageFilterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 18,
  },
  stageChip: {
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  stageChipActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary,
  },
  stageChipText: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: "700",
  },
  stageChipTextActive: {
    color: COLORS.primaryForeground,
  },
  leadCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
  },
  leadIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.cardHighlight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  leadContent: {
    flex: 1,
  },
  leadTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 2,
  },
  leadSubtitle: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginBottom: 6,
  },
  leadMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  leadMetaText: {
    fontSize: 12,
    color: COLORS.danger,
    fontWeight: '500',
  },
  followUpRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
  },
  followUpText: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: "600",
    flexShrink: 1,
  },
  leadAction: {
    marginLeft: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: COLORS.text,
    borderColor: COLORS.text,
  },
  fabContainer: {
    position: 'absolute',
    bottom: 100, // Above tab bar
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  fab: {
    backgroundColor: COLORS.primary,
    borderRadius: 30,
    paddingVertical: 12,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  fabText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.primaryForeground,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalContent: {
    width: Dimensions.get('window').width * 0.9,
    backgroundColor: COLORS.card,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 20,
  },
  modalButtonSecondary: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalButtonTextSecondary: {
    color: COLORS.text,
    fontWeight: '600',
  },
  modalButtonPrimary: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
  },
  modalButtonTextPrimary: {
    color: '#000',
    fontWeight: '600',
  },
});
