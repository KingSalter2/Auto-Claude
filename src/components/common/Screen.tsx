import { SafeAreaView, ScrollView, StyleSheet, View } from "react-native";
import { useTheme } from "../../theme/useTheme";

export function Screen({
  children,
  scroll = true,
}: {
  children: React.ReactNode;
  scroll?: boolean;
}) {
  const { tokens } = useTheme();
  const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: tokens.background },
    content: { flex: 1, padding: 16, gap: 14 },
    scrollContent: { padding: 16, gap: 14 },
  });

  if (!scroll) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.content}>{children}</View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.scrollContent}>{children}</ScrollView>
    </SafeAreaView>
  );
}
