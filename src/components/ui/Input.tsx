import { StyleSheet, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../theme/useTheme";

export function Input({
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType,
  autoCapitalize = "none",
  multiline,
  numberOfLines,
  leftIcon,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: "default" | "email-address" | "phone-pad" | "numeric";
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  multiline?: boolean;
  numberOfLines?: number;
  leftIcon?: React.ReactNode | string;
}) {
  const { tokens } = useTheme();

  const styles = StyleSheet.create({
    wrap: {
      borderRadius: tokens.radius.lg,
      borderWidth: 1,
      borderColor: tokens.border,
      backgroundColor: tokens.card,
      paddingHorizontal: 14,
      paddingVertical: 12,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    input: {
      flex: 1,
      color: tokens.accent,
      fontSize: 15,
      minHeight: multiline ? (numberOfLines || 3) * 20 : 20,
      textAlignVertical: multiline ? "top" : "center",
      padding: 0, // Reset padding
    },
  });

  return (
    <View style={styles.wrap}>
      {typeof leftIcon === "string" ? (
        <Ionicons name={leftIcon as any} size={20} color={tokens.mutedForeground} />
      ) : (
        leftIcon
      )}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={tokens.mutedForeground}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        multiline={multiline}
        numberOfLines={numberOfLines}
        style={styles.input}
      />
    </View>
  );
}
