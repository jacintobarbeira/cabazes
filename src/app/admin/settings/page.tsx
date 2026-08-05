"use client"

import { useState } from "react"
import { Button } from "@/components/Button"
import { Input } from "@/components/Form"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/Card"
import { useTranslation } from "@/lib/i18n/useTranslation"

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

export default function AdminSettingsPage() {
  const { t } = useTranslation()
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmNewPassword, setConfirmNewPassword] = useState("")
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState("")
  const [pwErrors, setPwErrors] = useState<string[]>([])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSaved(false)
    setPwErrors([])

    if (newPassword !== confirmNewPassword) {
      setError(t("resetPassword.noMatch"))
      return
    }

    const errs = getPasswordErrors(newPassword, t)
    if (errs.length > 0) {
      setPwErrors(errs)
      return
    }

    setSaving(true)
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      const data = await res.json()
      if (res.ok) {
        setSaved(true)
        setCurrentPassword("")
        setNewPassword("")
        setConfirmNewPassword("")
        setTimeout(() => setSaved(false), 3000)
      } else {
        setError(data.error)
      }
    } catch {
      setError(t("auth.errorOccurred"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">{t("adminSettings.title")}</h1>

      <Card>
        <CardHeader>
          <CardTitle>{t("adminSettings.changePassword")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {saved && (
              <div className="bg-green-50 text-green-700 text-sm p-3 rounded-md">
                {t("adminSettings.passwordUpdated")}
              </div>
            )}
            {error && (
              <div className="bg-red-50 text-red-700 text-sm p-3 rounded-md">{error}</div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                {t("adminSettings.currentPassword")}
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
                {t("adminSettings.newPassword")}
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
                {t("adminSettings.confirmNewPassword")}
              </label>
              <Input
                type="password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? t("common.saving") : t("adminSettings.changePassword")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
