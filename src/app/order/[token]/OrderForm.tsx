"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/Button"
import { Input, Textarea } from "@/components/Form"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/Card"
import { Badge } from "@/components/Badge"
import { formatDate, formatDateOnly } from "@/lib/dates"
import type { BasketDTO } from "@/types/api"

interface OrderFormProps {
  basket: BasketDTO
  customer: {
    id: string
    name: string
    email: string
    phone: string
    address: string
    city: string
    postalCode: string
    notes: string
  }
  token: string
}

export default function OrderForm({ basket, customer, token }: OrderFormProps) {
  const [timezone, setTimezone] = useState("UTC")
  const [deliveryAddress, setDeliveryAddress] = useState(customer.address)
  const [deliveryCity, setDeliveryCity] = useState(customer.city)
  const [deliveryPostalCode, setDeliveryPostalCode] = useState(customer.postalCode)
  const [deliveryNotes, setDeliveryNotes] = useState(customer.notes)
  const [swapChoices, setSwapChoices] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
      setTimezone(tz)
    } catch {
      setTimezone("UTC")
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    const swapChoicesArray = Object.entries(swapChoices).map(
      ([swapGroupId, basketItemId]) => ({
        swapGroupId,
        basketItemId,
      })
    )

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          basketId: basket.id,
          token,
          deliveryAddress,
          deliveryCity,
          deliveryPostalCode,
          deliveryNotes,
          swapChoices: swapChoicesArray,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Failed to place order")
        return
      }

      setSuccess(true)
    } catch {
      setError("An error occurred. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 text-center">
            <div className="text-4xl mb-4">🎉</div>
            <h2 className="text-xl font-semibold text-gray-900">Order Placed!</h2>
            <p className="mt-2 text-gray-900">
              Your <strong>{basket.name}</strong> will be delivered on{" "}
              {formatDateOnly(basket.deliveryDay, timezone)}.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const baseItems = basket.items.filter((item) => item.isBase && !item.swapGroupId)
  const swapGroups = basket.swapGroups

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">{basket.name}</CardTitle>
            {basket.description && (
              <p className="text-sm text-gray-900">{basket.description}</p>
            )}
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-4">
              <Badge variant="success">€{basket.price}</Badge>
              <span className="text-sm text-gray-900">
                Order by: {formatDate(basket.orderDeadline, timezone)}
              </span>
            </div>

            <div className="mb-6">
              <h3 className="font-medium text-gray-900 mb-2">Included Items</h3>
              <ul className="space-y-1">
                {baseItems.map((item) => (
                  <li key={item.id} className="text-sm text-gray-900">
                    {item.quantity}x {item.productName}
                  </li>
                ))}
              </ul>
            </div>

            {swapGroups.length > 0 && (
              <div className="mb-6">
                <h3 className="font-medium text-gray-900 mb-2">Swap Options</h3>
                <p className="text-sm text-gray-900 mb-3">
                  Choose your preferred alternatives
                </p>
                {swapGroups.map((group) => (
                  <div key={group.id} className="mb-4 p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm font-medium text-gray-900 mb-2">
                      {group.name || "Swap Group"} (pick {group.maxChoices})
                    </p>
                    <div className="space-y-1">
                      {group.items.map((item) => (
                        <label
                          key={item.id}
                          className="flex items-center gap-2 cursor-pointer"
                        >
                          <input
                            type="radio"
                            name={`swap-${group.id}`}
                            value={item.id}
                            checked={swapChoices[group.id] === item.id}
                            onChange={() =>
                              setSwapChoices((prev) => ({
                                ...prev,
                                [group.id]: item.id,
                              }))
                            }
                            className="h-4 w-4 text-green-600 focus:ring-green-500"
                          />
                          <span className="text-sm text-gray-900">
                            {item.quantity}x {item.productName}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Delivery Details</CardTitle>
            <p className="text-sm text-gray-900">
              Ordering as <strong>{customer.name}</strong> ({customer.email})
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="bg-red-50 text-red-700 text-sm p-3 rounded-md">
                  {error}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">
                  Delivery Address *
                </label>
                <Input
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  required
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">
                    City
                  </label>
                  <Input
                    value={deliveryCity}
                    onChange={(e) => setDeliveryCity(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">
                    Postal Code
                  </label>
                  <Input
                    value={deliveryPostalCode}
                    onChange={(e) => setDeliveryPostalCode(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">
                  Delivery Notes
                </label>
                <Textarea
                  value={deliveryNotes}
                  onChange={(e) => setDeliveryNotes(e.target.value)}
                  rows={2}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Placing order..." : "Place Order"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
