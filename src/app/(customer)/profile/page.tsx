"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/Button"
import { Input, Textarea, Select } from "@/components/Form"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/Card"
import { COMMON_TIMEZONES } from "@/lib/dates"
import { useTranslation } from "@/lib/i18n/useTranslation"
import type { UserDTO } from "@/types/api"

function hasSpecialChar(pw: string): boolean {
  const chars = "!@#$%^&*()_+-=[]{};:'\"\\|,./?"
  for (const c of chars) {
    if (pw.includes(c)) return true
  }
  return pw.includes("<") || pw.includes(">")
}

function getPasswordErrors(pw: string, t: (key: string) => string): string[] {
  const errors: string[] = []
  if (pw.length < 8) errors.push(t("auth.atLeast8Chars"))
  if (!/[A-Z]/.test(pw)) errors.push(t("auth.atLeastUpper"))
  if (!/[0-9]/.test(pw)) errors.push(t("auth.atLeastDigit"))
  if (!hasSpecialChar(pw)) errors.push(t("auth.atLeastSpecial"))
  return errors
}

interface Farmer {
  id: string
  name: string | null
  email: string
}

export default function ProfilePage() {
  const { t } = useTranslation()
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

  const [myFarmers, setMyFarmers] = useState<Farmer[]>([])
  const [allFarmers, setAllFarmers] = useState<Farmer[]>([])
  const [showAddFarmer, setShowAddFarmer] = useState(false)
  const [addingFarmer, setAddingFarmer] = useState(false)
  const [farmerError, setFarmerError] = useState("")

  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmNewPassword, setConfirmNewPassword] = useState("")
  const [pwSaving, setPwSaving] = useState(false)
  const [pwSaved, setPwSaved] = useState(false)
  const [pwError, setPwError] = useState("")
  const [pwErrors, setPwErrors] = useState<string[]>([])

  useEffect(() => {
    fetch("/api/customers/me")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load")
        return res.json()
      })
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

    fetch("/api/customers/me/farmers")
      .then((res) => res.json())
      .then((data) => setMyFarmers(data))
      .catch(() => {})

    fetch("/api/farmers")
      .then((res) => res.json())
      .then((data) => setAllFarmers(data))
      .catch(() => {})
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

  const handleAddFarmer = async (farmerId: string) => {
    setFarmerError("")
    setAddingFarmer(true)
    try {
      const res = await fetch("/api/customers/me/farmers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ farmerId }),
      })
      const data = await res.json()
      if (res.ok) {
        setMyFarmers((prev) => [...prev, allFarmers.find((f) => f.id === farmerId)!].filter(Boolean))
        setShowAddFarmer(false)
      } else {
        setFarmerError(data.error)
      }
    } catch {
      setFarmerError(t("common.errorOccurred") || "Failed")
    } finally {
      setAddingFarmer(false)
    }
  }

  const handleRemoveFarmer = async (farmerId: string) => {
    if (myFarmers.length <= 1) {
      setFarmerError(t("profile.lastFarmerWarning"))
      return
    }
    try {
      const res = await fetch(`/api/customers/me/farmers?farmerId=${farmerId}`, {
        method: "DELETE",
      })
      const data = await res.json()
      if (res.ok) {
        setMyFarmers((prev) => prev.filter((f) => f.id !== farmerId))
      } else {
        setFarmerError(data.error)
      }
    } catch {
      setFarmerError(t("common.errorOccurred") || "Failed")
    }
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setPwError("")
    setPwSaved(false)
    setPwErrors([])

    if (newPassword !== confirmNewPassword) {
      setPwError(t("resetPassword.noMatch"))
      return
    }

    const errs = getPasswordErrors(newPassword, t)
    if (errs.length > 0) {
      setPwErrors(errs)
      return
    }

    setPwSaving(true)
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      const data = await res.json()
      if (res.ok) {
        setPwSaved(true)
        setCurrentPassword("")
        setNewPassword("")
        setConfirmNewPassword("")
        setTimeout(() => setPwSaved(false), 3000)
      } else {
        setPwError(data.error)
      }
    } catch {
      setPwError(t("auth.errorOccurred"))
    } finally {
      setPwSaving(false)
    }
  }

  const availableFarmers = allFarmers.filter((f) => !myFarmers.some((mf) => mf.id === f.id))

  if (loading) {
    return <p className="text-gray-900">{t("profile.loading")}</p>
  }

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">{t("profile.title")}</h1>
      <Card>
        <CardHeader>
          <CardTitle>{t("profile.yourDetails")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {saved && (
              <div className="bg-green-50 text-green-700 text-sm p-3 rounded-md">
                {t("profile.updated")}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                {t("profile.name")}
              </label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                {t("profile.email")}
              </label>
              <Input value={user?.email || ""} disabled className="bg-gray-50" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                {t("profile.timezone")}
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
                {t("profile.phone")}
              </label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                {t("profile.deliveryAddress")}
              </label>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">
                  {t("profile.city")}
                </label>
                <Input value={city} onChange={(e) => setCity(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-1">
                  {t("profile.postalCode")}
                </label>
                <Input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                {t("profile.deliveryNotes")}
              </label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? t("profile.saving") : t("profile.saveChanges")}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("profile.myFarmers")} ({myFarmers.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {farmerError && (
            <div className="bg-red-50 text-red-700 text-sm p-3 rounded-md">{farmerError}</div>
          )}
          {myFarmers.map((farmer) => (
            <div key={farmer.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
              <span className="text-sm text-gray-900">{farmer.name || farmer.email}</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleRemoveFarmer(farmer.id)}
                disabled={myFarmers.length <= 1}
              >
                {t("profile.removeFarmer")}
              </Button>
            </div>
          ))}
          {showAddFarmer ? (
            <div className="flex gap-2 items-center">
              <Select
                onChange={(e) => {
                  if (e.target.value) handleAddFarmer(e.target.value)
                }}
                disabled={addingFarmer}
              >
                <option value="">{t("profile.addFarmer")}...</option>
                {availableFarmers.map((f) => (
                  <option key={f.id} value={f.id}>{f.name || f.email}</option>
                ))}
              </Select>
              <Button size="sm" variant="outline" onClick={() => setShowAddFarmer(false)}>
                {t("common.cancel")}
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setShowAddFarmer(true)}>
              + {t("profile.addFarmer")}
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("profile.changePassword")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            {pwSaved && (
              <div className="bg-green-50 text-green-700 text-sm p-3 rounded-md">
                {t("profile.passwordUpdated")}
              </div>
            )}
            {pwError && (
              <div className="bg-red-50 text-red-700 text-sm p-3 rounded-md">{pwError}</div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                {t("profile.currentPassword")}
              </label>
              <Input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                {t("profile.newPassword")}
              </label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value)
                  setPwErrors([])
                }}
                required
                minLength={8}
              />
              {pwErrors.length > 0 && (
                <ul className="text-sm text-red-600 mt-1 space-y-0.5">
                  {pwErrors.map((err) => (
                    <li key={err} className="flex items-center gap-1">
                      <span>•</span> {err}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                {t("profile.confirmNewPassword")}
              </label>
              <Input
                type="password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <Button type="submit" disabled={pwSaving}>
              {pwSaving ? t("profile.saving") : t("profile.changePassword")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
