import { useEffect, useState } from "react";
import { supabase, User } from "@/app/lib/supabase";
import type { AuthError } from "@supabase/supabase-js";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const signOut = async () => {
    setError(null);
    const { error } = await supabase.auth.signOut();

    if (error) {
      setError(error.message);
      console.error("Sign out error:", error);
    }
  };

  // 游客模式（无需登录）
  const continueAsGuest = () => {
    // 不设置用户，保持 null，但标记为已选择游客模式
    setLoading(false);
  };

  return {
    user,
    loading,
    error,
    signInWithGoogle,
    signInWithGithub,
    signOut,
    continueAsGuest,
  };
}
