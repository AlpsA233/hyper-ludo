"use client";

import React from "react";
import { LogIn, Github } from "lucide-react";
import type { Translations } from "@/app/locales";

interface AuthScreenProps {
  onGoogleSignIn: () => void;
  onGithubSignIn: () => void;
  onContinueAsGuest: () => void;
  error: string | null;
  t: Translations;
}

export default function AuthScreen({
  onGoogleSignIn,
  onGithubSignIn,
  onContinueAsGuest,
  error,
  t,
}: AuthScreenProps) {
  return (
    <div className="w-full min-h-screen overflow-y-auto flex justify-center py-24 pb-12 px-4">
      <div className="w-full max-w-md space-y-6 animate-fade-in">
        {/* Logo & Title */}
        <div className="text-center space-y-3">
          <h1 className="text-4xl sm:text-5xl font-black italic bg-clip-text text-transparent bg-linear-to-r from-cyan-400 to-purple-500 uppercase tracking-wider">
            Hyper Ludo
          </h1>
          <p className="text-gray-400 text-base sm:text-lg">{t.auth.welcome}</p>
        </div>

        {/* Auth Card */}
        <div className="glass-panel rounded-3xl p-6 sm:p-8 space-y-4 sm:space-y-6">
          <h2 className="text-xl sm:text-2xl font-bold text-white text-center">
            {t.auth.signIn}
          </h2>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm text-center">
              {error}
            </div>
          )}

          <div className="space-y-3">
            {/* Google Sign In */}
            <button
              onClick={onGoogleSignIn}
              className="w-full py-3 sm:py-4 px-4 sm:px-6 bg-white hover:bg-gray-100 text-gray-900 rounded-xl font-semibold flex items-center justify-center gap-2 sm:gap-3 transition-all active:scale-95 text-sm sm:text-base">
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              {t.auth.signInWithGoogle}
            </button>

            {/* GitHub Sign In */}
            <button
              onClick={onGithubSignIn}
              className="w-full py-3 sm:py-4 px-4 sm:px-6 bg-[#24292e] hover:bg-[#1b1f23] text-white rounded-xl font-semibold flex items-center justify-center gap-2 sm:gap-3 transition-all active:scale-95 text-sm sm:text-base">
              <Github size={20} />
              {t.auth.signInWithGithub}
            </button>

            {/* Divider */}
            <div className="relative py-3 sm:py-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/10"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-black/40 text-gray-400">
                  {t.auth.or}
                </span>
              </div>
            </div>

            {/* Guest Mode */}
            <button
              onClick={onContinueAsGuest}
              className="w-full py-3 sm:py-4 px-4 sm:px-6 glass-btn rounded-xl font-semibold flex items-center justify-center gap-2 sm:gap-3 text-sm sm:text-base">
              <LogIn size={20} />
              {t.auth.continueAsGuest}
            </button>
          </div>

          <p className="text-xs text-gray-500 text-center leading-relaxed">
            {t.auth.disclaimer}
          </p>
        </div>
      </div>
    </div>
  );
}
