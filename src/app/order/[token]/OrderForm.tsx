"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Button } from "@/components/Button"
import { Input, Textarea } from "@/components/Form"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/Card"
import { Badge } from "@/components/Badge"
import { formatDate, formatDateOnly } from "@/lib/dates"
import { useTranslation } from "@/lib/i18n/useTranslation"
import { LanguageSwitcher } from "@/components/LanguageSwitcher"
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
  mode?: "token" | "session"
}

export default function OrderForm({ basket, customer, token, mode = "token" }: OrderFormProps) {
  const { t } = useTranslation()
  const { data: session } = useSession()
  const router = useRouter()
  const timezone = session?.user?.timezone || "UTC"
  const [deliveryMode, setDeliveryMode] = useState<"customer" | "point">("customer")
  const [deliveryPointId, setDeliveryPointId] = useState("")
  const [deliveryAddress, setDeliveryAddress] = useState(customer.address)
  const [deliveryCity, setDeliveryCity] = useState(customer.city)
  const [deliveryPostalCode, setDeliveryPostalCode] = useState(customer.postalCode)
  const [deliveryNotes, setDeliveryNotes] = useState(customer.notes)
  const [swaps, setSwaps] = useState<{ baseItemId: string; swapItemId: string }[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          basketId: basket.id,
          token: mode === "token" ? token : undefined,
          deliveryAddress,
          deliveryCity,
          deliveryPostalCode,
          deliveryNotes,
          deliveryPointId: deliveryMode === "point" ? deliveryPointId : undefined,
          swapChoices: swaps.filter((s) => s.baseItemId && s.swapItemId),
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || t("orderForm.failedToPlace"))
        return
      }

      setSuccess(true)
    } catch {
      setError(t("orderForm.failedToPlace"))
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
            <h2 className="text-xl font-semibold text-gray-900">{t("orderForm.orderPlaced")}</h2>
            <p className="mt-2 text-gray-900">
              {t("orderForm.deliveredOn", { name: basket.name, date: formatDateOnly(basket.deliveryDay, timezone) })}
            </p>
            {mode === "session" && (
              <div className="mt-4">
                <Button variant="outline" onClick={() => router.push("/baskets")}>
                  {t("basketOrder.backToBaskets")}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  const baseItems = basket.items.filter((item) => item.isBase)
  const swapItems = basket.items.filter((item) => !item.isBase)
  const maxSwaps = basket.allowedSwaps

  const addSwap = () => {
    if (swaps.length >= maxSwaps) return
    setSwaps([...swaps, { baseItemId: "", swapItemId: "" }])
  }

  const updateSwap = (index: number, field: "baseItemId" | "swapItemId", value: string) => {
    setSwaps((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)))
  }

  const removeSwap = (index: number) => {
    setSwaps((prev) => prev.filter((_, i) => i !== index))
  }

  const chosenBaseIds = swaps.map((s) => s.baseItemId)
  const chosenSwapIds = swaps.map((s) => s.swapItemId)

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          {mode === "session" ? (
            <button
              onClick={() => router.push("/baskets")}
              className="text-sm text-green-600 hover:text-green-700"
            >
              ← {t("basketOrder.backToBaskets")}
            </button>
          ) : (
            <span />
          )}
          <LanguageSwitcher />
        </div>
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
                {t("orderForm.orderBy")}: {formatDate(basket.orderDeadline, timezone)}
              </span>
            </div>

            <div className="mb-6">
              <h3 className="font-medium text-gray-900 mb-2">{t("orderForm.includedItems")}</h3>
              <ul className="space-y-1">
                {baseItems.map((item) => (
                  <li key={item.id} className="text-sm text-gray-900">
                    {item.productName}
                  </li>
                ))}
              </ul>
            </div>

            {swapItems.length > 0 && (
              <div className="mb-6">
                <h3 className="font-medium text-gray-900 mb-2">{t("orderForm.swapOptions")}</h3>
                <p className="text-sm text-gray-900 mb-3">
                  {t("orderForm.swapInstructions", { count: maxSwaps })}
                </p>

                <div className="flex flex-wrap gap-2 mb-4">
                  {swapItems.map((item) => (
                    <span
                      key={item.id}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-green-50 text-green-700 text-sm rounded"
                    >
                      {item.productName}
                    </span>
                  ))}
                </div>

                {swaps.map((swap, index) => (
                  <div key={index} className="mb-3 p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-900">{t("orderForm.swapLabel", { number: index + 1 })}</span>
                      <button
                        type="button"
                        onClick={() => removeSwap(index)}
                        className="text-red-600 text-sm"
                      >
                        {t("orderForm.remove")}
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-900 mb-1">{t("orderForm.removeBaseItem")}</label>
                        <select
                          value={swap.baseItemId}
                          onChange={(e) => updateSwap(index, "baseItemId", e.target.value)}
                          className="w-full h-10 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                        >
                          <option value="">{t("orderForm.selectBaseItem")}</option>
                          {baseItems
                            .filter((item) => item.id === swap.baseItemId || !chosenBaseIds.includes(item.id))
                            .map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.productName}
                              </option>
                            ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-900 mb-1">{t("orderForm.addSwapItem")}</label>
                        <select
                          value={swap.swapItemId}
                          onChange={(e) => updateSwap(index, "swapItemId", e.target.value)}
                          className="w-full h-10 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                        >
                          <option value="">{t("orderForm.selectSwapItem")}</option>
                          {swapItems
                            .filter((item) => item.id === swap.swapItemId || !chosenSwapIds.includes(item.id))
                            .map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.productName}
                              </option>
                            ))}
                        </select>
                      </div>
                    </div>
                  </div>
                ))}

                {swaps.length < maxSwaps && (
                  <Button type="button" variant="outline" onClick={addSwap}>
                    {t("orderForm.addSwap")}
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("orderForm.deliveryDetails")}</CardTitle>
            <p className="text-sm text-gray-900">
              {t("orderForm.orderingAs", { name: customer.name, email: customer.email })}
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="bg-red-50 text-red-700 text-sm p-3 rounded-md">
                  {error}
                </div>
              )}

              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-900">
                  {t("orderForm.deliveryMethod")}
                </label>
                <label className="flex items-center gap-2 p-2 rounded border border-gray-300 bg-white cursor-pointer">
                  <input
                    type="radio"
                    name="deliveryMethod"
                    checked={deliveryMode === "customer"}
                    onChange={() => setDeliveryMode("customer")}
                  />
                  <span className="text-sm text-gray-900">
                    {t("orderForm.deliverToMyAddress")}
                    <span className="block text-xs text-gray-500">
                      {customer.address || t("orderForm.noAddressOnFile")}
                    </span>
                  </span>
                </label>
                {basket.deliveryPoints.length > 0 && (
                  <label className="flex items-center gap-2 p-2 rounded border border-gray-300 bg-white cursor-pointer">
                    <input
                      type="radio"
                      name="deliveryMethod"
                      checked={deliveryMode === "point"}
                      onChange={() => setDeliveryMode("point")}
                    />
                    <span className="text-sm text-gray-900">
                      {t("orderForm.deliverToDeliveryPoint")}
                    </span>
                  </label>
                )}
              </div>

              {deliveryMode === "point" && basket.deliveryPoints.length > 0 ? (
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">
                    {t("orderForm.selectDeliveryPoint")}
                  </label>
                  <select
                    value={deliveryPointId}
                    onChange={(e) => setDeliveryPointId(e.target.value)}
                    required
                    className="w-full h-10 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                  >
                    <option value="">{t("orderForm.selectDeliveryPointPlaceholder")}</option>
                    {basket.deliveryPoints.map((point) => (
                      <option key={point.id} value={point.id}>
                        {point.name} — {point.address}
                        {point.city ? `, ${point.city}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-1">
                      {t("orderForm.deliveryAddress")}
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
                        {t("common.city")}
                      </label>
                      <Input
                        value={deliveryCity}
                        onChange={(e) => setDeliveryCity(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-1">
                        {t("common.postalCode")}
                      </label>
                      <Input
                        value={deliveryPostalCode}
                        onChange={(e) => setDeliveryPostalCode(e.target.value)}
                      />
                    </div>
                  </div>
                </>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">
                  {t("orderForm.deliveryNotes")}
                </label>
                <Textarea
                  value={deliveryNotes}
                  onChange={(e) => setDeliveryNotes(e.target.value)}
                  rows={2}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? t("orderForm.placingOrder") : t("orderForm.placeOrder")}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
