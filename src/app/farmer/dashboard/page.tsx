"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/Card"
import Link from "next/link"
import { useTranslation } from "@/lib/i18n/useTranslation"
import { formatDateOnly } from "@/lib/dates"

interface Basket {
  id: string
  name: string
  orderDeadline: string
  published: boolean
  orderCount: number
}

export default function DashboardPage() {
  const { t } = useTranslation()
  const [data, setData] = useState<{
    baskets: Basket[]
    totalOrders: number
    totalCustomers: number
    pendingOrders: number
    timezone: string
  } | null>(null)

  useEffect(() => {
    fetch("/api/farmer/dashboard")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load")
        return res.json()
      })
      .then(setData)
      .catch(() => setData(null))
  }, [])

  if (!data) return <p className="text-gray-900">{t("common.loading")}</p>

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">{t("nav.dashboard")}</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-gray-900">{t("dashboard.totalOrders")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-gray-900">{data.totalOrders}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-gray-900">{t("dashboard.customers")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-gray-900">{data.totalCustomers}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-gray-900">{t("dashboard.pendingOrders")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-yellow-600">{data.pendingOrders}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{t("dashboard.recentBaskets")}</CardTitle>
            <Link href="/farmer/baskets/new" className="text-sm text-green-600 hover:text-green-700">
              {t("dashboard.newBasket")}
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {data.baskets.length === 0 ? (
            <p className="text-gray-900 text-sm">{t("dashboard.noBaskets")}</p>
          ) : (
            <div className="space-y-3">
              {data.baskets.map((basket) => (
                <Link
                  key={basket.id}
                  href={`/farmer/baskets/${basket.id}`}
                  className="flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:border-green-300 transition-colors"
                >
                  <div>
                    <p className="font-medium text-gray-900">{basket.name}</p>
                    <p className="text-sm text-gray-900">
                      {t("dashboard.deadline")} {formatDateOnly(basket.orderDeadline, data.timezone)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">{basket.orderCount} {t("dashboard.orders")}</p>
                    <p className={`text-xs ${basket.published ? "text-green-600" : "text-gray-900"}`}>
                      {basket.published ? t("baskets.published") : t("baskets.draft")}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
