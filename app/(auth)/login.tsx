import { StyleSheet, Text, View, Image, ViewStyle, TextStyle } from "react-native";
import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";

import { Screen } from "../../src/components/common/Screen";
import { Card } from "../../src/components/ui/Card";
import { Input } from "../../src/components/ui/Input";
import { Button } from "../../src/components/ui/Button";
import { useTheme } from "../../src/theme/useTheme";
import { useAuth } from "../../src/auth/AuthContext";

export default function LoginScreen() {
  const { tokens } = useTheme();
  const { signInWithEmail } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      await signInWithEmail(email, password);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: "center",
        padding: 8
    } as ViewStyle,
    header: {
        marginBottom: 32,
        alignItems: "center"
    } as ViewStyle,
    iconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: tokens.card,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
        borderWidth: 1,
        borderColor: tokens.border,
        ...tokens.shadow.md
    } as ViewStyle,
    title: { 
        color: tokens.accent, 
        fontSize: 28, 
        fontWeight: "900",
        textAlign: 'center',
        marginBottom: 8
    } as TextStyle,
    sub: { 
        color: tokens.mutedForeground, 
        fontSize: 15, 
        textAlign: 'center',
        lineHeight: 22,
        paddingHorizontal: 32
    } as TextStyle,
    form: {
        gap: 16
    } as ViewStyle,
    label: { 
        color: tokens.mutedForeground, 
        fontSize: 13, 
        fontWeight: "700", 
        marginBottom: 8,
        marginLeft: 4
    } as TextStyle,
    error: { 
        color: tokens.destructive, 
        fontSize: 13, 
        fontWeight: "600",
        textAlign: 'center',
        marginTop: 8
    } as TextStyle,
    footer: {
        marginTop: 32,
        alignItems: 'center'
    } as ViewStyle,
    footerText: {
        color: tokens.mutedForeground,
        fontSize: 12,
        textAlign: 'center'
    } as TextStyle
  });

  return (
    <Screen scroll={false}>
      <View style={styles.container}>
        <View style={styles.header}>
            <View style={styles.iconContainer}>
                <Ionicons name="car-sport" size={40} color={tokens.primary} />
            </View>
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.sub}>Sign in to access your sales dashboard and manage inventory.</Text>
        </View>

        <Card>
            <View style={styles.form}>
                <View>
                    <Text style={styles.label}>Email Address</Text>
                    <Input 
                        value={email} 
                        onChangeText={setEmail} 
                        placeholder="name@example.com" 
                        keyboardType="email-address"
                        autoCapitalize="none"
                        leftIcon="mail-outline"
                    />
                </View>
                
                <View>
                    <Text style={styles.label}>Password</Text>
                    <Input 
                        value={password} 
                        onChangeText={setPassword} 
                        placeholder="Enter your password" 
                        secureTextEntry
                        leftIcon="lock-closed-outline"
                    />
                </View>

                {error ? <Text style={styles.error}>{error}</Text> : null}

                <View style={{ marginTop: 8 }}>
                    <Button 
                        disabled={isSubmitting || email.trim().length === 0 || password.length === 0} 
                        onPress={onSubmit}
                    >
                        {isSubmitting ? "Signing in..." : "Sign In"}
                    </Button>
                </View>
            </View>
        </Card>

        <View style={styles.footer}>
            <Text style={styles.footerText}>Automate SA • Dealer Management System</Text>
        </View>
      </View>
    </Screen>
  );
}
