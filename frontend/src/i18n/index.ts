import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { en } from "./locales/en";
import { fr } from "./locales/fr";

export const SUPPORTED_LANGUAGES = ["en", "fr"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

const STORAGE_KEY = "ncai-language";

// Resources are imported synchronously and bundled into the main chunk so
// the very first render already has translations available — no flashing
// keys, no Suspense boundary required.
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      fr: { translation: fr },
    },
    fallbackLng: "en",
    supportedLngs: SUPPORTED_LANGUAGES as unknown as string[],
    nonExplicitSupportedLngs: true, // 'fr-FR' resolves to 'fr'
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: STORAGE_KEY,
      caches: ["localStorage"],
    },
    react: {
      // Use the synchronous render path; we never lazy-load resources, so
      // there is no need to suspend the tree.
      useSuspense: false,
    },
  });

export function setLanguage(lang: SupportedLanguage) {
  void i18n.changeLanguage(lang);
}

export default i18n;
