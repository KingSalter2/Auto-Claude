import { Linking, Pressable, StyleSheet, Text, View, ScrollView, Alert, ActivityIndicator } from "react-native";
import { useEffect, useMemo, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { Screen } from "../../src/components/common/Screen";
import { Header } from "../../src/components/common/Header";
import { Card } from "../../src/components/ui/Card";
import { Badge } from "../../src/components/ui/Badge";
import { Button } from "../../src/components/ui/Button";
import { useTheme } from "../../src/theme/useTheme";
import type { LeadStatus, LeadSubmission } from "../../src/models/lead";
import { getLead, updateLeadStatus } from "../../src/services/leadService";
import { timeAgo } from "../../src/utils/format";

const STATUS_CHOICES: Array<{ label: string; value: LeadStatus; icon: string }> = [
  { label: "New", value: "new", icon: "flash" },
  { label: "Reviewed", value: "reviewed", icon: "eye" },
  { label: "Contacted", value: "contacted", icon: "call" },
  { label: "Archived", value: "archived", icon: "archive" },
];

function digitsOnly(v: string) {
  return v.replace(/[^0-9]/g, "");
}

export default function LeadDetailsScreen() {
  const { tokens } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = params.id;

  const [lead, setLead] = useState<LeadSubmission | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    let cancelled = false;
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
  }, [id]);

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
      
      const actions = [];
      if (phone) {
          actions.push({
              label: "Call",
              icon: "call-outline",
              onPress: () => Linking.openURL(`tel:${digitsOnly(phone)}`)
          });
          actions.push({
              label: "SMS",
              icon: "chatbubble-outline",
              onPress: () => Linking.openURL(`sms:${digitsOnly(phone)}`)
          });
          actions.push({
              label: "WhatsApp",
              icon: "logo-whatsapp",
              onPress: () => Linking.openURL(`https://wa.me/${digitsOnly(phone)}`)
          });
      }
      if (email) {
          actions.push({
              label: "Email",
              icon: "mail-outline",
              onPress: () => Linking.openURL(`mailto:${email}`)
          });
      }
      return actions;
  }, [lead]);

  const styles = StyleSheet.create({
    sectionTitle: {
        color: tokens.mutedForeground,
        fontSize: 13,
        fontWeight: "700",
        textTransform: "uppercase",
        letterSpacing: 1,
        marginBottom: 8,
        marginHorizontal: 4
    },
    section: {
        marginTop: 16
    },
    cardContent: {
        gap: 12
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 4
    },
    label: {
        color: tokens.mutedForeground,
        fontSize: 14,
        fontWeight: "600"
    },
    value: {
        color: tokens.accent,
        fontSize: 14,
        fontWeight: "700",
        textAlign: 'right',
        flex: 1,
        marginLeft: 16
    },
    quickActionsBar: {
        flexDirection: 'row',
        backgroundColor: tokens.card,
        padding: 12,
        borderRadius: tokens.radius.md,
        borderWidth: 1,
        borderColor: tokens.border,
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16
    },
    actionItem: {
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        padding: 8,
        minWidth: 70
    },
    actionText: {
        color: tokens.accent,
        fontSize: 11,
        fontWeight: "600",
        marginTop: 2
    },
    statusGrid: {
        flexDirection: 'row',
        backgroundColor: tokens.card,
        borderRadius: tokens.radius.full,
        padding: 4,
        borderWidth: 1,
        borderColor: tokens.border,
    },
    statusOption: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: tokens.radius.full,
    },
    statusOptionActive: {
        backgroundColor: tokens.primary,
    },
    statusText: {
        fontSize: 12,
        fontWeight: "700",
        color: tokens.mutedForeground,
    },
    statusTextActive: {
        color: tokens.background,
    },
    messageBox: {
        backgroundColor: tokens.muted,
        padding: 16,
        borderRadius: tokens.radius.md,
        borderWidth: 1,
        borderColor: tokens.border
    },
    messageText: {
        color: tokens.accent,
        fontSize: 14,
        lineHeight: 22
    }
  });

  if (isLoading) {
    return (
      <Screen>
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <ActivityIndicator size="large" color={tokens.primary} />
          </View>
      </Screen>
    );
  }

  if (error || !lead) {
      return (
          <Screen scroll={false}>
              <Header title="Error" />
              <View style={{ padding: 20 }}>
                  <Text style={{ color: tokens.destructive }}>{error || "Lead not found"}</Text>
                  <Button variant="outline" onPress={() => router.back()} style={{ marginTop: 20 }}>Go Back</Button>
              </View>
          </Screen>
      );
  }

  return (
    <Screen scroll={false}>
      <Header title="Lead Details" subtitle={`Received ${timeAgo(lead.createdAt)}`} showBack />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        
        {/* Quick Actions Bar */}
        {contactActions.length > 0 && (
            <View style={styles.quickActionsBar}>
                {contactActions.map((action, idx) => (
                    <Pressable key={idx} style={styles.actionItem} onPress={action.onPress}>
                        <View style={{ 
                            width: 44, 
                            height: 44, 
                            borderRadius: 22, 
                            backgroundColor: tokens.background, 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            borderWidth: 1,
                            borderColor: tokens.border
                        }}>
                            <Ionicons name={action.icon as any} size={22} color={tokens.primary} />
                        </View>
                        <Text style={styles.actionText}>{action.label}</Text>
                    </Pressable>
                ))}
            </View>
        )}

        {/* Workflow Status */}
        <View>
            <Text style={styles.sectionTitle}>Workflow Status</Text>
            <View style={styles.statusGrid}>
                {STATUS_CHOICES.map((s) => {
                    const isActive = lead.status === s.value;
                    return (
                        <Pressable 
                            key={s.value} 
                            style={[styles.statusOption, isActive && styles.statusOptionActive]}
                            onPress={() => handleStatusChange(s.value)}
                            disabled={isUpdating}
                        >
                            <Text style={[styles.statusText, isActive && styles.statusTextActive]}>{s.label}</Text>
                        </Pressable>
                    );
                })}
            </View>
        </View>

        {/* Customer Info */}
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>Customer Information</Text>
            <Card>
                <View style={styles.cardContent}>
                    <View style={styles.row}>
                        <Text style={styles.label}>Name</Text>
                        <Text style={styles.value}>{lead.customer?.name || "N/A"}</Text>
                    </View>
                    <View style={styles.row}>
                        <Text style={styles.label}>Email</Text>
                        <Text style={styles.value}>{lead.customer?.email || "N/A"}</Text>
                    </View>
                    <View style={styles.row}>
                        <Text style={styles.label}>Phone</Text>
                        <Text style={styles.value}>{lead.customer?.phone || "N/A"}</Text>
                    </View>
                    <View style={styles.row}>
                        <Text style={styles.label}>Source</Text>
                        <Text style={styles.value}>{lead.source || "Website"}</Text>
                    </View>
                </View>
            </Card>
        </View>

        {/* Vehicle Interest */}
        {lead.vehicle && (
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Vehicle Interest</Text>
                <Card>
                    <View style={styles.cardContent}>
                        <View style={styles.row}>
                            <Text style={styles.label}>Vehicle</Text>
                            <Text style={[styles.value, { color: tokens.primary }]}>{lead.vehicle.name}</Text>
                        </View>
                        {lead.vehicle.stockNumber && (
                            <View style={styles.row}>
                                <Text style={styles.label}>Stock #</Text>
                                <Text style={styles.value}>{lead.vehicle.stockNumber}</Text>
                            </View>
                        )}
                        <View style={styles.row}>
                            <Text style={styles.label}>Enquiry Type</Text>
                            <Badge variant="outline">{lead.type.replace('_', ' ').toUpperCase()}</Badge>
                        </View>
                    </View>
                </Card>
            </View>
        )}

        {/* Message / Payload */}
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>Enquiry Details</Text>
            <View style={styles.messageBox}>
                <Text style={styles.messageText}>
                    {typeof lead.payload?.message === 'string' 
                        ? lead.payload.message 
                        : JSON.stringify(lead.payload, null, 2)}
                </Text>
            </View>
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>
    </Screen>
  );
}
