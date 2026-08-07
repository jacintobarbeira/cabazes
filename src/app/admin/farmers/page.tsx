"use client"

import { useState } from "react"
import { Button } from "@/components/Button"
import { Input } from "@/components/Form"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/Card"
import { Badge } from "@/components/Badge"
import { useFetch } from "@/hooks/useFetch"
import { useTranslation } from "@/lib/i18n/useTranslation"

interface Farmer {
  id: string
  email: string
  name: string | null
  phone: string | null
  disabled: boolean
  createdAt: string
}

export default function AdminFarmersPage() {
  const { t } = useTranslation()
  const { data, loading, reload: fetchFarmers } = useFetch<Farmer[]>("/api/admin/farmers")
  const farmers = data ?? []
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [formError, setFormError] = useState("")
  const [tempPassword, setTempPassword] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string; phrase: string[]; input: string } | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError("")
    setTempPassword(null)

    const method = editingId ? "PATCH" : "POST"
    const url = editingId ? `/api/admin/farmers/${editingId}` : "/api/admin/farmers"

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, phone }),
    })

    if (res.ok) {
      const data = await res.json()
      if (data.tempPassword) {
        setTempPassword(data.tempPassword)
      }
      resetForm()
      fetchFarmers()
    } else {
      const data = await res.json()
      setFormError(data.error || "Failed to save farmer")
    }
  }

  const handleEdit = (farmer: Farmer) => {
    setEditingId(farmer.id)
    setName(farmer.name || "")
    setEmail(farmer.email)
    setPhone(farmer.phone || "")
    setShowForm(true)
  }

  const handleToggleDisabled = async (id: string) => {
    const farmer = farmers.find((f) => f.id === id)
    if (!farmer) return

    const message = farmer.disabled
      ? t("adminFarmers.enableConfirm")
      : t("adminFarmers.enableWarning")

    if (!confirm(message)) return

    const res = await fetch(`/api/admin/farmers/${id}/toggle-disabled`, {
      method: "PATCH",
    })

    if (res.ok) {
      fetchFarmers()
    }
  }

  const handleDelete = (farmer: Farmer) => {
    import("@/lib/words").then(({ randomWords }) => {
      setDeleteConfirm({ id: farmer.id, name: farmer.name || farmer.email, phrase: randomWords(3), input: "" })
    })
  }

  const confirmDelete = async () => {
    if (!deleteConfirm) return
    if (deleteConfirm.input !== deleteConfirm.phrase.join(" ")) return

    const res = await fetch(`/api/admin/farmers/${deleteConfirm.id}`, {
      method: "DELETE",
    })

    if (res.ok) {
      setDeleteConfirm(null)
      fetchFarmers()
    }
  }

  const resetForm = () => {
    setShowForm(false)
    setEditingId(null)
    setName("")
    setEmail("")
    setPhone("")
    setFormError("")
  }

  if (loading) return <p className="text-gray-900">{t("common.loading")}</p>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t("nav.farmers")}</h1>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? t("common.cancel") : t("adminFarmers.addFarmer")}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? t("adminFarmers.editFarmer") : t("adminFarmers.newFarmer")}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {formError && (
                <div className="bg-red-50 text-red-700 text-sm p-3 rounded-md">
                  {formError}
                </div>
              )}
              {tempPassword && (
                <div className="bg-green-50 text-green-700 text-sm p-3 rounded-md">
                  {t("adminFarmers.created")} <strong>{tempPassword}</strong>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">{t("common.name")}</label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">{t("adminFarmers.email")}</label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={!!editingId}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">{t("common.phone")}</label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <div className="flex gap-2">
                <Button type="submit">{editingId ? t("common.update") : t("common.create")}</Button>
                <Button type="button" variant="outline" onClick={resetForm}>{t("common.cancel")}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6">
          {farmers.length === 0 ? (
            <p className="text-gray-900 text-sm">{t("adminFarmers.noFarmers")}</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 font-medium text-gray-900">{t("common.name")}</th>
                  <th className="text-left py-2 font-medium text-gray-900">{t("adminFarmers.email")}</th>
                  <th className="text-left py-2 font-medium text-gray-900">{t("common.phone")}</th>
                  <th className="text-left py-2 font-medium text-gray-900">{t("common.status")}</th>
                  <th className="text-right py-2 font-medium text-gray-900">{t("common.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {farmers.map((farmer) => (
                  <tr key={farmer.id} className="border-b border-gray-100">
                    <td className="py-2 font-medium text-gray-900">{farmer.name || "-"}</td>
                    <td className="py-2 text-gray-900">{farmer.email}</td>
                    <td className="py-2 text-gray-900">{farmer.phone || "-"}</td>
                    <td className="py-2 text-gray-900">
                      <Badge variant={farmer.disabled ? "danger" : "success"}>
                        {farmer.disabled ? t("common.disabled") : t("common.active")}
                      </Badge>
                    </td>
                    <td className="py-2 text-right">
                      <button
                        onClick={() => handleEdit(farmer)}
                        className="text-green-600 hover:text-green-700 mr-3"
                      >
                        {t("common.edit")}
                      </button>
                      <button
                        onClick={() => handleToggleDisabled(farmer.id)}
                        className="text-red-600 hover:text-red-700 mr-3"
                      >
                        {farmer.disabled ? t("common.enable") : t("common.disable")}
                      </button>
                      <button
                        onClick={() => handleDelete(farmer)}
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
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle>{t("adminFarmers.deleteFarmer")}</CardTitle>
              <p className="text-sm text-gray-900 mt-1">
                {t("adminFarmers.deleteWarning", { name: deleteConfirm.name })}
              </p>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-900 mb-3">
                {t("adminFarmers.typeConfirm")}
              </p>
              <p className="text-lg font-bold text-gray-900 mb-3 select-none">
                {deleteConfirm.phrase.join(" ")}
              </p>
              <Input
                value={deleteConfirm.input}
                onChange={(e) => setDeleteConfirm({ ...deleteConfirm, input: e.target.value })}
                placeholder={t("adminFarmers.typeWords")}
                className="mb-4"
              />
              <div className="flex gap-2">
                <Button
                  variant="danger"
                  onClick={confirmDelete}
                  disabled={deleteConfirm.input !== deleteConfirm.phrase.join(" ")}
                >
                  {t("common.delete")}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setDeleteConfirm(null)}
                >
                  {t("common.cancel")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
