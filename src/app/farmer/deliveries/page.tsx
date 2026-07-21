"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { Button } from "@/components/Button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/Card"
import { Badge } from "@/components/Badge"
import { formatDateOnly } from "@/lib/dates"
import type { DeliveryAddressDTO } from "@/types/api"

interface DeliveryDate {
  date: string
  totalOrders: number
}

export default function DeliveriesPage() {
  const { data: session } = useSession()
  const timezone = session?.user?.timezone || "UTC"
  const [deliveryDates, setDeliveryDates] = useState<DeliveryDate[]>([])
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [addresses, setAddresses] = useState<DeliveryAddressDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [dateFilter, setDateFilter] = useState("")

  useEffect(() => {
    fetch("/api/deliveries/by-date")
      .then((res) => res.json())
      .then((data) => {
        setDeliveryDates(data)
        setLoading(false)
      })
  }, [])

  const loadDeliveries = async (date: string) => {
    setSelectedDate(date)
    const res = await fetch(`/api/deliveries/by-date?date=${date}`)
    const data = await res.json()
    setAddresses(data)
  }

  const groupedByCity = addresses.reduce(
    (acc, addr) => {
      const city = addr.city || "No city"
      if (!acc[city]) acc[city] = []
      acc[city].push(addr)
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
      alert("Failed to mark as delivered")
    }
  }

  const filteredDates = dateFilter
    ? deliveryDates.filter((d) => d.date.includes(dateFilter))
    : deliveryDates

  if (loading) return <p className="text-gray-900">Loading...</p>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Deliveries</h1>
        {selectedDate && (
          <Button variant="outline" onClick={handlePrint}>
            Print
          </Button>
        )}
      </div>

      {!selectedDate ? (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">Filter by date</label>
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
                  <Badge variant="info">{dd.totalOrders} deliveries</Badge>
                </CardContent>
              </Card>
            ))}
            {filteredDates.length === 0 && (
              <Card>
                <CardContent className="pt-6 text-gray-900 text-sm">
                  {dateFilter ? "No deliveries match this date." : "No deliveries yet."}
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
            }}
            className="text-sm text-green-600 hover:text-green-700 mb-4"
          >
            ← Back to dates
          </button>

          <p className="text-sm text-gray-900 mb-4">
            Deliveries for {formatDateOnly(selectedDate, timezone)}
          </p>

          {Object.entries(groupedByCity)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([city, addrs]) => (
              <Card key={city} className="mb-4">
                <CardHeader>
                  <CardTitle className="text-base">{city}</CardTitle>
                  <p className="text-sm text-gray-900">{addrs.length} deliveries</p>
                </CardHeader>
                <CardContent>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-2 font-medium text-gray-900">Basket</th>
                        <th className="text-left py-2 font-medium text-gray-900">Name</th>
                        <th className="text-left py-2 font-medium text-gray-900">Address</th>
                        <th className="text-left py-2 font-medium text-gray-900">Phone</th>
                        <th className="text-left py-2 font-medium text-gray-900">Notes</th>
                        <th className="text-left py-2 font-medium text-gray-900">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {addrs.map((addr, i) => (
                        <tr key={i} className="border-b border-gray-100">
                          <td className="py-2 text-gray-900">{addr.basketName}</td>
                          <td className="py-2 font-medium text-gray-900">{addr.customerName || "-"}</td>
                          <td className="py-2 text-gray-900">{addr.address}</td>
                          <td className="py-2 text-gray-900">{addr.customerPhone || "-"}</td>
                          <td className="py-2 text-gray-900">{addr.deliveryNotes || "-"}</td>
                          <td className="py-2">
                            {addr.status === "CONFIRMED" && (
                              <Button size="sm" onClick={() => handleDeliver(addr.orderId)}>
                                Delivered
                              </Button>
                            )}
                            {addr.status === "DELIVERED" && (
                              <Badge variant="info">Delivered</Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            ))}

          {addresses.length === 0 && (
            <Card>
              <CardContent className="pt-6 text-gray-900 text-sm">
                No deliveries for this date.
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
