import { StyleSheet, View } from "react-native";
import { useTheme } from "../../theme/useTheme";

export function Card({ children }: { children: React.ReactNode }) {
  const { tokens } = useTheme();

  const styles = StyleSheet.create({
    root: {
      backgroundColor: tokens.card,
      borderRadius: tokens.radius.lg,
      borderWidth: 1,
      borderColor: tokens.border,
      padding: 20,
      ...tokens.shadow.md,
      marginBottom: 16,
    },
  });

  return <View style={styles.root}>{children}</View>;
}
