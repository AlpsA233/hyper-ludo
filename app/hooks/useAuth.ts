import { useEffect, useState, useCallback } from "react";
import { supabase, User } from "@/app/lib/supabase";
import type { AuthError } from "@supabase/supabase-js";

// Guest ID 常量
const GUEST_ID_KEY = "hyper_ludo_guest_id";

function getOrCreateGuestId(): string {
  if (typeof window === "undefined") return "";
  
  let guestId = localStorage.getItem(GUEST_ID_KEY);
  if (!guestId) {
    guestId = "guest_" + crypto.randomUUID();
    localStorage.setItem(GUEST_ID_KEY, guestId);
  }
  return guestId;
}

// Guest 用户对象（用于本地测试）
function createGuestUser(guestId: string): User {
  return {
    id: guestId,
    email: undefined,
    user_metadata: {
      full_name: "Guest",
      name: "Guest",
      avatar_url: undefined,
    },
  };
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isGuest, setIsGuest] = useState(false);

  useEffect(() => {
    // 检查当前session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user as User | null);
      setLoading(false);
    });

    // 监听认证状态变化
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user as User | null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}`,
      },
    });

    if (error) {
      setError(error.message);
      console.error("Google sign in error:", error);
    }
  };

  const signInWithGithub = async () => {
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "github",
      options: {
        redirectTo: `${window.location.origin}`,
      },
    });

    if (error) {
      setError(error.message);
      console.error("GitHub sign in error:", error);
    }
  };

  // 游客模式（无需登录）- 本地开发时使用
  const continueAsGuest = useCallback(() => {
    const guestId = getOrCreateGuestId();
    const guestUser = createGuestUser(guestId);
    setUser(guestUser);
    setIsGuest(true);
    setLoading(false);
    console.log("[Auth] Guest mode enabled:", guestId);
  }, []);

  const signOut = async () => {
    setError(null);
    
    // Guest 登出只需要清除本地状态
    if (isGuest) {
      localStorage.removeItem(GUEST_ID_KEY);
      setUser(null);
      setIsGuest(false);
      return;
    }
    
    const { error } = await supabase.auth.signOut();
    if (error) {
      setError(error.message);
      console.error("Sign out error:", error);
    }
  };

  return {
    user,
    loading,
    error,
    isGuest,
    signInWithGoogle,
    signInWithGithub,
    signOut,
    continueAsGuest,
  };
}
