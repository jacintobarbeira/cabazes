"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { Button } from "@/components/Button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/Card"
import { Badge } from "@/components/Badge"
import { formatDateOnly } from "@/lib/dates"
import type { BasketSummaryDTO } from "@/types/api"

export default function BasketsPage() {
  const { data: session } = useSession()
  const timezone = session?.user?.timezone || "UTC"
  const [baskets, setBaskets] = useState<BasketSummaryDTO[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/baskets")
      .then((res) => res.json())
      .then((data) => {
        setBaskets(data)
        setLoading(false)
      })
  }, [])

  if (loading) return <p className="text-gray-900">Loading...</p>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Baskets</h1>
        <Link href="/farmer/baskets/new">
          <Button>+ New Basket</Button>
        </Link>
      </div>

      {baskets.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-gray-900 text-sm">
            No baskets yet. Create your first weekly basket!
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
                    {basket.published ? "Published" : "Draft"}
                  </Badge>
                </div>
                <p className="text-sm text-gray-900">
                  Deadline: {formatDateOnly(basket.orderDeadline, timezone)}
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-900">Price:</span>
                    <span className="font-medium">€{basket.price}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-900">Delivery:</span>
                    <span>{formatDateOnly(basket.deliveryDay, timezone)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-900">Orders:</span>
                    <span>{basket.orderCount}</span>
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <Link href={`/farmer/baskets/${basket.id}`} className="flex-1">
                    <Button variant="outline" className="w-full text-xs">Edit</Button>
                  </Link>
                  <Link href={`/farmer/baskets/${basket.id}/orders`} className="flex-1">
                    <Button variant="outline" className="w-full text-xs">Orders</Button>
                  </Link>
                  <Link href={`/farmer/baskets/${basket.id}/links`} className="flex-1">
                    <Button variant="outline" className="w-full text-xs">Links</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
