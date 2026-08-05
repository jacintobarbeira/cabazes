"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/Card"
import { Badge } from "@/components/Badge"
import { Button } from "@/components/Button"
import { formatDateOnly } from "@/lib/dates"
import { useTranslation } from "@/lib/i18n/useTranslation"
import type { OrderDTO } from "@/types/api"

const statusVariant: Record<string, "warning" | "success" | "info" | "danger"> = {
  PENDING: "warning",
  CONFIRMED: "success",
  DELIVERED: "info",
  CANCELLED: "danger",
}

export default function MyOrdersPage() {
  const { t } = useTranslation()
  const { data: session } = useSession()
  const timezone = session?.user?.timezone || "UTC"
  const [orders, setOrders] = useState<OrderDTO[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/customers/me/orders")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load")
        return res.json()
      })
      .then((data) => {
        setOrders(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const handleCancel = async (orderId: string) => {
    if (!confirm(t("myOrders.confirmCancel"))) {
      return
    }
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CANCELLED" }),
      })
      if (!res.ok) {
        const data = await res.json()
        alert(t("myOrders.error", { message: data.error }))
        return
      }
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: "CANCELLED" as const } : o))
      )
    } catch (err) {
      alert(t("myOrders.cancelFailed"))
    }
  }

  if (loading) {
    return <p className="text-gray-900">{t("myOrders.loadingOrders")}</p>
  }

  if (orders.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-center text-gray-900">
          {t("myOrders.noOrders")}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">{t("myOrders.title")}</h1>
      {orders.map((order) => (
        <Card key={order.id}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle>{order.basketName}</CardTitle>
              <div className="flex items-center gap-2">
                {order.status === "CONFIRMED" && (
                  <Button size="sm" variant="outline" onClick={() => handleCancel(order.id)}>
                    {t("common.cancel")}
                  </Button>
                )}
                <Badge variant={statusVariant[order.status] || "default"}>
                  {t("statuses." + order.status)}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-900">{t("myOrders.delivery")}</span>{" "}
                <span className="text-gray-900">
                  {formatDateOnly(order.createdAt, timezone)}
                </span>
              </div>
              <div>
                <span className="text-gray-900">{t("myOrders.address")}</span>{" "}
                <span className="text-gray-900">{order.deliveryAddress}</span>
              </div>
            </div>
            {order.baseItems.length > 0 && (
              <div className="mt-3">
                <span className="text-sm text-gray-900">{t("myOrders.includes")}</span>
                <ul className="mt-1 space-y-1">
                  {order.baseItems.map((item) => (
                    <li key={item.id} className="text-sm text-gray-900">
                      {item.productName}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {order.swapChoices.length > 0 && (
              <div className="mt-3">
                <span className="text-sm text-gray-900">{t("myOrders.swaps")}</span>
                <ul className="mt-1 space-y-1">
                  {order.swapChoices.map((choice) => (
                    <li key={choice.id} className="text-sm text-gray-900">
                      {choice.baseItemName} → {choice.swapItemName}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
