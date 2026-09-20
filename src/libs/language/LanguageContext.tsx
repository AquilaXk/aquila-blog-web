import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { translations, type SiteLanguage, type TranslationKey } from "./translations"

interface LanguageContextValue {
  language: SiteLanguage
  setLanguage: (lang: SiteLanguage) => void
  toggleLanguage: () => void
  t: (key: TranslationKey) => string
}

const STORAGE_KEY = "aquila_blog_lang"

const LanguageContext = createContext<LanguageContextValue>({
  language: "ko",
  setLanguage: () => {},
  toggleLanguage: () => {},
  t: (key) => translations.ko[key] || "",
})

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<SiteLanguage>("ko")

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored === "ko" || stored === "en") {
        setLanguageState(stored)
        document.documentElement.lang = stored === "ko" ? "ko-KR" : "en-US"
      }
    } catch {
      // Ignore localStorage access failures in sandboxed contexts
    }
  }, [])

  const setLanguage = useCallback((newLang: SiteLanguage) => {
    setLanguageState(newLang)
    try {
      localStorage.setItem(STORAGE_KEY, newLang)
      document.documentElement.lang = newLang === "ko" ? "ko-KR" : "en-US"
    } catch {
      // Ignore localStorage access failures
    }
  }, [])

  const toggleLanguage = useCallback(() => {
    setLanguage(language === "ko" ? "en" : "ko")
  }, [language, setLanguage])

  const t = useCallback(
    (key: TranslationKey): string => {
      const dict = translations[language] || translations.ko
      return dict[key] ?? translations.ko[key] ?? ""
    },
    [language]
  )

  const contextValue = useMemo(
    () => ({
      language,
      setLanguage,
      toggleLanguage,
      t,
    }),
    [language, setLanguage, toggleLanguage, t]
  )

  return <LanguageContext.Provider value={contextValue}>{children}</LanguageContext.Provider>
}

export const useLanguage = (): LanguageContextValue => useContext(LanguageContext)

export type { SiteLanguage, TranslationKey }
