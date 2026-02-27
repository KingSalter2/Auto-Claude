import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { addDoc, collection, doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { firebaseAuth, firebaseDb } from "../lib/firebase";

export type UserProfile = {
  email: string;
  name?: string | null;
  role?: string | null;
  status?: "invited" | "active" | "suspended" | null;
  phoneNumber?: string | null;
  permissions?: string[] | null;
  mobileAccess?: boolean | null;
};

export type PushRegistrationStatus = {
  state: "unknown" | "registering" | "registered" | "blocked" | "error";
  detail?: string | null;
  updatedAt?: number | null;
};

const SUPER_ADMIN_EMAILS = ["polilesam@gmail.com"];
const DEFAULT_ADMIN_PERMISSIONS = [
  "Overview",
  "Analytics",
  "Communication",
  "Assignments",
  "Leads & CRM",
  "Inventory",
  "Sales Records",
  "Calendar",
  "System Logs",
  "Settings",
];

type AuthContextValue = {
  user: User | null;
  userProfile: UserProfile | null;
  isLoading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signOutUser: () => Promise<void>;
  registerForPush: () => Promise<void>;
  canAccess: (permissionLabel: string) => boolean;
  pushStatus: PushRegistrationStatus;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const DEVICE_ID_STORAGE_KEY = "automate.deviceId";
const NO_MOBILE_ACCESS_MESSAGE = "You do not have access to the mobile app. Please contact your administrator.";

async function loadProfileByEmail(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const snap = await getDoc(doc(firebaseDb, "users", normalizedEmail));
  if (!snap.exists()) {
    if (!SUPER_ADMIN_EMAILS.includes(normalizedEmail)) return null;

    const fallback: UserProfile = {
      email: normalizedEmail,
      name: null,
      role: "Admin",
      status: "active",
      phoneNumber: null,
      permissions: DEFAULT_ADMIN_PERMISSIONS,
      mobileAccess: true,
    };

    try {
      await setDoc(
        doc(firebaseDb, "users", normalizedEmail),
        {
          email: normalizedEmail,
          name: null,
          role: "Admin",
          status: "active",
          phoneNumber: null,
          permissions: DEFAULT_ADMIN_PERMISSIONS,
          mobileAccess: true,
          activatedAt: serverTimestamp(),
          lastLoginAt: serverTimestamp(),
        },
        { merge: true },
      );
    } catch {
      void 0;
    }

    return fallback;
  }
  const data = snap.data() as Partial<UserProfile> | undefined;
  const rawPermissions = Array.isArray(data?.permissions) ? data?.permissions : null;
  const permissions =
    rawPermissions?.filter((x) => typeof x === "string").map((p) => p.trim()).filter((p) => p.length > 0) ?? null;
  return {
    email: normalizedEmail,
    name: typeof data?.name === "string" ? data?.name : null,
    role: typeof data?.role === "string" ? data?.role : null,
    status: (typeof data?.status === "string" ? data.status : null) as UserProfile["status"],
    phoneNumber: typeof data?.phoneNumber === "string" ? data.phoneNumber : null,
    permissions,
    mobileAccess: typeof data?.mobileAccess === "boolean" ? data.mobileAccess : null,
  } satisfies UserProfile;
}

async function getOrCreateDeviceId() {
  const existing = await AsyncStorage.getItem(DEVICE_ID_STORAGE_KEY);
  if (existing && existing.trim().length > 0) return existing;
  const next = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  await AsyncStorage.setItem(DEVICE_ID_STORAGE_KEY, next);
  return next;
}

type PushRegistrationResult =
  | { ok: true; deviceId: string; docId: string }
  | { ok: false; kind: "blocked" | "error"; message: string };

async function registerPushToken(user: User, profile: UserProfile, prompt: boolean): Promise<PushRegistrationResult> {
  if (!user.email) return { ok: false, kind: "blocked", message: "Signed out." };
  if (profile.mobileAccess === false) return { ok: false, kind: "blocked", message: "Mobile access disabled for this account." };
  if (!Device.isDevice) return { ok: false, kind: "blocked", message: "Push requires a physical device." };

  const perms = await Notifications.getPermissionsAsync();
  let status = perms.status;
  if (status !== "granted" && prompt) {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }
  if (status !== "granted") return { ok: false, kind: "blocked", message: "Notification permission not granted." };

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as unknown as { easConfig?: { projectId?: string } }).easConfig?.projectId ??
    undefined;

  let token: string | null = null;
  try {
    const tokenResponse = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    token = tokenResponse?.data ?? null;
  } catch (e) {
    const base = e instanceof Error ? e.message : "Could not obtain a push token.";
    const hint = projectId ? "" : " Missing EAS projectId in app config.";
    return { ok: false, kind: "error", message: `${base}${hint}`.trim() };
  }

  if (!token) return { ok: false, kind: "error", message: "Could not obtain a push token." };

  const email = user.email.trim().toLowerCase();
  const deviceId = await getOrCreateDeviceId();
  const docId = `${user.uid}__${deviceId}`;

  try {
    await setDoc(
      doc(firebaseDb, "user_devices", docId),
      {
        email,
        uid: user.uid,
        deviceId,
        platform: Platform.OS,
        expoPushToken: token,
        permissions: Array.isArray(profile.permissions) ? profile.permissions : null,
        mobileAccess: true,
        status: profile.status ?? null,
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      },
      { merge: true },
    );
    return { ok: true, deviceId, docId };
  } catch (e) {
    return { ok: false, kind: "error", message: e instanceof Error ? e.message : "Failed to register device." };
  }
}

async function createAppLog(input: {
  level: "info" | "warn" | "error";
  message: string;
  actorEmail: string;
  actorUid?: string | null;
  actorName?: string | null;
  actorRole?: string | null;
  platform?: string | null;
  deviceInfo?: string | null;
  route?: string | null;
}) {
  try {
    const deviceId = await getOrCreateDeviceId();
    const modelName = typeof Device.modelName === "string" ? Device.modelName : null;
    const osName = typeof Device.osName === "string" ? Device.osName : null;
    const osVersion = typeof Device.osVersion === "string" ? Device.osVersion : null;
    const appVersion = Constants.expoConfig?.version ?? null;

    await addDoc(collection(firebaseDb, "app_logs"), {
      timestamp: serverTimestamp(),
      level: input.level,
      source: "mobile",
      actorEmail: input.actorEmail,
      actorUid: input.actorUid ?? null,
      actorName: input.actorName ?? null,
      actorRole: input.actorRole ?? null,
      platform: input.platform ?? Platform.OS,
      deviceId,
      deviceInfo: input.deviceInfo ?? [modelName, osName ? `${osName}${osVersion ? ` ${osVersion}` : ""}` : null].filter(Boolean).join(" / "),
      appVersion,
      route: input.route ?? null,
      message: input.message,
    });
  } catch (e) {
    if (__DEV__) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      console.warn(`Failed to write app log: ${msg}`);
    }
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pushStatus, setPushStatus] = useState<PushRegistrationStatus>({ state: "unknown", detail: null, updatedAt: null });

  const permissions = useMemo(() => {
    return Array.isArray(userProfile?.permissions) ? userProfile.permissions.filter(Boolean) : [];
  }, [userProfile?.permissions]);

  const canAccess = useCallback(
    (permissionLabel: string) => {
      if (permissionLabel === "Overview") return true;
      if (userProfile?.role === "Admin" && permissions.length === 0) return true;
      return permissions.includes(permissionLabel);
    },
    [permissions, userProfile?.role],
  );

  const ensurePushRegistration = useCallback(
    async ({ prompt }: { prompt: boolean }) => {
      const currentUser = user;
      const profile = userProfile;
      const now = Date.now();

      if (!currentUser?.email || !profile) {
        setPushStatus({ state: "unknown", detail: null, updatedAt: now });
        return;
      }

      setPushStatus({ state: "registering", detail: "Registering…", updatedAt: now });
      const result = await registerPushToken(currentUser, profile, prompt);
      if (result.ok) {
        setPushStatus({ state: "registered", detail: `Device registered (${result.deviceId}).`, updatedAt: Date.now() });
        return;
      }
      if (result.kind === "blocked") {
        setPushStatus({ state: "blocked", detail: result.message, updatedAt: Date.now() });
        return;
      }
      setPushStatus({ state: "error", detail: result.message, updatedAt: Date.now() });
    },
    [user, userProfile],
  );

  useEffect(() => {
    return onAuthStateChanged(firebaseAuth, async (nextUser) => {
      setIsLoading(true);
      setUser(nextUser);
      if (!nextUser?.email) {
        setUserProfile(null);
        setIsLoading(false);
        setPushStatus({ state: "unknown", detail: null, updatedAt: Date.now() });
        return;
      }

      try {
        const profile = await loadProfileByEmail(nextUser.email);
        const isSuspended = profile?.status === "suspended";
        const mobileDenied = profile?.mobileAccess === false;
        if (!profile || isSuspended || mobileDenied) {
          setUser(null);
          await signOut(firebaseAuth);
          setUserProfile(null);
        } else {
          setUserProfile(profile);
        }
      } catch {
        setUserProfile(null);
      } finally {
        setIsLoading(false);
      }
    });
  }, []);

  useEffect(() => {
    ensurePushRegistration({ prompt: false });
  }, [ensurePushRegistration]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      userProfile,
      isLoading,
      signInWithEmail: async (email: string, password: string) => {
        const actorEmail = email.trim().toLowerCase();
        try {
          const cred = await signInWithEmailAndPassword(firebaseAuth, actorEmail, password);
          let profile: UserProfile | null = null;
          try {
            profile = await loadProfileByEmail(actorEmail);
          } catch {
            profile = null;
          }

          const isSuspended = profile?.status === "suspended";
          const mobileDenied = profile?.mobileAccess === false;
          if (!profile || isSuspended || mobileDenied) {
            await createAppLog({
              level: "warn",
              message: "Sign-in failed: Mobile access is disabled for this account.",
              actorEmail,
              actorUid: cred.user.uid,
              actorName: profile?.name ?? null,
              actorRole: profile?.role ?? null,
            });
            await signOut(firebaseAuth);
            const err = new Error(NO_MOBILE_ACCESS_MESSAGE);
            err.name = "MobileAccessDeniedError";
            throw err;
          }

          await createAppLog({
            level: "info",
            message: "Signed in",
            actorEmail,
            actorUid: cred.user.uid,
            actorName: profile?.name ?? null,
            actorRole: profile?.role ?? null,
          });
        } catch (e) {
          if (e instanceof Error && e.name === "MobileAccessDeniedError") {
            throw e;
          }
          const msg = e instanceof Error ? e.message : "Unknown sign-in error";
          await createAppLog({
            level: "error",
            message: `Sign-in failed: ${msg}`,
            actorEmail,
            actorUid: null,
            actorName: null,
            actorRole: null,
          });
          throw e;
        }
      },
      signOutUser: async () => {
        const actorEmail = user?.email?.trim().toLowerCase() ?? "unknown";
        const actorUid = user?.uid ?? null;
        await createAppLog({
          level: "info",
          message: "Signed out",
          actorEmail,
          actorUid,
          actorName: userProfile?.name ?? null,
          actorRole: userProfile?.role ?? null,
        });
        await signOut(firebaseAuth);
      },
      registerForPush: async () => {
        await ensurePushRegistration({ prompt: true });
      },
      canAccess,
      pushStatus,
    }),
    [canAccess, ensurePushRegistration, isLoading, pushStatus, user, userProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
