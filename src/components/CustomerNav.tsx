"use client"

import Link from "next/link"
import { useTranslation } from "@/lib/i18n/useTranslation"
import { LanguageSwitcher } from "@/components/LanguageSwitcher"
import { SignOutButton } from "@/components/SignOutButton"

export function CustomerNav() {
  const { t } = useTranslation()

  return (
    <nav className="flex items-center gap-6">
      <Link href="/baskets" className="text-sm text-gray-900 hover:text-gray-700">
        {t("nav.availableBaskets")}
      </Link>
      <Link href="/my-orders" className="text-sm text-gray-900 hover:text-gray-700">
        {t("nav.myOrders")}
      </Link>
      <Link href="/profile" className="text-sm text-gray-900 hover:text-gray-700">
        {t("nav.profile")}
      </Link>
      <LanguageSwitcher />
      <SignOutButton label={t("nav.signOut")} className="text-sm text-gray-900 hover:text-gray-700" />
    </nav>
  )
}
