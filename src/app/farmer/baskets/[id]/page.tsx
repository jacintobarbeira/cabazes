"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { Button } from "@/components/Button"
import { Badge } from "@/components/Badge"
import { formatDate, formatDateOnly } from "@/lib/dates"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/Card"
import type { BasketDTO } from "@/types/api"

export default function BasketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { data: session } = useSession()
  const timezone = session?.user?.timezone || "UTC"
  const [basket, setBasket] = useState<BasketDTO | null>(null)
  const [loading, setLoading] = useState(true)
  const [publishing, setPublishing] = useState(false)

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

  if (loading) return <p className="text-gray-900">Loading...</p>
  if (!basket) return <p className="text-gray-900">Basket not found</p>

  const baseItems = basket?.items?.filter((item) => item.isBase && !item.swapGroupId) ?? []
  const swapGroupItems = basket?.swapGroups?.flatMap((g) => g.items) ?? []
  const hasItems = baseItems.length > 0 || swapGroupItems.length > 0

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
            <Button onClick={handlePublish} disabled={publishing || !hasItems} title={!hasItems ? "Add items before publishing" : ""}>
              {publishing ? "Publishing..." : "Publish"}
            </Button>
          )}
          <Link href={`/farmer/baskets/${basket.id}/links`}>
            <Button variant="outline">Invite Links</Button>
          </Link>
          <Link href={`/farmer/baskets/${basket.id}/orders`}>
            <Button variant="outline">Orders</Button>
          </Link>
        </div>
      </div>

      <div className="flex gap-4">
        <Badge variant={basket.published ? "success" : "default"}>
          {basket.published ? "Published" : "Draft"}
        </Badge>
        <Badge variant="info">€{basket.price}</Badge>
        <Badge variant="info">
          Deadline: {formatDate(basket.orderDeadline, timezone)}
        </Badge>
        <Badge variant="info">
          Delivery: {formatDateOnly(basket.deliveryDay, timezone)}
        </Badge>
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
          <CardTitle>Base Items ({baseItems.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {baseItems.length === 0 ? (
            <p className="text-gray-900 text-sm">No base items.</p>
          ) : (
            <ul className="space-y-2">
              {baseItems.map((item) => (
                <li key={item.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <span className="text-gray-900">{item.productName}</span>
                  <span className="text-sm text-gray-900">{item.quantity}x</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {basket.swapGroups.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Swap Groups ({basket.swapGroups.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {basket.swapGroups.map((group) => (
                <div key={group.id} className="p-3 border border-gray-200 rounded-lg">
                  <p className="font-medium text-sm text-gray-900">{group.name || "Swap Group"}</p>
                  <p className="text-xs text-gray-900 mb-2">Pick {group.maxChoices}</p>
                  <div className="flex flex-wrap gap-2">
                    {group.items.map((item) => (
                      <span
                        key={item.id}
                        className="px-2 py-1 bg-green-50 text-green-700 text-sm rounded"
                      >
                        {item.quantity}x {item.productName}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {basket.orderCount !== undefined && basket.orderCount > 0 && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-900">
              <strong>{basket.orderCount}</strong> order{basket.orderCount !== 1 ? "s" : ""} placed
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
