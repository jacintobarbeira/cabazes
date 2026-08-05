"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/Card"
import { Badge } from "@/components/Badge"
import { Button } from "@/components/Button"
import { useTranslation } from "@/lib/i18n/useTranslation"
import { formatDate } from "@/lib/dates"
import type { OrderDTO } from "@/types/api"

const statusVariant: Record<string, "warning" | "success" | "info" | "danger"> = {
  PENDING: "warning",
  CONFIRMED: "success",
  DELIVERED: "info",
  CANCELLED: "danger",
}

export default function BasketOrdersPage({ params }: { params: Promise<{ id: string }> }) {
  const { t } = useTranslation()
  const { data: session } = useSession()
  const timezone = session?.user?.timezone || "UTC"
  const [orders, setOrders] = useState<OrderDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [basketId, setBasketId] = useState("")

  useEffect(() => {
    params.then((p) => {
      setBasketId(p.id)
      fetch(`/api/orders?basketId=${p.id}`)
        .then((res) => {
          if (!res.ok) throw new Error("Failed to load")
          return res.json()
        })
        .then((data) => {
          setOrders(data)
          setLoading(false)
        })
        .catch(() => setLoading(false))
    })
  }, [params])

  const handleConfirm = async (orderId: string) => {
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CONFIRMED" }),
      })
      if (!res.ok) {
        const data = await res.json()
        alert(`Error: ${data.error}`)
        return
      }
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: "CONFIRMED" as const } : o))
      )
    } catch (err) {
      alert(t("basketOrders.confirm"))
    }
  }

  if (loading) return <p className="text-gray-900">{t("common.loading")}</p>

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">{t("basketOrders.title")}</h1>

      {orders.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-gray-900 text-sm">
            {t("basketOrders.noOrders")}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <Card key={order.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">{order.customerName || t("basketOrders.unknown")}</CardTitle>
                    <p className="text-sm text-gray-900">{order.customerEmail}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {order.status === "PENDING" && (
                      <Button size="sm" onClick={() => handleConfirm(order.id)}>
                        {t("basketOrders.confirm")}
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
                    <span className="text-gray-900">{t("basketOrders.phone")}</span>{" "}
                    <span className="text-gray-900">{order.customerPhone || "-"}</span>
                  </div>
                  <div>
                    <span className="text-gray-900">{t("basketOrders.address")}</span>{" "}
                    <span className="text-gray-900">{order.deliveryAddress}</span>
                  </div>
                  {order.deliveryCity && (
                    <div>
                      <span className="text-gray-900">{t("basketOrders.city")}</span>{" "}
                      <span className="text-gray-900">{order.deliveryCity}</span>
                    </div>
                  )}
                  {order.deliveryNotes && (
                    <div>
                      <span className="text-gray-900">{t("basketOrders.notes")}</span>{" "}
                      <span className="text-gray-900">{order.deliveryNotes}</span>
                    </div>
                  )}
                </div>
                {order.swapChoices.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <span className="text-sm text-gray-900">{t("basketOrders.swapChoices")}</span>
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
      )}
    </div>
  )
}
