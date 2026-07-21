"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/Button"
import { Input } from "@/components/Form"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/Card"
import { COMMON_TIMEZONES } from "@/lib/dates"
import type { UserDTO } from "@/types/api"

export default function SettingsPage() {
  const [user, setUser] = useState<UserDTO | null>(null)
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [timezone, setTimezone] = useState("UTC")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch("/api/farmer/me")
      .then((res) => res.json())
      .then((data) => {
        setUser(data)
        setName(data.name || "")
        setPhone(data.phone || "")
        setTimezone(data.timezone || "UTC")
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setSaved(false)

    try {
      const res = await fetch("/api/farmer/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, timezone }),
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
    return <p className="text-gray-900">Loading settings...</p>
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Profile Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {saved && (
              <div className="bg-green-50 text-green-700 text-sm p-3 rounded-md">
                Settings updated successfully!
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
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                {COMMON_TIMEZONES.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                Phone
              </label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
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
