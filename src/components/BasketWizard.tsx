"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/Button"
import { Input } from "@/components/Form"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/Card"
import {
  toLocalInput,
  toLocalDateInput,
  fromLocalInputToUTC,
  fromLocalDateToUTC,
} from "@/lib/dates"
import { useTranslation } from "@/lib/i18n/useTranslation"
import type { ProductDTO, BasketDTO } from "@/types/api"

type WizardItem = { productId: string }

export default function BasketWizard({ basketId }: { basketId?: string }) {
  const isEditing = !!basketId
  const { t } = useTranslation()
  const { data: session } = useSession()
  const timezone = session?.user?.timezone || "UTC"
  const router = useRouter()
  const [products, setProducts] = useState<ProductDTO[]>([])
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [orderDeadline, setOrderDeadline] = useState("")
  const [price, setPrice] = useState("")
  const [deliveryDay, setDeliveryDay] = useState("")
  const [allowedSwaps, setAllowedSwaps] = useState("3")
  const [selectedItems, setSelectedItems] = useState<WizardItem[]>([])
  const [swapItems, setSwapItems] = useState<WizardItem[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingBasket, setLoadingBasket] = useState(isEditing)
  const [blocked, setBlocked] = useState(false)
  const [step, setStep] = useState(1)
  const [error, setError] = useState("")

  useEffect(() => {
    fetch("/api/products")
      .then((res) => res.json())
      .then((data) => setProducts(data.filter((p: ProductDTO) => p.active)))
  }, [])

  useEffect(() => {
    if (!basketId) return
    let cancelled = false
    fetch(`/api/baskets/${basketId}`)
      .then(async (res) => {
        if (!res.ok) {
          if (!cancelled) setBlocked(true)
          return null
        }
        return res.json()
      })
      .then((data: BasketDTO | null) => {
        if (cancelled || !data) return
        if (data.published) {
          setBlocked(true)
          setLoadingBasket(false)
          return
        }
        setName(data.name)
        setDescription(data.description ?? "")
        setPrice(data.price)
        setOrderDeadline(toLocalInput(data.orderDeadline, timezone))
        setDeliveryDay(toLocalDateInput(data.deliveryDay, timezone))
        setAllowedSwaps(String(data.allowedSwaps))
        setSelectedItems(
          data.items
            .filter((i) => i.isBase)
            .map((i) => ({ productId: i.productId }))
        )
        setSwapItems(
          data.items
            .filter((i) => !i.isBase)
            .map((i) => ({ productId: i.productId }))
        )
        setLoadingBasket(false)
      })
    return () => {
      cancelled = true
    }
  }, [basketId, timezone])

  const addItem = (productId: string) => {
    if (!productId || selectedItems.some((i) => i.productId === productId)) return
    setSelectedItems([...selectedItems, { productId }])
  }

  const removeItem = (productId: string) => {
    setSelectedItems(selectedItems.filter((i) => i.productId !== productId))
  }

  const addSwapItem = (productId: string) => {
    if (!productId || swapItems.some((i) => i.productId === productId)) return
    setSwapItems([...swapItems, { productId }])
  }

  const removeSwapItem = (productId: string) => {
    setSwapItems(swapItems.filter((i) => i.productId !== productId))
  }

  const handleSubmit = async () => {
    setError("")
    setLoading(true)

    try {
      const orderDeadlineUTC = fromLocalInputToUTC(orderDeadline, timezone)
      const deliveryDayUTC = fromLocalDateToUTC(deliveryDay, timezone)

      if (orderDeadlineUTC >= deliveryDayUTC) {
        setError(t("basketWizard.deadlineError"))
        setLoading(false)
        return
      }

      const swapsAllowed = parseInt(allowedSwaps)
      if (isNaN(swapsAllowed) || swapsAllowed < 0) {
        setError(t("basketWizard.swapsError"))
        setLoading(false)
        return
      }

      const baseProductIds = selectedItems.map((i) => i.productId)
      const swapProductIds = swapItems.map((i) => i.productId)
      const overlap = baseProductIds.filter((p) => swapProductIds.includes(p))
      if (overlap.length > 0) {
        setError(t("basketWizard.overlapError"))
        setLoading(false)
        return
      }

      const basketPayload = {
        name,
        description,
        orderDeadline: orderDeadlineUTC.toISOString(),
        price,
        deliveryDay: deliveryDayUTC.toISOString(),
        allowedSwaps: allowedSwaps,
      }

      let basketIdResolved = basketId

      if (isEditing) {
        const res = await fetch(`/api/baskets/${basketId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(basketPayload),
        })

        if (!res.ok) {
          const errorData = await res.json()
          setError(errorData.error || "Failed to update basket")
          setLoading(false)
          return
        }
      } else {
        const basketRes = await fetch("/api/baskets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(basketPayload),
        })

        if (!basketRes.ok) {
          const errorData = await basketRes.json()
          setError(errorData.error || "Failed to create basket")
          setLoading(false)
          return
        }

        const basket = await basketRes.json()
        basketIdResolved = basket.id
      }

      const contentsRes = await fetch(`/api/baskets/${basketIdResolved}/contents`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          allowedSwaps,
          items: [
            ...selectedItems.map((i) => ({ ...i, isBase: true })),
            ...swapItems.map((i) => ({ ...i, isBase: false })),
          ],
        }),
      })

      if (!contentsRes.ok) {
        const errorData = await contentsRes.json()
        setError(errorData.error || "Failed to save basket contents")
        setLoading(false)
        return
      }

      router.push(`/farmer/baskets/${basketIdResolved}`)
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  if (loadingBasket) return <p className="text-gray-900">{t("common.loading")}</p>

  if (blocked) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-red-600">{t("basketWizard.publishedError")}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">
        {isEditing ? t("basketWizard.editBasket") : t("basketWizard.createBasket")}
      </h1>

      <div className="flex gap-2 mb-6">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={`flex-1 h-2 rounded ${s <= step ? "bg-green-600" : "bg-gray-200"}`}
          />
        ))}
      </div>

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("basketWizard.basketDetails")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">{t("basketWizard.nameLabel")}</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("basketWizard.namePlaceholder")} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">{t("common.description")}</label>
                <Input value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">{t("basketWizard.orderDeadline")}</label>
                  <Input type="datetime-local" value={orderDeadline} onChange={(e) => setOrderDeadline(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">{t("basketWizard.deliveryDay")}</label>
                  <Input type="date" value={deliveryDay} onChange={(e) => setDeliveryDay(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">{t("basketWizard.price")}</label>
                  <Input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">{t("basketWizard.allowedSwaps")}</label>
                  <Input type="number" min="0" value={allowedSwaps} onChange={(e) => setAllowedSwaps(e.target.value)} />
                </div>
              </div>
              {orderDeadline && deliveryDay && (
                <div>
                  {(() => {
                    const deadlineUTC = fromLocalInputToUTC(orderDeadline, timezone)
                    const deliveryUTC = fromLocalDateToUTC(deliveryDay, timezone)
                    const invalid = deadlineUTC >= deliveryUTC
                    return invalid ? (
                      <p className="text-sm text-red-600">{t("basketWizard.deadlineError")}</p>
                    ) : null
                  })()}
                </div>
              )}
              <Button
                onClick={() => {
                  setError("")
                  setStep(2)
                }}
                disabled={!name || !orderDeadline || !price || !deliveryDay || (() => {
                  const deadlineUTC = fromLocalInputToUTC(orderDeadline, timezone)
                  const deliveryUTC = fromLocalDateToUTC(deliveryDay, timezone)
                  return deadlineUTC >= deliveryUTC
                })()}
              >
                {t("basketWizard.nextItems")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("basketWizard.baseItems")}</CardTitle>
            <p className="text-sm text-gray-900">{t("basketWizard.baseItemsDesc")}</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex gap-2">
                <select
                  className="flex h-10 flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                  onChange={(e) => {
                    addItem(e.target.value)
                    e.target.value = ""
                  }}
                >
                  <option value="">{t("basketWizard.selectProduct")}</option>
                  {products
                    .filter((p) => !selectedItems.some((i) => i.productId === p.id))
                    .filter((p) => !swapItems.some((i) => i.productId === p.id))
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                </select>
              </div>

              {selectedItems.length > 0 && (
                <div className="space-y-2">
                  {selectedItems.map((item) => {
                    const product = products.find((p) => p.id === item.productId)
                    return (
                      <div key={item.productId} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <span className="text-sm text-gray-900">{product?.name}</span>
                        <div className="flex items-center gap-2">
                          <button onClick={() => removeItem(item.productId)} className="text-red-600 text-sm ml-2">
                            {t("basketWizard.remove")}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(1)}>{t("basketWizard.back")}</Button>
                <Button onClick={() => setStep(3)}>{t("basketWizard.nextSwaps")}</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("basketWizard.swapItems")}</CardTitle>
            <p className="text-sm text-gray-900">
              {t("basketWizard.swapItemsDesc", { count: parseInt(allowedSwaps) || 0 })}
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex gap-2">
                <select
                  className="flex h-10 flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                  onChange={(e) => {
                    addSwapItem(e.target.value)
                    e.target.value = ""
                  }}
                >
                  <option value="">{t("basketWizard.selectProduct")}</option>
                  {products
                    .filter((p) => !swapItems.some((i) => i.productId === p.id))
                    .filter((p) => !selectedItems.some((i) => i.productId === p.id))
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                </select>
              </div>

              {swapItems.length > 0 && (
                <div className="space-y-2">
                  {swapItems.map((item) => {
                    const product = products.find((p) => p.id === item.productId)
                    return (
                      <div key={item.productId} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <span className="text-sm text-gray-900">{product?.name}</span>
                        <div className="flex items-center gap-2">
                          <button onClick={() => removeSwapItem(item.productId)} className="text-red-600 text-sm ml-2">
                            {t("basketWizard.remove")}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {error && (
                <div className="bg-red-50 text-red-700 text-sm p-3 rounded-md">
                  {error}
                </div>
              )}

              <div className="flex gap-2 pt-4">
                <Button variant="outline" onClick={() => { setError(""); setStep(2) }}>{t("basketWizard.back")}</Button>
                <Button onClick={handleSubmit} disabled={loading}>
                  {loading ? t("basketWizard.saving") : isEditing ? t("basketWizard.saveChanges") : t("basketWizard.createBasketBtn")}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
