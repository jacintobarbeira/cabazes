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

export function AdminSidebar({
  navItems,
  userName,
}: {
  navItems: NavItem[]
  userName: string | null
}) {
  const { t } = useTranslation()

  return (
    <aside className="w-64 bg-gray-900 text-white flex flex-col">
      <div className="p-6">
        <Link href="/admin" className="text-xl font-bold text-white">
          🧺 {t("admin.appName")}
        </Link>
      </div>
      <nav className="mt-6 flex-1">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-3 px-6 py-3 text-sm text-white hover:bg-gray-800 transition-colors"
          >
            <span>{item.icon}</span>
            <span>{t(item.labelKey)}</span>
          </Link>
        ))}
      </nav>
      <div className="p-6 border-t border-gray-800">
        <div className="text-sm text-gray-300 mb-2">
          {userName}
        </div>
        <div className="flex items-center justify-between">
          <LanguageSwitcher className="text-gray-300 [&_span]:text-gray-600 [&_button]:text-gray-300 [&_button]:hover:text-white" />
          <SignOutButton label={t("nav.signOut")} className="text-sm text-gray-300 hover:text-white transition-colors" />
        </div>
      </div>
    </aside>
  )
}
