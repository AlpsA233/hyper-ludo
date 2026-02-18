import { useCallback } from "react";
import type { Language } from "@/app/locales";
import { getTranslation } from "@/app/locales";

export function useLanguage(currentLanguage: Language) {
  const t = getTranslation(currentLanguage);

  return {
    language: currentLanguage,
    t,
    languages: ["zh", "en", "ja", "fr"] as const,
    getLanguageName: useCallback((lang: Language) => {
      const names = { zh: "中文", en: "English", ja: "日本語", fr: "Français" };
      return names[lang];
    }, []),
  };
}
