"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/Card"
import { Badge } from "@/components/Badge"
import { Button } from "@/components/Button"
import { useTranslation } from "@/lib/i18n/useTranslation"
import { formatDateOnly } from "@/lib/dates"
import type { OrderDTO } from "@/types/api"

const statusVariant: Record<string, "warning" | "success" | "info" | "danger"> = {
  PENDING: "warning",
  CONFIRMED: "success",
  DELIVERED: "info",
  CANCELLED: "danger",
}

export default function OrdersPage() {
  const { t } = useTranslation()
  const { data: session } = useSession()
  const timezone = session?.user?.timezone || "UTC"
  const [orders, setOrders] = useState<OrderDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState("")
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null)

  useEffect(() => {
    const url = filter ? `/api/orders?status=${filter}` : "/api/orders"
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load")
        return res.json()
      })
      .then((data) => {
        setOrders(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [filter])

  if (loading) return <p className="text-gray-900">{t("common.loading")}</p>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t("orders.title")}</h1>
        <div className="flex gap-2">
          {["", "PENDING", "CONFIRMED", "DELIVERED", "CANCELLED"].map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-3 py-1 text-sm rounded-md ${
                filter === status
                  ? "bg-green-600 text-white"
                  : "bg-gray-100 text-gray-900 hover:bg-gray-200"
              }`}
            >
              {status ? t("orders." + status.toLowerCase()) : t("orders.all")}
            </button>
          ))}
        </div>
      </div>

      {orders.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-gray-900 text-sm">
            {t("orders.noOrders")}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 font-medium text-gray-900">{t("orders.colCustomer")}</th>
                  <th className="text-left py-2 font-medium text-gray-900">{t("orders.colBasket")}</th>
                  <th className="text-left py-2 font-medium text-gray-900">{t("orders.colStatus")}</th>
                  <th className="text-left py-2 font-medium text-gray-900">{t("orders.colAddress")}</th>
                  <th className="text-left py-2 font-medium text-gray-900">{t("orders.colDate")}</th>
                  <th className="text-left py-2 font-medium text-gray-900">{t("orders.colAction")}</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} className="border-b border-gray-100">
                    <td className="py-2 text-gray-900">
                      <div>
                        <span className="font-medium">{order.customerName || t("orders.unknown")}</span>
                        <div className="text-xs text-gray-900">{order.customerEmail}</div>
                      </div>
                    </td>
                    <td className="py-2 text-gray-900">
                      <Link
                        href={`/farmer/baskets/${order.basketId}`}
                        className="text-green-600 hover:text-green-700"
                      >
                        {order.basketName}
                      </Link>
                    </td>
                    <td className="py-2 text-gray-900">
                      <Badge variant={statusVariant[order.status] || "default"}>
                        {t("statuses." + order.status)}
                      </Badge>
                    </td>
                    <td className="py-2 text-gray-900">
                      {order.deliveryPointName ? (
                        <div>
                          <span className="font-medium">{order.deliveryPointName}</span>
                          <div className="text-xs text-gray-900">{order.deliveryAddress}</div>
                        </div>
                      ) : (
                        order.deliveryAddress
                      )}
                    </td>
                    <td className="py-2 text-gray-900">
                      {formatDateOnly(order.createdAt, timezone)}
                    </td>
                    <td className="py-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setExpandedOrderId(expandedOrderId === order.id ? null : order.id)}
                      >
                        {expandedOrderId === order.id ? t("common.hide") : t("common.view")}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {orders.map((order) => (
              expandedOrderId === order.id && (
                <div key={`detail-${order.id}`} className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium text-gray-900">{t("orders.orderDetails")} {order.customerName || t("orders.unknown")}</h3>
                    <Badge variant={statusVariant[order.status] || "default"}>{t("statuses." + order.status)}</Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                    <div>
                      <span className="text-gray-900">{t("orders.phone")}</span>{" "}
                      <span className="text-gray-900">{order.customerPhone || "-"}</span>
                    </div>
                    <div>
                      <span className="text-gray-900">{order.deliveryPointName ? t("orders.deliveryPoint") : t("orders.address")}</span>{" "}
                      <span className="text-gray-900">
                        {order.deliveryPointName || order.deliveryAddress}
                      </span>
                    </div>
                    {order.deliveryPointName && (
                      <div>
                        <span className="text-gray-900">{t("orders.address")}</span>{" "}
                        <span className="text-gray-900">{order.deliveryAddress}</span>
                      </div>
                    )}
                    {order.deliveryCity && (
                      <div>
                        <span className="text-gray-900">{t("orders.city")}</span>{" "}
                        <span className="text-gray-900">{order.deliveryCity}</span>
                      </div>
                    )}
                    {order.deliveryNotes && (
                      <div>
                        <span className="text-gray-900">{t("orders.notes")}</span>{" "}
                        <span className="text-gray-900">{order.deliveryNotes}</span>
                      </div>
                    )}
                  </div>

                  {order.baseItems.length > 0 && (
                    <div className="mb-3">
                      <span className="text-sm font-medium text-gray-900">{t("orders.baseItems")}</span>
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
                    <div>
                      <span className="text-sm font-medium text-gray-900">{t("orders.swapChoices")}</span>
                      <ul className="mt-1 space-y-1">
                        {order.swapChoices.map((choice) => (
                          <li key={choice.id} className="text-sm text-gray-900">
                            {choice.baseItemName} → {choice.swapItemName}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
