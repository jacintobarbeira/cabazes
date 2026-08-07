"use client"

import { useState } from "react"
import { Button } from "@/components/Button"
import { Input, Textarea } from "@/components/Form"
import { Badge } from "@/components/Badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/Card"
import { useFetch } from "@/hooks/useFetch"
import { useTranslation } from "@/lib/i18n/useTranslation"
import type { UserDTO } from "@/types/api"

export default function CustomersPage() {
  const { t } = useTranslation()
  const { data, loading, reload: fetchCustomers } = useFetch<UserDTO[]>("/api/customers")
  const customers = data ?? []
  const [showForm, setShowForm] = useState(false)
  const [formError, setFormError] = useState("")
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [address, setAddress] = useState("")
  const [city, setCity] = useState("")
  const [postalCode, setPostalCode] = useState("")
  const [notes, setNotes] = useState("")

  const resetForm = () => {
    setShowForm(false)
    setName("")
    setEmail("")
    setPhone("")
    setAddress("")
    setCity("")
    setPostalCode("")
    setNotes("")
    setFormError("")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError("")
    setSaving(true)

    const res = await fetch("/api/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, phone, address, city, postalCode, notes }),
    })

    if (res.ok) {
      resetForm()
      fetchCustomers()
    } else {
      const data = await res.json()
      setFormError(data.error || t("customers.failedToCreate"))
    }
    setSaving(false)
  }

  if (loading) return <p className="text-gray-900">{t("common.loading")}</p>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t("customers.title", { count: customers.length })}</h1>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? t("common.cancel") : t("customers.addCustomer")}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{t("customers.newCustomer")}</CardTitle>
            <p className="text-sm text-gray-900">{t("customers.newCustomerHint")}</p>
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
                  <label className="block text-sm font-medium text-gray-900 mb-1">{t("customers.colName")}</label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">{t("customers.colEmail")}</label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">{t("common.phone")}</label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">{t("common.address")}</label>
                  <Input value={address} onChange={(e) => setAddress(e.target.value)} />
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
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">{t("common.notes")}</label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={saving}>
                  {saving ? t("common.loading") : t("customers.createCustomer")}
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>{t("common.cancel")}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6">
          {customers.length === 0 ? (
            <p className="text-gray-900 text-sm">{t("customers.noCustomers")}</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 font-medium text-gray-900">{t("customers.colName")}</th>
                  <th className="text-left py-2 font-medium text-gray-900">{t("customers.colEmail")}</th>
                  <th className="text-left py-2 font-medium text-gray-900">{t("customers.colPhone")}</th>
                  <th className="text-left py-2 font-medium text-gray-900">{t("customers.colAddress")}</th>
                  <th className="text-left py-2 font-medium text-gray-900">{t("customers.colStatus")}</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => (
                  <tr key={customer.id} className="border-b border-gray-100">
                    <td className="py-2 font-medium text-gray-900">{customer.name || "-"}</td>
                    <td className="py-2 text-gray-900">{customer.email}</td>
                    <td className="py-2 text-gray-900">{customer.phone || "-"}</td>
                    <td className="py-2 text-gray-900">
                      {customer.address}
                      {customer.city && `, ${customer.city}`}
                    </td>
                    <td className="py-2 text-gray-900">
                      <Badge variant={customer.verified ? "success" : "warning"}>
                        {customer.verified ? t("customers.verified") : t("customers.unverified")}
                      </Badge>
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
