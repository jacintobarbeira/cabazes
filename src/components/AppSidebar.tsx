"use client"

import Link from "next/link"
import { useTranslation } from "@/lib/i18n/useTranslation"
import { LanguageSwitcher } from "@/components/LanguageSwitcher"
import { SignOutButton } from "@/components/SignOutButton"

interface NavItem {
  href: string
  icon: string
  labelKey: string
}

const THEMES = {
  green: {
    aside: "w-64 bg-green-800 text-white flex flex-col",
    hover: "hover:bg-green-700",
    footer: "p-6 border-t border-green-700",
    footerText: "text-sm text-green-200 mb-2",
    switcher: "text-green-200 [&_span]:text-green-600 [&_button]:text-green-200 [&_button]:hover:text-white",
    signOut: "text-sm text-green-200 hover:text-white transition-colors",
  },
  gray: {
    aside: "w-64 bg-gray-900 text-white flex flex-col",
    hover: "hover:bg-gray-800",
    footer: "p-6 border-t border-gray-800",
    footerText: "text-sm text-gray-300 mb-2",
    switcher: "text-gray-300 [&_span]:text-gray-600 [&_button]:text-gray-300 [&_button]:hover:text-white",
    signOut: "text-sm text-gray-300 hover:text-white transition-colors",
  },
} as const

export function AppSidebar({
  navItems,
  userName,
  theme,
  brandHref,
  brandLabelKey,
}: {
  navItems: NavItem[]
  userName: string | null
  theme: "green" | "gray"
  brandHref: string
  brandLabelKey: string
}) {
  const { t } = useTranslation()
  const colors = THEMES[theme]

  return (
    <aside className={colors.aside}>
      <div className="p-6">
        <Link href={brandHref} className="text-xl font-bold text-white">
          🧺 {t(brandLabelKey)}
        </Link>
      </div>
      <nav className="mt-6 flex-1">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 px-6 py-3 text-sm text-white ${colors.hover} transition-colors`}
          >
            <span>{item.icon}</span>
            <span>{t(item.labelKey)}</span>
          </Link>
        ))}
      </nav>
      <div className={colors.footer}>
        <div className={colors.footerText}>{userName}</div>
        <div className="flex items-center justify-between">
          <LanguageSwitcher className={colors.switcher} />
          <SignOutButton label={t("nav.signOut")} className={colors.signOut} />
        </div>
      </div>
    </aside>
  )
}
