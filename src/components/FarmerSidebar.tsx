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

export function FarmerSidebar({
  navItems,
  userName,
}: {
  navItems: NavItem[]
  userName: string | null
}) {
  const { t } = useTranslation()

  return (
    <aside className="w-64 bg-green-800 text-white flex flex-col">
      <div className="p-6">
        <Link href="/farmer/dashboard" className="text-xl font-bold text-white">
          🧺 {t("auth.appName")}
        </Link>
      </div>
      <nav className="mt-6 flex-1">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-3 px-6 py-3 text-sm text-white hover:bg-green-700 transition-colors"
          >
            <span>{item.icon}</span>
            <span>{t(item.labelKey)}</span>
          </Link>
        ))}
      </nav>
      <div className="p-6 border-t border-green-700">
        <div className="text-sm text-green-200 mb-2">
          {userName}
        </div>
        <div className="flex items-center justify-between">
          <LanguageSwitcher className="text-green-200 [&_span]:text-green-600 [&_button]:text-green-200 [&_button]:hover:text-white" />
          <SignOutButton label={t("nav.signOut")} className="text-sm text-green-200 hover:text-white transition-colors" />
        </div>
      </div>
    </aside>
  )
}
