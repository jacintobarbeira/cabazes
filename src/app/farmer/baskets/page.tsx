"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { Button } from "@/components/Button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/Card"
import { Badge } from "@/components/Badge"
import CloneBasketDialog from "@/components/CloneBasketDialog"
import { useTranslation } from "@/lib/i18n/useTranslation"
import { formatDateOnly } from "@/lib/dates"
import type { BasketSummaryDTO } from "@/types/api"

export default function BasketsPage() {
  const { t } = useTranslation()
  const { data: session } = useSession()
  const timezone = session?.user?.timezone || "UTC"
  const [baskets, setBaskets] = useState<BasketSummaryDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [cloningBasket, setCloningBasket] = useState<BasketSummaryDTO | null>(null)

  useEffect(() => {
    fetch("/api/baskets")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load")
        return res.json()
      })
      .then((data) => {
        setBaskets(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <p className="text-gray-900">{t("common.loading")}</p>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t("baskets.title")}</h1>
        <Link href="/farmer/baskets/new">
          <Button>{t("baskets.newBasket")}</Button>
        </Link>
      </div>

      {baskets.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-gray-900 text-sm">
            {t("baskets.noBaskets")}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {baskets.map((basket) => (
            <Card key={basket.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{basket.name}</CardTitle>
                  <Badge variant={basket.published ? "success" : "default"}>
                    {basket.published ? t("baskets.published") : t("baskets.draft")}
                  </Badge>
                </div>
                <p className="text-sm text-gray-900">
                  {t("baskets.deadline")} {formatDateOnly(basket.orderDeadline, timezone)}
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-900">{t("baskets.price")}</span>
                    <span className="font-medium text-gray-900">€{basket.price}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-900">{t("baskets.delivery")}</span>
                    <span className="text-gray-900">{formatDateOnly(basket.deliveryDay, timezone)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-900">{t("baskets.ordersCount")}</span>
                    <span className="text-gray-900">{basket.orderCount}</span>
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <Link href={basket.published ? `/farmer/baskets/${basket.id}` : `/farmer/baskets/${basket.id}/edit`} className="flex-1">
                    <Button variant="outline" className="w-full text-xs">{basket.published ? t("baskets.view") : t("baskets.edit")}</Button>
                  </Link>
                  <Link href={`/farmer/baskets/${basket.id}/orders`} className="flex-1">
                    <Button variant="outline" className="w-full text-xs">{t("orders.title")}</Button>
                  </Link>
                  <Link href={`/farmer/baskets/${basket.id}/links`} className="flex-1">
                    <Button variant="outline" className="w-full text-xs">{t("baskets.links")}</Button>
                  </Link>
                  <Button
                    variant="outline"
                    className="text-xs"
                    onClick={() => setCloningBasket(basket)}
                  >
                    {t("baskets.clone")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {cloningBasket && (
        <CloneBasketDialog
          basketId={cloningBasket.id}
          basketName={cloningBasket.name}
          orderDeadline={cloningBasket.orderDeadline}
          deliveryDay={cloningBasket.deliveryDay}
          timezone={timezone}
          onClose={() => setCloningBasket(null)}
        />
      )}
    </div>
  )
}
