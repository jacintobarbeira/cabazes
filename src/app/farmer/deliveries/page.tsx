"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { Button } from "@/components/Button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/Card"
import { Badge } from "@/components/Badge"
import { useTranslation } from "@/lib/i18n/useTranslation"
import { formatDateOnly } from "@/lib/dates"
import type { DeliveryAddressDTO } from "@/types/api"

interface DeliveryDate {
  date: string
  totalOrders: number
}

export default function DeliveriesPage() {
  const { t } = useTranslation()
  const { data: session } = useSession()
  const timezone = session?.user?.timezone || "UTC"
  const [deliveryDates, setDeliveryDates] = useState<DeliveryDate[]>([])
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [addresses, setAddresses] = useState<DeliveryAddressDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [dateFilter, setDateFilter] = useState("")
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/deliveries/by-date")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load")
        return res.json()
      })
      .then((data) => {
        setDeliveryDates(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const loadDeliveries = async (date: string) => {
    setSelectedDate(date)
    const res = await fetch(`/api/deliveries/by-date?date=${date}`)
    const data = await res.json()
    setAddresses(data)
  }

  const groupedByPoint = addresses.reduce(
    (acc, addr) => {
      const key = addr.deliveryPointName
        ? `point:${addr.deliveryPointName}`
        : `customer:${addr.address}`
      if (!acc[key]) acc[key] = []
      acc[key].push(addr)
      return acc
    },
    {} as Record<string, DeliveryAddressDTO[]>
  )

  const handlePrint = () => {
    window.print()
  }

  const handleDeliver = async (orderId: string) => {
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "DELIVERED" }),
      })
      if (!res.ok) {
        const data = await res.json()
        alert(`Error: ${data.error}`)
        return
      }
      setAddresses((prev) =>
        prev.map((a) => (a.orderId === orderId ? { ...a, status: "DELIVERED" } : a))
      )
    } catch (err) {
      alert(t("deliveries.delivered"))
    }
  }

  const filteredDates = dateFilter
    ? deliveryDates.filter((d) => d.date.includes(dateFilter))
    : deliveryDates

  if (loading) return <p className="text-gray-900">{t("common.loading")}</p>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t("deliveries.title")}</h1>
        {selectedDate && (
          <Button variant="outline" onClick={handlePrint}>
            {t("deliveries.print")}
          </Button>
        )}
      </div>

      {!selectedDate ? (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">{t("deliveries.filterByDate")}</label>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="flex h-10 w-full max-w-xs rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDates.map((dd) => (
              <Card
                key={dd.date}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => loadDeliveries(dd.date)}
              >
                <CardHeader>
                  <CardTitle className="text-base">
                    {formatDateOnly(dd.date, timezone)}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Badge variant="info">{dd.totalOrders} {t("deliveries.deliveriesCount")}</Badge>
                </CardContent>
              </Card>
            ))}
            {filteredDates.length === 0 && (
              <Card>
                <CardContent className="pt-6 text-gray-900 text-sm">
                  {dateFilter ? t("deliveries.noDeliveriesMatch") : t("deliveries.noDeliveries")}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      ) : (
        <div>
          <button
            onClick={() => {
              setSelectedDate(null)
              setAddresses([])
              setExpandedOrderId(null)
            }}
            className="text-sm text-green-600 hover:text-green-700 mb-4"
          >
            {t("deliveries.backToDates")}
          </button>

          <p className="text-sm text-gray-900 mb-4">
            {t("deliveries.deliveriesFor")} {formatDateOnly(selectedDate, timezone)}
          </p>

          {Object.entries(groupedByPoint)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, addrs]) => {
              const first = addrs[0]
              const isPoint = first.deliveryPointName
              return (
                <Card key={key} className="mb-4">
                  <CardHeader>
                    <CardTitle className="text-base">
                      {isPoint ? first.deliveryPointName : t("deliveries.customerDelivery")}
                    </CardTitle>
                    <p className="text-sm text-gray-900">
                      {first.address}
                      {first.city ? `, ${first.city}` : ""}
                    </p>
                    <p className="text-sm text-gray-900">{addrs.length} {t("deliveries.deliveriesCount")}</p>
                  </CardHeader>
                <CardContent>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-2 font-medium text-gray-900">{t("deliveries.colBasket")}</th>
                        <th className="text-left py-2 font-medium text-gray-900">{t("deliveries.colName")}</th>
                        <th className="text-left py-2 font-medium text-gray-900">{t("deliveries.colAddress")}</th>
                        <th className="text-left py-2 font-medium text-gray-900">{t("deliveries.colPhone")}</th>
                        <th className="text-left py-2 font-medium text-gray-900">{t("deliveries.colNotes")}</th>
                        <th className="text-left py-2 font-medium text-gray-900">{t("deliveries.colAction")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {addrs.map((addr, i) => (
                        <tr key={i} className="border-b border-gray-100">
                          <td className="py-2 text-gray-900">
                            <Link
                              href={`/farmer/baskets/${addr.basketId}`}
                              className="text-green-600 hover:underline"
                            >
                              {addr.basketName}
                            </Link>
                          </td>
                          <td className="py-2 font-medium text-gray-900">{addr.customerName || "-"}</td>
                          <td className="py-2 text-gray-900">{addr.address}</td>
                          <td className="py-2 text-gray-900">{addr.customerPhone || "-"}</td>
                          <td className="py-2 text-gray-900">{addr.deliveryNotes || "-"}</td>
                          <td className="py-2">
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setExpandedOrderId(expandedOrderId === addr.orderId ? null : addr.orderId)}
                              >
                                {expandedOrderId === addr.orderId ? t("common.hide") : t("deliveries.viewOrder")}
                              </Button>
                              {addr.status === "CONFIRMED" && (
                                <Button size="sm" onClick={() => handleDeliver(addr.orderId)}>
                                  {t("deliveries.delivered")}
                                </Button>
                              )}
                              {addr.status === "DELIVERED" && (
                                <Badge variant="info">{t("deliveries.delivered")}</Badge>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {addrs.map((addr) => (
                    expandedOrderId === addr.orderId && (
                      <div key={`detail-${addr.orderId}`} className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="font-medium text-gray-900">{t("deliveries.orderDetails")} {addr.customerName || t("basketOrders.unknown")}</h3>
                          <Badge variant={addr.status === "DELIVERED" ? "info" : "success"}>{t("statuses." + addr.status)}</Badge>
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                          <div>
                            <span className="text-gray-900">{t("deliveries.phone")}</span>{" "}
                            <span className="text-gray-900">{addr.customerPhone || "-"}</span>
                          </div>
                          <div>
                            <span className="text-gray-900">{t("deliveries.address")}</span>{" "}
                            <span className="text-gray-900">{addr.address}</span>
                          </div>
                          {addr.deliveryNotes && (
                            <div>
                              <span className="text-gray-900">{t("deliveries.notes")}</span>{" "}
                              <span className="text-gray-900">{addr.deliveryNotes}</span>
                            </div>
                          )}
                        </div>

                        {addr.baseItems.length > 0 && (
                          <div className="mb-3">
                            <span className="text-sm font-medium text-gray-900">{t("deliveries.baseItems")}</span>
                            <ul className="mt-1 space-y-1">
                              {addr.baseItems.map((item) => (
                                <li key={item.id} className="text-sm text-gray-900">
                                  {item.productName}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {addr.swapChoices.length > 0 && (
                          <div>
                            <span className="text-sm font-medium text-gray-900">{t("deliveries.swapChoices")}</span>
                            <ul className="mt-1 space-y-1">
                              {addr.swapChoices.map((choice) => (
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
              )
            })}

          {addresses.length === 0 && (
            <Card>
              <CardContent className="pt-6 text-gray-900 text-sm">
                {t("deliveries.noDeliveriesForDate")}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
