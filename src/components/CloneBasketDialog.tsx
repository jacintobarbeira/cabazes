"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/Button"
import { Input } from "@/components/Form"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/Card"
import {
  fromLocalInputToUTC,
  fromLocalDateToUTC,
  toLocalInput,
  toLocalDateInput,
} from "@/lib/dates"
import { useTranslation } from "@/lib/i18n/useTranslation"

interface CloneBasketDialogProps {
  basketId: string
  basketName: string
  orderDeadline: string
  deliveryDay: string
  timezone: string
  onClose: () => void
}

export default function CloneBasketDialog({
  basketId,
  basketName,
  orderDeadline,
  deliveryDay,
  timezone,
  onClose,
}: CloneBasketDialogProps) {
  const { t } = useTranslation()
  const router = useRouter()
  const [name, setName] = useState(`${basketName} (copy)`)
  const [deadline, setDeadline] = useState(() => toLocalInput(orderDeadline, timezone))
  const [delivery, setDelivery] = useState(() => toLocalDateInput(deliveryDay, timezone))
  const [cloning, setCloning] = useState(false)
  const [error, setError] = useState("")

  const deadlineUTC = deadline ? fromLocalInputToUTC(deadline, timezone) : null
  const deliveryUTC = delivery ? fromLocalDateToUTC(delivery, timezone) : null
  const invalid = !!(deadlineUTC && deliveryUTC && deadlineUTC >= deliveryUTC)

  const handleClone = async () => {
    setCloning(true)
    setError("")
    const res = await fetch(`/api/baskets/${basketId}/clone`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        orderDeadline: deadlineUTC!.toISOString(),
        deliveryDay: deliveryUTC!.toISOString(),
      }),
    })

    if (res.ok) {
      const data = await res.json()
      router.push(`/farmer/baskets/${data.id}`)
    } else {
      const data = await res.json()
      setError(data.error || "Failed to clone basket")
      setCloning(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="w-full max-w-md mx-4">
        <CardHeader>
          <CardTitle>{t("cloneBasket.title")}</CardTitle>
          <p className="text-sm text-gray-900 mt-1">
            {t("cloneBasket.description", { name: basketName })}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="bg-red-50 text-red-700 text-sm p-3 rounded-md">
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              {t("cloneBasket.nameLabel")}
            </label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              {t("cloneBasket.orderDeadline")}
            </label>
            <Input
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              {t("cloneBasket.deliveryDay")}
            </label>
            <Input
              type="date"
              value={delivery}
              onChange={(e) => setDelivery(e.target.value)}
            />
          </div>
          {invalid && (
            <p className="text-sm text-red-600">
              {t("cloneBasket.deadlineError")}
            </p>
          )}
          <div className="flex gap-2">
            <Button
              onClick={handleClone}
              disabled={cloning || !name || !deadline || !delivery || invalid}
            >
              {cloning ? t("cloneBasket.cloning") : t("cloneBasket.cloneBtn")}
            </Button>
            <Button variant="outline" onClick={onClose}>
              {t("cloneBasket.cancel")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
