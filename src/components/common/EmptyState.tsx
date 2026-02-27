import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../theme/useTheme";

export function EmptyState({
  title,
  description,
  icon,
}: {
  title: string;
  description?: string;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  const { tokens } = useTheme();
  const styles = StyleSheet.create({
    title: { color: tokens.accent, fontSize: 16, fontWeight: "800", marginTop: icon ? 12 : 0 },
    description: { color: tokens.mutedForeground, fontSize: 13, marginTop: 6, textAlign: 'center' },
    wrap: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: tokens.border,
      backgroundColor: tokens.card,
      padding: 24,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });

  return (
    <View style={styles.wrap}>
      {icon && <Ionicons name={icon} size={48} color={tokens.mutedForeground} />}
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
    </View>
  );
}
