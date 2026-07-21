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
import type { ProductDTO } from "@/types/api"

export default function NewBasketPage() {
  const { data: session } = useSession()
  const timezone = session?.user?.timezone || "UTC"
  const router = useRouter()
  const [products, setProducts] = useState<ProductDTO[]>([])
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [orderDeadline, setOrderDeadline] = useState("")
  const [price, setPrice] = useState("")
  const [deliveryDay, setDeliveryDay] = useState("")
  const [selectedItems, setSelectedItems] = useState<{ productId: string; quantity: number }[]>([])
  const [swapGroups, setSwapGroups] = useState<{ name: string; maxChoices: number; productIds: string[] }[]>([])
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState(1)
  const [error, setError] = useState("")

  useEffect(() => {
    fetch("/api/products")
      .then((res) => res.json())
      .then((data) => setProducts(data.filter((p: ProductDTO) => p.active)))
  }, [])

  const addItem = (productId: string) => {
    if (!productId || selectedItems.some((i) => i.productId === productId)) return
    setSelectedItems([...selectedItems, { productId, quantity: 1 }])
  }

  const removeItem = (productId: string) => {
    setSelectedItems(selectedItems.filter((i) => i.productId !== productId))
  }

  const addSwapGroup = () => {
    setSwapGroups([...swapGroups, { name: "", maxChoices: 1, productIds: [] }])
  }

  const updateSwapGroup = (index: number, field: string, value: string | number) => {
    const updated = [...swapGroups]
    updated[index] = { ...updated[index], [field]: value }
    setSwapGroups(updated)
  }

  const addProductToSwapGroup = (groupIndex: number, productId: string) => {
    if (!productId) return
    const updated = [...swapGroups]
    if (!updated[groupIndex].productIds.includes(productId)) {
      updated[groupIndex].productIds.push(productId)
    }
    setSwapGroups(updated)
  }

  const removeProductFromSwapGroup = (groupIndex: number, productId: string) => {
    const updated = [...swapGroups]
    updated[groupIndex].productIds = updated[groupIndex].productIds.filter((id) => id !== productId)
    setSwapGroups(updated)
  }

  const handleSubmit = async () => {
    setError("")
    setLoading(true)

    try {
      const orderDeadlineUTC = fromLocalInputToUTC(orderDeadline, timezone)
      const deliveryDayUTC = fromLocalDateToUTC(deliveryDay, timezone)

      if (orderDeadlineUTC >= deliveryDayUTC) {
        setError("Order deadline must be before the delivery day")
        setLoading(false)
        return
      }

      const unnamedGroups = swapGroups.filter((g) => !g.name.trim())
      if (unnamedGroups.length > 0) {
        setError("All swap groups must have a name")
        setLoading(false)
        return
      }

      const basketRes = await fetch("/api/baskets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          orderDeadline: orderDeadlineUTC.toISOString(),
          price,
          deliveryDay: deliveryDayUTC.toISOString(),
        }),
      })

      if (!basketRes.ok) {
        const errorData = await basketRes.json()
        setError(errorData.error || "Failed to create basket")
        setLoading(false)
        return
      }

      const basket = await basketRes.json()

      for (const item of selectedItems) {
        await fetch(`/api/baskets/${basket.id}/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            productId: item.productId,
            quantity: item.quantity,
            isBase: true,
          }),
        })
      }

      for (const group of swapGroups) {
        const groupRes = await fetch(`/api/baskets/${basket.id}/swap-groups`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: group.name, maxChoices: group.maxChoices }),
        })

        const groupData = await groupRes.json()

        for (const productId of group.productIds) {
          await fetch(`/api/baskets/${basket.id}/items`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              productId,
              quantity: 1,
              isBase: false,
              swapGroupId: groupData.id,
            }),
          })
        }
      }

      router.push(`/farmer/baskets/${basket.id}`)
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Create Basket</h1>

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
            <CardTitle>Basket Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">Name *</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Summer Basket" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">Description</label>
                <Input value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">Order Deadline *</label>
                  <Input type="datetime-local" value={orderDeadline} onChange={(e) => setOrderDeadline(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">Delivery Day *</label>
                  <Input type="date" value={deliveryDay} onChange={(e) => setDeliveryDay(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">Price (€) *</label>
                <Input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
              </div>
              {orderDeadline && deliveryDay && (
                <div>
                  {(() => {
                    const deadlineUTC = fromLocalInputToUTC(orderDeadline, timezone)
                    const deliveryUTC = fromLocalDateToUTC(deliveryDay, timezone)
                    const invalid = deadlineUTC >= deliveryUTC
                    return invalid ? (
                      <p className="text-sm text-red-600">Order deadline must be before the delivery day</p>
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
                Next: Add Items
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Base Items</CardTitle>
            <p className="text-sm text-gray-900">Items that are always included in this basket</p>
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
                  <option value="">Select a product...</option>
                  {products
                    .filter((p) => !selectedItems.some((i) => i.productId === p.id))
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.unit})
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
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => {
                              const updated = selectedItems.map((i) =>
                                i.productId === item.productId ? { ...i, quantity: parseInt(e.target.value) || 1 } : i
                              )
                              setSelectedItems(updated)
                            }}
                            className="w-16 h-8 rounded border border-gray-300 text-sm text-center"
                          />
                          <span className="text-xs text-gray-900">{product?.unit}</span>
                          <button onClick={() => removeItem(item.productId)} className="text-red-600 text-sm ml-2">
                            Remove
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
                <Button onClick={() => setStep(3)}>Next: Swap Groups</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Swap Groups</CardTitle>
            <p className="text-sm text-gray-900">Optional: Define groups of items customers can choose from</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {swapGroups.map((group, index) => (
                <div key={index} className="p-4 border border-gray-200 rounded-lg space-y-3">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Group name (e.g. Leafy Greens)"
                      value={group.name}
                      onChange={(e) => updateSwapGroup(index, "name", e.target.value)}
                    />
                    <div className="flex items-center gap-1">
                      <span className="text-sm text-gray-900">Pick</span>
                      <input
                        type="number"
                        min="1"
                        value={group.maxChoices}
                        onChange={(e) => updateSwapGroup(index, "maxChoices", parseInt(e.target.value) || 1)}
                        className="w-12 h-10 rounded border border-gray-300 text-sm text-center"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <select
                      className="flex h-10 flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                      onChange={(e) => {
                        addProductToSwapGroup(index, e.target.value)
                        e.target.value = ""
                      }}
                    >
                      <option value="">Add product to this group...</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.unit})
                        </option>
                      ))}
                    </select>
                  </div>
                  {group.productIds.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {group.productIds.map((productId) => {
                        const product = products.find((p) => p.id === productId)
                        return (
                          <span
                            key={productId}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-green-50 text-green-700 text-sm rounded"
                          >
                            {product?.name}
                            <button
                              onClick={() => removeProductFromSwapGroup(index, productId)}
                              className="text-green-900 hover:text-red-600"
                            >
                              ×
                            </button>
                          </span>
                        )
                      })}
                    </div>
                  )}
                </div>
              ))}

              <Button variant="outline" onClick={addSwapGroup}>+ Add Swap Group</Button>

              {error && (
                <div className="bg-red-50 text-red-700 text-sm p-3 rounded-md">
                  {error}
                </div>
              )}

              <div className="flex gap-2 pt-4">
                <Button variant="outline" onClick={() => { setError(""); setStep(2) }}>Back</Button>
                <Button onClick={handleSubmit} disabled={loading}>
                  {loading ? "Creating..." : "Create Basket"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
