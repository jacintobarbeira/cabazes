"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { Button } from "@/components/Button"
import { Badge } from "@/components/Badge"
import CloneBasketDialog from "@/components/CloneBasketDialog"
import { useTranslation } from "@/lib/i18n/useTranslation"
import { formatDate, formatDateOnly } from "@/lib/dates"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/Card"
import type { BasketDTO } from "@/types/api"

export default function BasketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { t } = useTranslation()
  const { data: session } = useSession()
  const timezone = session?.user?.timezone || "UTC"
  const [basket, setBasket] = useState<BasketDTO | null>(null)
  const [loading, setLoading] = useState(true)
  const [publishing, setPublishing] = useState(false)
  const [showCloneDialog, setShowCloneDialog] = useState(false)

  useEffect(() => {
    params.then((p) => {
      fetch(`/api/baskets/${p.id}`)
        .then((res) => {
          if (!res.ok) {
            setBasket(null)
            setLoading(false)
            return
          }
          return res.json()
        })
        .then((data) => {
          if (data) {
            setBasket(data)
          }
          setLoading(false)
        })
    })
  }, [params])

  const handlePublish = async () => {
    if (!basket) return
    setPublishing(true)
    const res = await fetch(`/api/baskets/${basket.id}/publish`, {
      method: "POST",
    })
    if (res.ok) {
      const data = await res.json()
      setBasket(data)
    }
    setPublishing(false)
  }

  if (loading) return <p className="text-gray-900">{t("common.loading")}</p>
  if (!basket) return <p className="text-gray-900">{t("basketDetail.notFound")}</p>

  const baseItems = basket?.items?.filter((item) => item.isBase) ?? []
  const swapItems = basket?.items?.filter((item) => !item.isBase) ?? []
  const hasItems = baseItems.length > 0 || swapItems.length > 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{basket.name}</h1>
          <p className="text-sm text-gray-900 mt-1">
            Deadline: {formatDate(basket.orderDeadline, timezone)}
          </p>
        </div>
        <div className="flex gap-2">
          {!basket.published && (
            <Button onClick={handlePublish} disabled={publishing || !hasItems} title={!hasItems ? t("basketDetail.addItemsFirst") : ""}>
              {publishing ? t("basketDetail.publishing") : t("basketDetail.publish")}
            </Button>
          )}
          {!basket.published && (
            <Link href={`/farmer/baskets/${basket.id}/edit`}>
              <Button variant="outline">{t("basketDetail.edit")}</Button>
            </Link>
          )}
          <Button variant="outline" onClick={() => setShowCloneDialog(true)}>
            {t("basketDetail.clone")}
          </Button>
          <Link href={`/farmer/baskets/${basket.id}/links`}>
            <Button variant="outline">{t("basketDetail.inviteLinks")}</Button>
          </Link>
          <Link href={`/farmer/baskets/${basket.id}/orders`}>
            <Button variant="outline">{t("basketDetail.orders")}</Button>
          </Link>
        </div>
      </div>

      <div className="flex gap-4">
        <Badge variant={basket.published ? "success" : "default"}>
          {basket.published ? t("baskets.published") : t("baskets.draft")}
        </Badge>
        <Badge variant="info">€{basket.price}</Badge>
        <Badge variant="info">
          {t("basketDetail.deadline")} {formatDate(basket.orderDeadline, timezone)}
        </Badge>
        <Badge variant="info">
          {t("basketDetail.delivery")} {formatDateOnly(basket.deliveryDay, timezone)}
        </Badge>
        <Badge variant="info">{t("basketDetail.allowedSwaps", { count: basket.allowedSwaps })}</Badge>
      </div>

      {basket.description && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-gray-900">{basket.description}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("basketDetail.baseItems", { count: baseItems.length })}</CardTitle>
        </CardHeader>
        <CardContent>
          {baseItems.length === 0 ? (
            <p className="text-gray-900 text-sm">{t("basketDetail.noBaseItems")}</p>
          ) : (
            <ul className="space-y-2">
              {baseItems.map((item) => (
                <li key={item.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <span className="text-gray-900">{item.productName}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {swapItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("basketDetail.swapItems", { count: swapItems.length })}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {swapItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <span className="text-gray-900">{item.productName}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("basketDetail.deliveryPoints")}</CardTitle>
        </CardHeader>
        <CardContent>
          {basket.deliveryPoints.length === 0 ? (
            <p className="text-gray-900 text-sm">{t("basketDetail.noDeliveryPoints")}</p>
          ) : (
            <ul className="space-y-2">
              {basket.deliveryPoints.map((point) => (
                <li key={point.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <span className="text-gray-900">{point.name}</span>
                  <span className="text-gray-900 text-sm">
                    {point.address}
                    {point.city ? `, ${point.city}` : ""}
                    {point.postalCode ? ` ${point.postalCode}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {basket.orderCount !== undefined && basket.orderCount > 0 && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-900">
              <strong>{basket.orderCount}</strong> {t("basketDetail.ordersPlaced")}
            </p>
          </CardContent>
        </Card>
      )}

      {showCloneDialog && (
        <CloneBasketDialog
          basketId={basket.id}
          basketName={basket.name}
          orderDeadline={basket.orderDeadline}
          deliveryDay={basket.deliveryDay}
          timezone={timezone}
          onClose={() => setShowCloneDialog(false)}
        />
      )}
    </div>
  )
}
