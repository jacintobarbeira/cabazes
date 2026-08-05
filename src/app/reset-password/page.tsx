"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Button } from "@/components/Button"
import { Input } from "@/components/Form"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/Card"
import { useTranslation } from "@/lib/i18n/useTranslation"

export default function ResetPasswordPage() {
  const { t } = useTranslation()
  const { update, data: sessionData } = useSession()
  const router = useRouter()
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (newPassword.length < 6) {
      setError(t("resetPassword.tooShort"))
      return
    }

    if (newPassword !== confirmPassword) {
      setError(t("resetPassword.noMatch"))
      return
    }

    setSaving(true)

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || t("resetPassword.failed"))
        return
      }

      const updatedSession = await update({ mustResetPassword: false })
      const role = updatedSession?.user?.role || sessionData?.user?.role
      if (role === "FARMER_HELPER" || role === "FARMER") {
        router.push("/farmer/dashboard")
      } else {
        router.push("/my-orders")
      }
    } catch {
      setError(t("resetPassword.failed"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{t("resetPassword.title")}</CardTitle>
          <p className="text-sm text-gray-900 mt-1">{t("resetPassword.subtitle")}</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 text-red-700 text-sm p-3 rounded-md">
                {error}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                {t("resetPassword.newPassword")}
              </label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                {t("resetPassword.confirmPassword")}
              </label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <Button type="submit" disabled={saving} className="w-full">
              {saving ? t("resetPassword.saving") : t("resetPassword.resetPassword")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
