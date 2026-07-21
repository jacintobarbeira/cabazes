"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/Button"
import { Input, Textarea, Select } from "@/components/Form"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/Card"
import { COMMON_TIMEZONES } from "@/lib/dates"
import type { UserDTO } from "@/types/api"

export default function ProfilePage() {
  const [user, setUser] = useState<UserDTO | null>(null)
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [timezone, setTimezone] = useState("UTC")
  const [address, setAddress] = useState("")
  const [city, setCity] = useState("")
  const [postalCode, setPostalCode] = useState("")
  const [notes, setNotes] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch("/api/customers/me")
      .then((res) => res.json())
      .then((data) => {
        setUser(data)
        setName(data.name || "")
        setPhone(data.phone || "")
        setTimezone(data.timezone || "UTC")
        setAddress(data.address || "")
        setCity(data.city || "")
        setPostalCode(data.postalCode || "")
        setNotes(data.notes || "")
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setSaved(false)

    try {
      const res = await fetch("/api/customers/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, timezone, address, city, postalCode, notes }),
      })

      if (res.ok) {
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      }
    } catch {
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <p className="text-gray-900">Loading profile...</p>
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Profile</h1>
      <Card>
        <CardHeader>
          <CardTitle>Your Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {saved && (
              <div className="bg-green-50 text-green-700 text-sm p-3 rounded-md">
                Profile updated successfully!
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                Name
              </label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                Email
              </label>
              <Input value={user?.email || ""} disabled className="bg-gray-50" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                Timezone
              </label>
              <Select value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                {COMMON_TIMEZONES.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                Phone
              </label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                Delivery Address
              </label>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">
                  City
                </label>
                <Input value={city} onChange={(e) => setCity(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">
                  Postal Code
                </label>
                <Input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                Delivery Notes
              </label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
