"use client"

import { useLanguage } from "@/lib/i18n/context"

export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { locale, setLocale } = useLanguage()

  return (
    <div className={`flex items-center gap-1 text-sm ${className}`}>
      <button
        onClick={() => setLocale("en")}
        className={`px-1.5 py-0.5 rounded ${locale === "en" ? "font-bold text-green-700" : "text-gray-500 hover:text-gray-700"}`}
      >
        EN
      </button>
      <span className="text-gray-300">|</span>
      <button
        onClick={() => setLocale("pt")}
        className={`px-1.5 py-0.5 rounded ${locale === "pt" ? "font-bold text-green-700" : "text-gray-500 hover:text-gray-700"}`}
      >
        PT
      </button>
    </div>
  )
}
