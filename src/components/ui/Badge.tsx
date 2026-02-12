import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "../../theme/useTheme";

type BadgeVariant = "default" | "muted" | "destructive" | "outline";

export function Badge({
  children,
  variant = "muted",
}: {
  children: React.ReactNode;
  variant?: BadgeVariant;
}) {
  const { tokens } = useTheme();

  const styles = StyleSheet.create({
    root: {
      alignSelf: "flex-start",
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor:
        variant === "destructive" 
          ? tokens.destructive 
          : variant === "default" 
            ? tokens.primary 
            : variant === "outline"
              ? "transparent"
              : tokens.muted,
      borderWidth: variant === "outline" ? 1 : 0,
      borderColor: variant === "outline" ? tokens.border : "transparent",
    },
    text: {
      color:
        variant === "destructive"
          ? tokens.destructiveForeground
          : variant === "default"
            ? tokens.primaryForeground
            : variant === "outline"
              ? tokens.mutedForeground
              : tokens.mutedForeground,
      fontSize: 12,
      fontWeight: "700",
    },
  });

  return (
    <View style={styles.root}>
      <Text style={styles.text}>{children}</Text>
    </View>
  );
}
