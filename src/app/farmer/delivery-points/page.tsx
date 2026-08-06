"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/Button"
import { Input } from "@/components/Form"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/Card"
import { useTranslation } from "@/lib/i18n/useTranslation"
import type { DeliveryPointDTO } from "@/types/api"

export default function DeliveryPointsPage() {
  const { t } = useTranslation()
  const [points, setPoints] = useState<DeliveryPointDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [address, setAddress] = useState("")
  const [city, setCity] = useState("")
  const [postalCode, setPostalCode] = useState("")
  const [formError, setFormError] = useState("")
  const [deleteError, setDeleteError] = useState("")

  const fetchPoints = () => {
    fetch("/api/delivery-points")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load")
        return res.json()
      })
      .then((data) => {
        setPoints(data)
        setLoading(false)
      })
      .catch(() => {
        setPoints([])
        setLoading(false)
      })
  }

  useEffect(() => {
    fetchPoints()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError("")
    setDeleteError("")

    const method = editingId ? "PATCH" : "POST"
    const url = editingId ? `/api/delivery-points/${editingId}` : "/api/delivery-points"

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, address, city, postalCode }),
    })

    if (res.ok) {
      resetForm()
      fetchPoints()
    } else {
      const data = await res.json()
      setFormError(data.error || t("deliveryPoints.failedToSave"))
    }
  }

  const handleEdit = (point: DeliveryPointDTO) => {
    setEditingId(point.id)
    setName(point.name)
    setAddress(point.address)
    setCity(point.city || "")
    setPostalCode(point.postalCode || "")
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    setDeleteError("")
    const res = await fetch(`/api/delivery-points/${id}`, { method: "DELETE" })
    if (res.ok) {
      fetchPoints()
    } else {
      const data = await res.json()
      setDeleteError(data.error || t("deliveryPoints.failedToDelete"))
    }
  }

  const resetForm = () => {
    setShowForm(false)
    setEditingId(null)
    setName("")
    setAddress("")
    setCity("")
    setPostalCode("")
    setFormError("")
  }

  if (loading) return <p className="text-gray-900">{t("common.loading")}</p>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t("deliveryPoints.title")}</h1>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? t("common.cancel") : t("deliveryPoints.addPoint")}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? t("deliveryPoints.editPoint") : t("deliveryPoints.newPoint")}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {formError && (
                <div className="bg-red-50 text-red-700 text-sm p-3 rounded-md">
                  {formError}
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">{t("deliveryPoints.nameLabel")}</label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">{t("deliveryPoints.addressLabel")}</label>
                  <Input value={address} onChange={(e) => setAddress(e.target.value)} required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">{t("common.city")}</label>
                  <Input value={city} onChange={(e) => setCity(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">{t("common.postalCode")}</label>
                  <Input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} />
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit">{editingId ? t("common.update") : t("common.create")}</Button>
                <Button type="button" variant="outline" onClick={resetForm}>{t("common.cancel")}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {deleteError && (
        <div className="bg-red-50 text-red-700 text-sm p-3 rounded-md">
          {deleteError}
        </div>
      )}

      <Card>
        <CardContent className="pt-6">
          {points.length === 0 ? (
            <p className="text-gray-900 text-sm">{t("deliveryPoints.noPoints")}</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 font-medium text-gray-900">{t("deliveryPoints.colName")}</th>
                  <th className="text-left py-2 font-medium text-gray-900">{t("deliveryPoints.colAddress")}</th>
                  <th className="text-right py-2 font-medium text-gray-900">{t("common.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {points.map((point) => (
                  <tr key={point.id} className="border-b border-gray-100">
                    <td className="py-2 font-medium text-gray-900">{point.name}</td>
                    <td className="py-2 text-gray-900">
                      {point.address}
                      {point.city ? `, ${point.city}` : ""}
                      {point.postalCode ? ` ${point.postalCode}` : ""}
                    </td>
                    <td className="py-2 text-right">
                      <button
                        onClick={() => handleEdit(point)}
                        className="text-green-600 hover:text-green-700 mr-3"
                      >
                        {t("common.edit")}
                      </button>
                      <button
                        onClick={() => handleDelete(point.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        {t("common.delete")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
