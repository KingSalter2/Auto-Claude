import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../theme/useTheme";

export function Header({
  title,
  subtitle,
  showBack,
  rightAction,
}: {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  rightAction?: React.ReactNode;
}) {
  const { tokens } = useTheme();
  const router = useRouter();

  const styles = StyleSheet.create({
    container: {
      paddingVertical: 12,
      gap: 12,
    },
    topRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    titleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      flex: 1,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: tokens.radius.full,
      backgroundColor: tokens.card,
      borderWidth: 1,
      borderColor: tokens.border,
      alignItems: "center",
      justifyContent: "center",
    },
    title: {
      color: tokens.accent,
      fontSize: 24,
      fontWeight: "800",
      letterSpacing: -0.5,
    },
    subtitle: {
      color: tokens.mutedForeground,
      fontSize: 14,
      lineHeight: 20,
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <View style={styles.titleRow}>
          {showBack && (
            <Pressable onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={20} color={tokens.accent} />
            </Pressable>
          )}
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
        </View>
        {rightAction && <View>{rightAction}</View>}
      </View>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}
