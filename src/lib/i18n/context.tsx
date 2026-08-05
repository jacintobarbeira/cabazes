"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"

export type Locale = "en" | "pt"

interface LanguageContextType {
  locale: Locale
  setLocale: (locale: Locale) => void
}

const LanguageContext = createContext<LanguageContextType>({
  locale: "pt",
  setLocale: () => {},
})

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("pt")
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem("locale") as Locale | null
    if (saved && (saved === "en" || saved === "pt")) {
      setLocaleState(saved)
    }
    setMounted(true)
  }, [])

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale)
    localStorage.setItem("locale", newLocale)
    document.documentElement.lang = newLocale
  }

  if (!mounted) {
    return <>{children}</>
  }

  return (
    <LanguageContext.Provider value={{ locale, setLocale }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  return useContext(LanguageContext)
}
