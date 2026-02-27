import { StyleSheet, Text, View, ViewStyle, TextStyle, KeyboardAvoidingView, Platform, TouchableOpacity, ScrollView, Dimensions } from "react-native";
import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Screen } from "../../src/components/common/Screen";
import { Input } from "../../src/components/ui/Input";
import { Button } from "../../src/components/ui/Button";
import { useTheme } from "../../src/theme/useTheme";
import { useAuth } from "../../src/auth/AuthContext";

const { width } = Dimensions.get("window");

export default function LoginScreen() {
  const { tokens } = useTheme();
  const { signInWithEmail } = useAuth();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getLoginErrorMessage = (e: unknown) => {
    const message = e instanceof Error ? e.message : "";
    const lower = message.toLowerCase();

    if (
      lower.includes("auth/invalid-credential") ||
      lower.includes("auth/wrong-password") ||
      lower.includes("auth/user-not-found") ||
      lower.includes("auth/invalid-email") ||
      lower.includes("auth/user-disabled") ||
      lower.includes("invalid login credentials")
    ) {
      return "Incorrect email or password. Please try again.";
    }

    if (lower.includes("network") || lower.includes("timeout")) {
      return "Unable to sign in. Please check your internet connection and try again.";
    }

    return "Unable to sign in. Please try again.";
  };

  const onSubmit = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      await signInWithEmail(email, password);
    } catch (e) {
      setError(getLoginErrorMessage(e));
    } finally {
      setIsSubmitting(false);
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: "#09090b", // Deep black background
    } as ViewStyle,
    scrollContent: {
      flexGrow: 1,
      justifyContent: "center",
      paddingHorizontal: 24,
      paddingBottom: insets.bottom + 20,
      paddingTop: insets.top + 20,
    } as ViewStyle,
    header: {
      alignItems: "center",
      marginBottom: 48,
    } as ViewStyle,
    iconContainer: {
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: "#27272a", // Zinc-800
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 24,
      borderWidth: 2,
      borderColor: "#FACC15", // Yellow accent
      shadowColor: "#FACC15",
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.3,
      shadowRadius: 20,
      elevation: 10,
    } as ViewStyle,
    title: {
      color: "#fff",
      fontSize: 32,
      fontWeight: "900",
      textAlign: "center",
      marginBottom: 12,
      letterSpacing: -0.5,
    } as TextStyle,
    subtitle: {
      color: "#a1a1aa", // Zinc-400
      fontSize: 16,
      textAlign: "center",
      maxWidth: width * 0.8,
      lineHeight: 24,
    } as TextStyle,
    formCard: {
      backgroundColor: "#18181b", // Zinc-900
      borderRadius: 30,
      padding: 24,
      borderWidth: 1,
      borderColor: "#27272a",
      gap: 20,
    } as ViewStyle,
    inputGroup: {
      gap: 8,
    } as ViewStyle,
    label: {
      color: "#e4e4e7", // Zinc-200
      fontSize: 14,
      fontWeight: "600",
      marginLeft: 4,
    } as TextStyle,
    forgotPassword: {
      alignSelf: "flex-end",
      marginTop: -8,
    } as ViewStyle,
    forgotPasswordText: {
      color: "#FACC15", // Yellow
      fontSize: 13,
      fontWeight: "600",
    } as TextStyle,
    errorContainer: {
      backgroundColor: "rgba(239, 68, 68, 0.1)", // Red-500 with opacity
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: "rgba(239, 68, 68, 0.2)",
    } as ViewStyle,
    errorText: {
      color: "#ef4444", // Red-500
      fontSize: 13,
      fontWeight: "500",
      textAlign: "center",
    } as TextStyle,
    footer: {
      marginTop: 48,
      alignItems: "center",
      gap: 8,
    } as ViewStyle,
    footerText: {
      color: "#52525b", // Zinc-600
      fontSize: 13,
      fontWeight: "500",
    } as TextStyle,
    divider: {
        height: 1,
        backgroundColor: "#27272a",
        width: 40,
        marginVertical: 10
    } as ViewStyle
  });

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header Section */}
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Ionicons name="car-sport" size={48} color="#FACC15" />
            </View>
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>
              Sign in to manage your inventory and track sales performance
            </Text>
          </View>

          {/* Form Section */}
          <View style={styles.formCard}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email Address</Text>
              <Input
                value={email}
                onChangeText={setEmail}
                placeholder="name@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                leftIcon="mail"
                // Custom styling for input to match dark theme
                style={{ backgroundColor: "#09090b", borderColor: "#27272a" }}
                inputStyle={{ color: "#fff", fontSize: 16 }}
                placeholderTextColor="#52525b"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <Input
                value={password}
                onChangeText={setPassword}
                placeholder="Enter your password"
                secureTextEntry
                leftIcon="lock-closed"
                style={{ backgroundColor: "#09090b", borderColor: "#27272a" }}
                inputStyle={{ color: "#fff", fontSize: 16 }}
                placeholderTextColor="#52525b"
              />
            </View>

            <TouchableOpacity style={styles.forgotPassword}>
              <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
            </TouchableOpacity>

            {error && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <Button
              onPress={onSubmit}
              disabled={isSubmitting || !email || !password}
              style={{ marginTop: 8, backgroundColor: "#FACC15" }}
              textStyle={{ color: "#000", fontWeight: "800", fontSize: 16 }}
            >
              {isSubmitting ? "Signing in..." : "Sign In"}
            </Button>
          </View>

          {/* Footer Section */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Automate SA</Text>
            <View style={styles.divider} />
            <Text style={[styles.footerText, { fontSize: 11 }]}>
              Dealer Management System v1.0
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
