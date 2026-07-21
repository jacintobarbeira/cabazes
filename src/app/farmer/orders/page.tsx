"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/Card"
import { Badge } from "@/components/Badge"
import { formatDateOnly } from "@/lib/dates"
import type { OrderDTO } from "@/types/api"

const statusVariant: Record<string, "warning" | "success" | "info" | "danger"> = {
  PENDING: "warning",
  CONFIRMED: "success",
  DELIVERED: "info",
  CANCELLED: "danger",
}

export default function OrdersPage() {
  const { data: session } = useSession()
  const timezone = session?.user?.timezone || "UTC"
  const [orders, setOrders] = useState<OrderDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState("")

  useEffect(() => {
    const url = filter ? `/api/orders?status=${filter}` : "/api/orders"
    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        setOrders(data)
        setLoading(false)
      })
  }, [filter])

  if (loading) return <p className="text-gray-900">Loading...</p>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
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
              {status || "All"}
            </button>
          ))}
        </div>
      </div>

      {orders.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-gray-900 text-sm">
            No orders found.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 font-medium text-gray-900">Customer</th>
                  <th className="text-left py-2 font-medium text-gray-900">Basket</th>
                  <th className="text-left py-2 font-medium text-gray-900">Status</th>
                  <th className="text-left py-2 font-medium text-gray-900">Address</th>
                  <th className="text-left py-2 font-medium text-gray-900">Date</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} className="border-b border-gray-100">
                    <td className="py-2 text-gray-900">
                      <div>
                        <span className="font-medium">{order.customerName || "Unknown"}</span>
                        <div className="text-xs text-gray-900">{order.customerEmail}</div>
                      </div>
                    </td>
                    <td className="py-2 text-gray-900">
                      <Link
                        href={`/farmer/baskets/${order.basketId}/orders`}
                        className="text-green-600 hover:text-green-700"
                      >
                        {order.basketName}
                      </Link>
                    </td>
                    <td className="py-2 text-gray-900">
                      <Badge variant={statusVariant[order.status] || "default"}>
                        {order.status}
                      </Badge>
                    </td>
                    <td className="py-2 text-gray-900">{order.deliveryAddress}</td>
                    <td className="py-2 text-gray-900">
                      {formatDateOnly(order.createdAt, timezone)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
