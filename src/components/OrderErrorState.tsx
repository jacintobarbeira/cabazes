"use client"

import { useTranslation } from "@/lib/i18n/useTranslation"

export function OrderErrorState({ type }: { type: "expired" | "used" | "deadline" | "invalid" | "deactivated" }) {
  const { t } = useTranslation()

  const config = {
    expired: { title: t("orderPage.linkExpired"), msg: t("orderPage.linkExpiredMsg") },
    used: { title: t("orderPage.alreadyPlaced"), msg: t("orderPage.alreadyPlacedMsg") },
    deadline: { title: t("orderPage.deadlinePassed"), msg: t("orderPage.deadlinePassedMsg") },
    invalid: { title: t("orderPage.invalidLink"), msg: t("orderPage.invalidLinkMsg") },
    deactivated: { title: t("orderPage.accountDeactivated"), msg: t("orderPage.accountDeactivatedMsg") },
  }

  const { title, msg } = config[type]

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        <p className="mt-2 text-gray-900">{msg}</p>
      </div>
    </div>
  )
}
