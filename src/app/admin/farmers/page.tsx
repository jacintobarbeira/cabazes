"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/Button"
import { Input } from "@/components/Form"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/Card"
import { Badge } from "@/components/Badge"

interface Farmer {
  id: string
  email: string
  name: string | null
  phone: string | null
  disabled: boolean
  createdAt: string
}

export default function AdminFarmersPage() {
  const [farmers, setFarmers] = useState<Farmer[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [formError, setFormError] = useState("")
  const [tempPassword, setTempPassword] = useState<string | null>(null)

  const fetchFarmers = () => {
    fetch("/api/admin/farmers")
      .then((res) => res.json())
      .then((data) => {
        setFarmers(data)
        setLoading(false)
      })
  }

  useEffect(() => {
    fetchFarmers()
  }, [])

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
      ? "Are you sure you want to enable this farmer?"
      : `This will also disable ${farmer.disabled ? "" : "all helpers for "} this farmer. Continue?`

    if (!confirm(message)) return

    const res = await fetch(`/api/admin/farmers/${id}/toggle-disabled`, {
      method: "PATCH",
    })

    if (res.ok) {
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

  if (loading) return <p className="text-gray-900">Loading...</p>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Farmers</h1>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "+ Add Farmer"}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? "Edit Farmer" : "New Farmer"}</CardTitle>
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
                  Farmer created! Temp password: <strong>{tempPassword}</strong>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">Name</label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">Email *</label>
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
                <label className="block text-sm font-medium text-gray-900 mb-1">Phone</label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <div className="flex gap-2">
                <Button type="submit">{editingId ? "Update" : "Create"}</Button>
                <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6">
          {farmers.length === 0 ? (
            <p className="text-gray-900 text-sm">No farmers yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 font-medium text-gray-900">Name</th>
                  <th className="text-left py-2 font-medium text-gray-900">Email</th>
                  <th className="text-left py-2 font-medium text-gray-900">Phone</th>
                  <th className="text-left py-2 font-medium text-gray-900">Status</th>
                  <th className="text-right py-2 font-medium text-gray-900">Actions</th>
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
                        {farmer.disabled ? "Disabled" : "Active"}
                      </Badge>
                    </td>
                    <td className="py-2 text-right">
                      <button
                        onClick={() => handleEdit(farmer)}
                        className="text-green-600 hover:text-green-700 mr-3"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleToggleDisabled(farmer.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        {farmer.disabled ? "Enable" : "Disable"}
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
