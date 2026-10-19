import React, { createContext, useContext, useState } from 'react';
import { en } from './locales/en';
import { ja } from './locales/ja';

export type LanguageCode = 'en' | 'ja';

export const LANGUAGES = [
  { code: 'en', label: 'English', nativeLabel: 'English' },
  { code: 'ja', label: 'Japanese', nativeLabel: '日本語' },
];

const translations: Record<LanguageCode, Record<string, string>> = {
  en,
  ja,
};

function detectInitialLanguage(): LanguageCode {
  if (typeof window === 'undefined') return 'en';
  const saved = localStorage.getItem('floormap.language');
  if (saved === 'en' || saved === 'ja') return saved;

  const browserLanguages = navigator.languages?.length
    ? navigator.languages
    : [navigator.language];

  // Accept-language style negotiation: the first browser preference that maps
  // to a supported language wins (e.g. en-US → en). Later preferences are
  // fallbacks only and never override the primary language.
  for (const raw of browserLanguages) {
    const lang = raw.toLowerCase().split(/[-_]/)[0];
    if (lang === 'ja') return 'ja';
    if (lang === 'en') return 'en';
  }

  return 'en';
}

interface I18nContextProps {
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextProps | undefined>(undefined);

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<LanguageCode>(detectInitialLanguage);

  const setLanguage = (lang: LanguageCode) => {
    setLanguageState(lang);
    localStorage.setItem('floormap.language', lang);
  };

  const t = (key: string): string => {
    // Attempt requested language
    const currentTranslations = translations[language];
    if (currentTranslations && currentTranslations[key] !== undefined) {
      return currentTranslations[key];
    }
    // Fallback to English
    const englishTranslations = translations['en'];
    if (englishTranslations && englishTranslations[key] !== undefined) {
      return englishTranslations[key];
    }
    // Fallback to key itself
    return key;
  };

  return (
    <I18nContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = () => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
};
