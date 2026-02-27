import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../theme/useTheme";

type ButtonVariant = "primary" | "outline" | "ghost" | "destructive";

function isIoniconName(value: unknown): value is keyof typeof Ionicons.glyphMap {
  return typeof value === "string" && value in Ionicons.glyphMap;
}

export function Button({
  children,
  onPress,
  disabled,
  variant = "primary",
  size = "md",
  icon,
  style,
  textStyle,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg";
  icon?: React.ReactNode | keyof typeof Ionicons.glyphMap;
  style?: React.ComponentProps<typeof View>["style"];
  textStyle?: React.ComponentProps<typeof Text>["style"];
}) {
  const { tokens } = useTheme();

  const styles = StyleSheet.create({
    root: {
      borderRadius: tokens.radius.full,
      paddingHorizontal: size === "sm" ? 12 : size === "md" ? 20 : 24,
      paddingVertical: size === "sm" ? 8 : size === "md" ? 14 : 16,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 8,
      backgroundColor:
        variant === "primary"
          ? tokens.primary
          : variant === "destructive"
          ? tokens.destructive
          : variant === "outline"
          ? "transparent"
          : "transparent",
      borderWidth: variant === "outline" ? 1 : 0,
      borderColor: variant === "outline" ? tokens.border : "transparent",
      opacity: disabled ? 0.6 : 1,
      ...((variant === "primary" || variant === "destructive") && !disabled
        ? tokens.shadow.md
        : {}),
    },
    text: {
      color:
        variant === "primary"
          ? tokens.primaryForeground
          : variant === "destructive"
          ? tokens.destructiveForeground
          : tokens.accent,
      fontSize: size === "sm" ? 13 : size === "md" ? 16 : 18,
      fontWeight: "700",
    },
  });

  return (
    <Pressable disabled={disabled} onPress={onPress}>
      {({ pressed }) => (
        <View style={[styles.root, { opacity: pressed ? 0.8 : disabled ? 0.6 : 1 }, style]}>
          {isIoniconName(icon) ? (
            <Ionicons 
              name={icon} 
              size={size === "sm" ? 16 : 20} 
              color={
                variant === "primary" 
                  ? tokens.primaryForeground 
                  : variant === "destructive" 
                  ? tokens.destructiveForeground 
                  : tokens.accent
              } 
            />
          ) : (
            icon
          )}
          <Text style={[styles.text, textStyle]}>{children}</Text>
        </View>
      )}
    </Pressable>
  );
}
