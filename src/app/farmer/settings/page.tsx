"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/Button"
import { Input } from "@/components/Form"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/Card"
import { useTranslation } from "@/lib/i18n/useTranslation"
import { COMMON_TIMEZONES } from "@/lib/dates"
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

export default function SettingsPage() {
  const { t } = useTranslation()
  const [user, setUser] = useState<UserDTO | null>(null)
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [senderEmail, setSenderEmail] = useState("")
  const [timezone, setTimezone] = useState("UTC")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmNewPassword, setConfirmNewPassword] = useState("")
  const [pwSaving, setPwSaving] = useState(false)
  const [pwSaved, setPwSaved] = useState(false)
  const [pwError, setPwError] = useState("")
  const [pwErrors, setPwErrors] = useState<string[]>([])

  useEffect(() => {
    fetch("/api/farmer/me")
      .then((res) => res.json())
      .then((data) => {
        setUser(data)
        setName(data.name || "")
        setPhone(data.phone || "")
        setSenderEmail(data.senderEmail || "")
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
        body: JSON.stringify({ name, phone, timezone, senderEmail: senderEmail || null }),
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

  if (loading) {
    return <p className="text-gray-900">{t("settings.loading")}</p>
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">{t("settings.title")}</h1>

      <Card>
        <CardHeader>
          <CardTitle>{t("settings.profileSettings")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {saved && (
              <div className="bg-green-50 text-green-700 text-sm p-3 rounded-md">
                {t("settings.updated")}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                {t("settings.name")}
              </label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                {t("settings.email")}
              </label>
              <Input value={user?.email || ""} disabled className="bg-gray-50" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                {t("settings.timezone")}
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
                {t("settings.phone")}
              </label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                {t("settings.senderEmail")}
              </label>
              <Input
                value={senderEmail}
                onChange={(e) => setSenderEmail(e.target.value)}
                placeholder={t("settings.senderEmailPlaceholder")}
                type="email"
              />
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? t("settings.saving") : t("settings.saveChanges")}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("settings.changePassword")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            {pwSaved && (
              <div className="bg-green-50 text-green-700 text-sm p-3 rounded-md">
                {t("settings.passwordUpdated")}
              </div>
            )}
            {pwError && (
              <div className="bg-red-50 text-red-700 text-sm p-3 rounded-md">{pwError}</div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                {t("settings.currentPassword")}
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
                {t("settings.newPassword")}
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
                {t("settings.confirmNewPassword")}
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
              {pwSaving ? t("settings.saving") : t("settings.changePassword")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
