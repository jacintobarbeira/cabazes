"use client"

import { useState } from "react"
import { Button } from "@/components/Button"
import { Input } from "@/components/Form"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/Card"
import { Badge } from "@/components/Badge"
import { useFetch } from "@/hooks/useFetch"
import { useTranslation } from "@/lib/i18n/useTranslation"

interface Helper {
  id: string
  email: string
  name: string | null
  phone: string | null
  disabled: boolean
  createdAt: string
}

export default function HelpersPage() {
  const { t } = useTranslation()
  const { data, loading, reload: fetchHelpers } = useFetch<Helper[]>("/api/farmer/helpers")
  const helpers = data ?? []
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [formError, setFormError] = useState("")
  const [tempPassword, setTempPassword] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError("")
    setTempPassword(null)

    const res = await fetch("/api/farmer/helpers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, phone }),
    })

    if (res.ok) {
      const data = await res.json()
      setTempPassword(data.tempPassword)
      setName("")
      setEmail("")
      setPhone("")
      fetchHelpers()
    } else {
      const data = await res.json()
      setFormError(data.error || t("helpers.failedToCreate"))
    }
  }

  const handleToggleDisabled = async (id: string) => {
    const res = await fetch(`/api/farmer/helpers/${id}`, {
      method: "PATCH",
    })

    if (res.ok) {
      fetchHelpers()
    }
  }

  if (loading) return <p className="text-gray-900">{t("common.loading")}</p>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t("helpers.title")}</h1>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? t("helpers.cancel") : t("helpers.addHelper")}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{t("helpers.newHelper")}</CardTitle>
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
                  {t("helpers.created")} <strong>{tempPassword}</strong>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">{t("helpers.name")}</label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">{t("helpers.email")}</label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">{t("helpers.phone")}</label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <Button type="submit">{t("helpers.createHelper")}</Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6">
          {helpers.length === 0 ? (
            <p className="text-gray-900 text-sm">{t("helpers.noHelpers")}</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 font-medium text-gray-900">{t("helpers.colName")}</th>
                  <th className="text-left py-2 font-medium text-gray-900">{t("helpers.colEmail")}</th>
                  <th className="text-left py-2 font-medium text-gray-900">{t("helpers.colPhone")}</th>
                  <th className="text-left py-2 font-medium text-gray-900">{t("helpers.colStatus")}</th>
                  <th className="text-right py-2 font-medium text-gray-900">{t("helpers.colActions")}</th>
                </tr>
              </thead>
              <tbody>
                {helpers.map((helper) => (
                  <tr key={helper.id} className="border-b border-gray-100">
                    <td className="py-2 font-medium text-gray-900">{helper.name || "-"}</td>
                    <td className="py-2 text-gray-900">{helper.email}</td>
                    <td className="py-2 text-gray-900">{helper.phone || "-"}</td>
                    <td className="py-2 text-gray-900">
                      <Badge variant={helper.disabled ? "danger" : "success"}>
                        {helper.disabled ? t("common.disabled") : t("common.active")}
                      </Badge>
                    </td>
                    <td className="py-2 text-right">
                      <button
                        onClick={() => handleToggleDisabled(helper.id)}
                        className="text-green-600 hover:text-green-700"
                      >
                        {helper.disabled ? t("helpers.enable") : t("helpers.disable")}
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
