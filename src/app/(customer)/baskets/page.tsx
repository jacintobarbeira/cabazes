"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/Card"
import { Badge } from "@/components/Badge"
import { Button } from "@/components/Button"
import { formatDate, formatDateOnly } from "@/lib/dates"
import { useTranslation } from "@/lib/i18n/useTranslation"
import type { AvailableBasketDTO } from "@/types/api"

export default function AvailableBasketsPage() {
  const { t } = useTranslation()
  const { data: session } = useSession()
  const timezone = session?.user?.timezone || "UTC"
  const [baskets, setBaskets] = useState<AvailableBasketDTO[]>([])
  const [subscribedFarmerCount, setSubscribedFarmerCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/customers/me/available-baskets")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load")
        return res.json()
      })
      .then((data) => {
        setBaskets(data.baskets)
        setSubscribedFarmerCount(data.subscribedFarmerCount)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return <p className="text-gray-900">{t("availableBaskets.loading")}</p>
  }

  if (subscribedFarmerCount === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-center text-gray-900">
          <p>{t("availableBaskets.noFarmers")}</p>
          <div className="mt-4">
            <Link href="/profile">
              <Button>{t("availableBaskets.manageFarmers")}</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (baskets.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-center text-gray-900">
          {t("availableBaskets.noBaskets")}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">{t("availableBaskets.title")}</h1>
      {baskets.map((basket) => (
        <Card key={basket.id}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle>{basket.name}</CardTitle>
              <Badge variant="success">€{basket.price}</Badge>
            </div>
            <p className="text-sm text-gray-900">{basket.farmerName}</p>
            {basket.description && (
              <p className="text-sm text-gray-900">{basket.description}</p>
            )}
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-900">{t("availableBaskets.delivery")}</span>{" "}
                <span className="text-gray-900">
                  {formatDateOnly(basket.deliveryDay, timezone)}
                </span>
              </div>
              <div>
                <span className="text-gray-900">{t("availableBaskets.orderBy")}</span>{" "}
                <span className="text-gray-900">
                  {formatDate(basket.orderDeadline, timezone)}
                </span>
              </div>
              <div>
                <span className="text-gray-900">{t("availableBaskets.items")}</span>{" "}
                <span className="text-gray-900">{basket.itemCount}</span>
              </div>
            </div>
            <div className="mt-4">
              <Link href={`/baskets/${basket.id}`}>
                <Button>{t("availableBaskets.order")}</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
