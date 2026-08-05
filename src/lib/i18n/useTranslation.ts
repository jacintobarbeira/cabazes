"use client"

import { useLanguage, type Locale } from "./context"
import { en } from "./translations/en"
import { pt } from "./translations/pt"

const translations: Record<Locale, Record<string, any>> = { en, pt }

function getNestedValue(obj: Record<string, any>, path: string): string | undefined {
  const keys = path.split(".")
  let current: any = obj
  for (const key of keys) {
    if (current === null || current === undefined) return undefined
    current = current[key]
  }
  return typeof current === "string" ? current : undefined
}

export function useTranslation() {
  const { locale } = useLanguage()

  const t = (key: string, params?: Record<string, string | number>): string => {
    const value = getNestedValue(translations[locale], key)
    if (value === undefined) {
      const fallback = getNestedValue(translations.en, key)
      if (fallback === undefined) return key
      return interpolate(fallback, params)
    }
    return interpolate(value, params)
  }

  return { t, locale }
}

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (_, name) => {
    return params[name] !== undefined ? String(params[name]) : `{${name}}`
  })
}
