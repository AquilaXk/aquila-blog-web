import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { translations, type SiteLanguage, type TranslationKey } from "./translations"

export interface LanguageContextValue {
  language: SiteLanguage
  setLanguage: (lang: SiteLanguage) => void
  toggleLanguage: () => void
  t: (key: TranslationKey) => string
}

export const LANGUAGE_STORAGE_KEY = "aquila_blog_lang"
export const LANGUAGE_COOKIE_KEY = "aquila_blog_lang"

const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect

export const parseLanguagePreference = (
  cookieHeaderOrString?: string | null
): SiteLanguage | null => {
  if (!cookieHeaderOrString) return null
  const match = cookieHeaderOrString.match(/(?:^|;\s*)aquila_blog_lang="?([a-zA-Z-]+)"?(?:;|$)/)
  if (!match) return null
  const value = match[1].toLowerCase()
  if (value === "en" || value.startsWith("en-")) return "en"
  if (value === "ko" || value.startsWith("ko-")) return "ko"
  return null
}

export const getClientStoredLanguage = (): SiteLanguage | null => {
  if (typeof document === "undefined") return null
  try {
    const fromCookie = parseLanguagePreference(document.cookie)
    if (fromCookie) return fromCookie
    const fromStorage = localStorage.getItem(LANGUAGE_STORAGE_KEY)
    if (fromStorage) {
      const parsedStorage = parseLanguagePreference(`${LANGUAGE_COOKIE_KEY}=${fromStorage}`)
      if (parsedStorage) return parsedStorage
    }
  } catch {
    // Ignore storage/cookie read failures in sandboxed contexts
  }
  return null
}

export const setClientStoredLanguage = (lang: SiteLanguage): void => {
  if (typeof document === "undefined") return
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, lang)
  } catch {
    // Ignore localStorage access failures
  }
  try {
    document.cookie = `${LANGUAGE_COOKIE_KEY}=${lang}; path=/; max-age=31536000; SameSite=Lax`
    document.documentElement.lang = lang === "ko" ? "ko-KR" : "en-US"
  } catch {
    // Ignore cookie/document access failures
  }
}

export const LanguageContext = createContext<LanguageContextValue>({
  language: "ko",
  setLanguage: () => {},
  toggleLanguage: () => {},
  t: (key) => translations.ko[key] || "",
})

export const LanguageProvider: React.FC<{
  children: ReactNode
  initialLanguage?: SiteLanguage
}> = ({ children, initialLanguage }) => {
  const [language, setLanguageState] = useState<SiteLanguage>(initialLanguage || "ko")

  useIsomorphicLayoutEffect(() => {
    const stored = getClientStoredLanguage()
    if (stored && stored !== language) {
      setLanguageState(stored)
      document.documentElement.lang = stored === "ko" ? "ko-KR" : "en-US"
    } else if (language) {
      document.documentElement.lang = language === "ko" ? "ko-KR" : "en-US"
    }
  }, [])

  const setLanguage = useCallback((newLang: SiteLanguage) => {
    setLanguageState(newLang)
    setClientStoredLanguage(newLang)
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

