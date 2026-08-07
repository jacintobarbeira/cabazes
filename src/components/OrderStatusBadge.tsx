"use client"

import { Badge } from "@/components/Badge"
import { useTranslation } from "@/lib/i18n/useTranslation"

const STATUS_VARIANT: Record<string, "warning" | "success" | "info" | "danger"> = {
  PENDING: "warning",
  CONFIRMED: "success",
  DELIVERED: "info",
  CANCELLED: "danger",
}

export function OrderStatusBadge({ status }: { status: string }) {
  const { t } = useTranslation()

  return (
    <Badge variant={STATUS_VARIANT[status] || "default"}>
      {t("statuses." + status)}
    </Badge>
  )
}
