import { StyleSheet, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../theme/useTheme";
import type { KeyboardTypeOptions } from "react-native";

function isIoniconName(value: unknown): value is keyof typeof Ionicons.glyphMap {
  return typeof value === "string" && value in Ionicons.glyphMap;
}

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
  style,
  inputStyle,
  placeholderTextColor,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  multiline?: boolean;
  numberOfLines?: number;
  leftIcon?: React.ReactNode | keyof typeof Ionicons.glyphMap;
  style?: import("react-native").ViewStyle;
  inputStyle?: import("react-native").TextStyle;
  placeholderTextColor?: string;
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
    <View style={[styles.wrap, style]}>
      {isIoniconName(leftIcon) ? (
        <Ionicons name={leftIcon} size={20} color={tokens.mutedForeground} />
      ) : (
        leftIcon
      )}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={placeholderTextColor || tokens.mutedForeground}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        multiline={multiline}
        numberOfLines={numberOfLines}
        style={[styles.input, inputStyle]}
      />
    </View>
  );
}
