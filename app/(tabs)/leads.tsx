import { Pressable, StyleSheet, Text, View, FlatList, RefreshControl, StatusBar, Dimensions, Modal } from "react-native";
import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Calendar } from "react-native-calendars";

import { useTheme } from "../../src/theme/useTheme";
import { subscribeRecentLeads } from "../../src/services/leadService";
import type { LeadStatus, LeadSubmission } from "../../src/models/lead";
import { timeAgo } from "../../src/utils/format";
import { useAuth } from "../../src/auth/AuthContext";
import { EmptyState } from "../../src/components/common/EmptyState";
import { Badge } from "../../src/components/ui/Badge";

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

export default function LeadsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { canAccess } = useAuth();
  const insets = useSafeAreaInsets();
  const canSeeLeads = canAccess("Leads & CRM");

  const [leads, setLeads] = useState<LeadSubmission[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [filterStatus, setFilterStatus] = useState<LeadStatus | "all">("all");
  
  // Date Filtering State
  const [isCalendarVisible, setIsCalendarVisible] = useState(false);
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);

  useEffect(() => {
    if (params.status && typeof params.status === 'string') {
      setFilterStatus(params.status as LeadStatus | "all");
    } else {
      setFilterStatus("all");
    }
  }, [params.status]);

  useEffect(() => {
    if (!canSeeLeads) {
      setLeads([]);
      return;
    }
    const unsub = subscribeRecentLeads({ onNext: setLeads, take: 200 });
    return () => unsub();
  }, [canSeeLeads]);

  const filteredLeads = useMemo(() => {
    let result = leads;
    
    // Status Filter
    if (filterStatus !== "all") {
      result = result.filter((l) => l.status === filterStatus);
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
  }, [leads, filterStatus, startDate, endDate]);

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
    const total = leads.length;
    const contacted = leads.filter(l => l.status === 'contacted' || l.status === 'reviewed').length;
    const newLeads = leads.filter(l => l.status === 'new').length;
    const score = total > 0 ? Math.round((contacted / total) * 100) : 0;
    return { total, contacted, newLeads, score };
  }, [leads]);

  const renderItem = ({ item }: { item: LeadSubmission }) => (
    <Pressable 
      style={styles.leadCard} 
      onPress={() => router.push(`/leads/${item.id}`)}
    >
        <View style={styles.leadIconContainer}>
            <Ionicons name="person" size={20} color={COLORS.text} />
        </View>
        
        <View style={styles.leadContent}>
            <Text style={styles.leadTitle}>{item.customer?.name || "Unknown"}</Text>
            <Text style={styles.leadSubtitle}>
                {item.vehicle?.name || "General Enquiry"}
            </Text>
            <View style={styles.leadMetaRow}>
                <Ionicons name="time-outline" size={12} color={COLORS.danger} />
                <Text style={styles.leadMetaText}>{timeAgo(item.createdAt)}</Text>
            </View>
        </View>

        <View style={styles.leadAction}>
            {item.status === 'new' && (
                <View style={styles.checkbox} />
            )}
        </View>
    </Pressable>
  );

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
        <Text style={styles.headerTitle}>Leads</Text>
        <Pressable style={styles.calendarButton} onPress={() => setIsCalendarVisible(true)}>
            <Ionicons name={startDate ? "calendar" : "calendar-outline"} size={24} color={startDate ? COLORS.primary : COLORS.text} />
        </Pressable>
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

      <FlatList
        data={filteredLeads}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
            <>
                {/* Score Section */}
                <View style={styles.scoreSection}>
                    <View style={styles.scoreCircleOuter}>
                        <View style={styles.scoreCircleInner}>
                            <Ionicons name="people" size={32} color="#a855f7" /> 
                        </View>
                        {/* Progress Ring Simulation (Static for now) */}
                        <View style={[styles.progressRing, { borderTopColor: '#a855f7', borderRightColor: '#a855f7' }]} />
                    </View>
                    <Text style={styles.scoreTitle}>Total Active Leads</Text>
                    <Text style={styles.scoreSubtitle}>{stats.total} leads in pipeline</Text>
                </View>

                {/* Filter Indicator */}
                {(filterStatus !== "all" || startDate) && (
                    <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 20, gap: 8, flexWrap: 'wrap' }}>
                        {filterStatus !== "all" && (
                            <Pressable onPress={() => { router.setParams({ status: 'all' }); setFilterStatus('all'); }}>
                                <Badge variant="default" style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
                                    <Text style={{ color: '#000', fontWeight: 'bold' }}>
                                        Status: {filterStatus.toUpperCase()} <Ionicons name="close-circle" size={14} />
                                    </Text>
                                </Badge>
                            </Pressable>
                        )}
                        {startDate && (
                            <Pressable onPress={clearDateFilter}>
                                <Badge variant="default" style={{ paddingHorizontal: 16, paddingVertical: 8, backgroundColor: COLORS.primary }}>
                                    <Text style={{ color: '#000', fontWeight: 'bold' }}>
                                        {startDate} {endDate ? ` - ${endDate}` : ''} <Ionicons name="close-circle" size={14} />
                                    </Text>
                                </Badge>
                            </Pressable>
                        )}
                    </View>
                )}

                {/* Notification Card */}
                <View style={styles.notificationCard}>
                    <View style={styles.notificationContent}>
                        <Text style={styles.notificationTitle}>Action Required</Text>
                        <Text style={styles.notificationText}>
                            You have {stats.newLeads} new leads waiting for response.
                        </Text>
                    </View>
                    <View style={styles.notificationIcon}>
                        <Ionicons name="notifications" size={24} color={COLORS.card} />
                    </View>
                </View>

                {/* List Header */}
                <View style={styles.sectionHeader}>
                    <Ionicons name="sunny-outline" size={20} color={COLORS.primary} />
                    <Text style={styles.sectionHeaderText}>New Enquiries</Text>
                </View>
            </>
        }
        ListFooterComponent={<View style={{ height: 100 }} />} // Space for bottom button + nav
      />

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
