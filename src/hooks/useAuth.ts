"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

const HAS_SUPABASE = !!(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

/** Profile shape for display name; optional fields for when API supports them. */
export interface ProfileForDisplay {
  display_name?: string;
  full_name?: string;
  [key: string]: unknown;
}

export interface UseAuthResult {
  user: User | null;
  session: unknown;
  profile: ProfileForDisplay | null;
  isLoggedIn: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
  refetchProfile: () => Promise<void>;
}

function getDisplayName(
  profile: ProfileForDisplay | null,
  user: User | null
): string {
  if (profile?.display_name?.trim()) return profile.display_name.trim();
  if (profile?.full_name?.trim()) return profile.full_name!.trim();
  if (user?.email) return user.email;
  return "User";
}

export function getDisplayNameFromAuth(
  profile: ProfileForDisplay | null,
  user: User | null
): string {
  return getDisplayName(profile, user);
}

export function useAuth(): UseAuthResult {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<unknown>(null);
  const [profile, setProfile] = useState<ProfileForDisplay | null>(null);
  const [loading, setLoading] = useState(true);

  const refetchProfile = useCallback(async () => {
    if (!HAS_SUPABASE || !user) {
      setProfile(null);
      return;
    }
    try {
      const res = await fetch("/api/profile");
      if (res.ok) {
        const data = await res.json();
        setProfile((data.profile ?? null) as ProfileForDisplay | null);
      } else {
        setProfile(null);
      }
    } catch {
      setProfile(null);
    }
  }, [user]);

  useEffect(() => {
    if (!HAS_SUPABASE) {
      setLoading(false);
      return;
    }

    const supabase = createClient();

    function updateFromSession(sess: { user: User } | null) {
      const u = sess?.user ?? null;
      setSession(sess);
      setUser(u);
      if (!u) setProfile(null);
    }

    supabase.auth.getSession().then(({ data: { session: sess } }) => {
      updateFromSession(sess);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, sess) => {
      updateFromSession(sess ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    refetchProfile();
  }, [user, refetchProfile]);

  const signOut = useCallback(async () => {
    if (!HAS_SUPABASE) return;
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
  }, []);

  const isLoggedIn = !!user;

  // Debug: log auth state when settled (development only; remove if too noisy)
  useEffect(() => {
    if (process.env.NODE_ENV !== "development" || loading) return;
    console.log("[useAuth]", {
      session: session ? "present" : null,
      authUser: user ? { id: user.id, email: user.email } : null,
      profile: profile ?? null,
      isLoggedIn,
    });
  }, [loading, session, user, profile, isLoggedIn]);

  return {
    user,
    session,
    profile,
    isLoggedIn,
    loading,
    signOut,
    refetchProfile,
  };
}
