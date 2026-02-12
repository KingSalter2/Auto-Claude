import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
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

type AuthContextValue = {
  user: User | null;
  userProfile: UserProfile | null;
  isLoading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signOutUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function loadProfileByEmail(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const snap = await getDoc(doc(firebaseDb, "users", normalizedEmail));
  if (!snap.exists()) return null;
  const data = snap.data() as Partial<UserProfile> | undefined;
  return {
    email: normalizedEmail,
    name: typeof data?.name === "string" ? data?.name : null,
    role: typeof data?.role === "string" ? data?.role : null,
    status: (typeof data?.status === "string" ? data.status : null) as UserProfile["status"],
    phoneNumber: typeof data?.phoneNumber === "string" ? data.phoneNumber : null,
    permissions: Array.isArray(data?.permissions) ? (data?.permissions as string[]) : null,
    mobileAccess: typeof data?.mobileAccess === "boolean" ? data.mobileAccess : null,
  } satisfies UserProfile;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(firebaseAuth, async (nextUser) => {
      setUser(nextUser);
      if (!nextUser?.email) {
        setUserProfile(null);
        setIsLoading(false);
        return;
      }

      try {
        const profile = await loadProfileByEmail(nextUser.email);
        const isSuspended = profile?.status === "suspended";
        const mobileDenied = profile?.mobileAccess === false;
        if (isSuspended || mobileDenied) {
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

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      userProfile,
      isLoading,
      signInWithEmail: async (email: string, password: string) => {
        await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
      },
      signOutUser: async () => {
        await signOut(firebaseAuth);
      },
    }),
    [isLoading, user, userProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
