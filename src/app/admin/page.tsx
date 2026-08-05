"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/Card"
import { useTranslation } from "@/lib/i18n/useTranslation"

export default function AdminDashboardPage() {
  const { t } = useTranslation()
  const [data, setData] = useState<{
    totalFarmers: number
    totalHelpers: number
    totalCustomers: number
  } | null>(null)

  useEffect(() => {
    fetch("/api/admin/stats")
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
      <h1 className="text-2xl font-bold text-gray-900">{t("admin.dashboard")}</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-gray-900">{t("admin.totalFarmers")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{data.totalFarmers}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-gray-900">{t("admin.farmerHelpers")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{data.totalHelpers}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-gray-900">{t("admin.customers")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{data.totalCustomers}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
