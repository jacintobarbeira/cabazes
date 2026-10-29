"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/Button"
import { Input, Checkbox } from "@/components/Form"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/Card"
import { useTranslation } from "@/lib/i18n/useTranslation"
import { COMMON_TIMEZONES } from "@/lib/dates"
import type { EmailServerSettingsDTO, UserDTO } from "@/types/api"

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

  const [smtpHost, setSmtpHost] = useState("")
  const [smtpPort, setSmtpPort] = useState("587")
  const [smtpSecure, setSmtpSecure] = useState(false)
  const [smtpUsername, setSmtpUsername] = useState("")
  const [smtpPassword, setSmtpPassword] = useState("")
  const [smtpHasPassword, setSmtpHasPassword] = useState(false)
  const [smtpFromAddress, setSmtpFromAddress] = useState("")
  const [smtpFromName, setSmtpFromName] = useState("")
  const [smtpConfigured, setSmtpConfigured] = useState(false)
  const [smtpLoaded, setSmtpLoaded] = useState(false)
  const [smtpSaving, setSmtpSaving] = useState(false)
  const [smtpSaved, setSmtpSaved] = useState(false)
  const [smtpError, setSmtpError] = useState("")
  const [smtpTestState, setSmtpTestState] = useState<"idle" | "sending" | "sent" | "failed">("idle")
  const [smtpTestMessage, setSmtpTestMessage] = useState("")

  const [bulkBusy, setBulkBusy] = useState<"customers" | "products" | null>(null)
  const [bulkError, setBulkError] = useState("")
  const [bulkResult, setBulkResult] = useState<{
    kind: "customers" | "products"
    total: number
    created: number
    results: Array<{ row: number; ok: boolean; error?: string }>
  } | null>(null)

  const handleBulkUpload = async (
    kind: "customers" | "products",
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return

    setBulkBusy(kind)
    setBulkError("")
    setBulkResult(null)

    try {
      const buffer = await file.arrayBuffer()
      const res = await fetch(`/api/farmer/bulk/${kind}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        },
        body: buffer,
      })
      const data = await res.json()
      if (res.ok) {
        setBulkResult({ kind, total: data.total, created: data.created, results: data.results })
      } else {
        setBulkError(data.error || t("settings.bulk.genericError"))
      }
    } catch {
      setBulkError(t("settings.bulk.genericError"))
    } finally {
      setBulkBusy(null)
    }
  }

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

        if (data.role === "FARMER") {
          return fetch("/api/farmer/email-server")
            .then((res) => res.json())
            .then((cfg: EmailServerSettingsDTO) => {
              if (cfg.configured) {
                setSmtpHost(cfg.host)
                setSmtpPort(String(cfg.port))
                setSmtpSecure(cfg.secure)
                setSmtpUsername(cfg.username || "")
                setSmtpHasPassword(cfg.hasPassword)
                setSmtpFromAddress(cfg.fromAddress || "")
                setSmtpFromName(cfg.fromName || "")
                setSmtpConfigured(true)
              }
              setSmtpLoaded(true)
            })
            .catch(() => setSmtpLoaded(true))
        }
        setSmtpLoaded(true)
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

  const handleSmtpSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSmtpSaving(true)
    setSmtpSaved(false)
    setSmtpError("")
    setSmtpTestState("idle")

    try {
      const payload: Record<string, unknown> = {
        host: smtpHost,
        port: Number(smtpPort),
        secure: smtpSecure,
        username: smtpUsername || null,
        fromAddress: smtpFromAddress || null,
        fromName: smtpFromName || null,
      }
      // Only send the password when a new one was typed; blank means "keep".
      if (smtpPassword !== "") payload.password = smtpPassword

      const res = await fetch("/api/farmer/email-server", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (res.ok) {
        setSmtpHasPassword(data.hasPassword)
        setSmtpPassword("")
        setSmtpConfigured(true)
        setSmtpSaved(true)
        setTimeout(() => setSmtpSaved(false), 3000)
      } else {
        setSmtpError(data.error || t("settings.emailServer.genericError"))
      }
    } catch {
      setSmtpError(t("settings.emailServer.genericError"))
    } finally {
      setSmtpSaving(false)
    }
  }

  const handleSmtpRemove = async () => {
    setSmtpError("")
    const res = await fetch("/api/farmer/email-server", { method: "DELETE" })
    if (res.ok) {
      setSmtpHost("")
      setSmtpPort("587")
      setSmtpSecure(false)
      setSmtpUsername("")
      setSmtpPassword("")
      setSmtpHasPassword(false)
      setSmtpFromAddress("")
      setSmtpFromName("")
      setSmtpConfigured(false)
      setSmtpTestState("idle")
    } else {
      setSmtpError(t("settings.emailServer.genericError"))
    }
  }

  const handleSmtpTest = async () => {
    setSmtpTestState("sending")
    setSmtpTestMessage("")
    try {
      const res = await fetch("/api/farmer/email-server/test", { method: "POST" })
      const data = await res.json()
      if (res.ok) {
        setSmtpTestState("sent")
        setSmtpTestMessage(t("settings.emailServer.testSent", { email: data.to }))
      } else {
        setSmtpTestState("failed")
        setSmtpTestMessage(t("settings.emailServer.testFailed", { error: data.error }))
      }
    } catch {
      setSmtpTestState("failed")
      setSmtpTestMessage(t("settings.emailServer.testFailed", { error: "" }))
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
                id="sender-email"
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

      {user?.role === "FARMER" && smtpLoaded && (
        <Card>
          <CardHeader>
            <CardTitle>{t("settings.emailServer.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSmtpSave} className="space-y-4">
              <p className="text-sm text-gray-600">{t("settings.emailServer.description")}</p>
              {smtpSaved && (
                <div className="bg-green-50 text-green-700 text-sm p-3 rounded-md">
                  {t("settings.emailServer.saved")}
                </div>
              )}
              {smtpError && (
                <div className="bg-red-50 text-red-700 text-sm p-3 rounded-md">{smtpError}</div>
              )}
              {!smtpConfigured && (
                <div className="bg-yellow-50 text-yellow-800 text-sm p-3 rounded-md">
                  {t("settings.emailServer.notConfigured")}
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-900 mb-1">
                    {t("settings.emailServer.host")}
                  </label>
                  <Input
                    id="smtp-host"
                    dir="ltr"
                    value={smtpHost}
                    onChange={(e) => setSmtpHost(e.target.value)}
                    placeholder={t("settings.emailServer.hostPlaceholder")}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">
                    {t("settings.emailServer.port")}
                  </label>
                  <Input
                    id="smtp-port"
                    type="number"
                    min={1}
                    max={65535}
                    value={smtpPort}
                    onChange={(e) => setSmtpPort(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div>
                <Checkbox
                  id="smtp-secure"
                  checked={smtpSecure}
                  onChange={(e) => setSmtpSecure(e.target.checked)}
                  label={t("settings.emailServer.secure")}
                />
                <p className="text-xs text-gray-500 mt-1">{t("settings.emailServer.secureHint")}</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">
                    {t("settings.emailServer.username")}
                  </label>
                  <Input
                    id="smtp-username"
                    type="text"
                    autoComplete="off"
                    value={smtpUsername}
                    onChange={(e) => setSmtpUsername(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">
                    {t("settings.emailServer.password")}
                  </label>
                  <Input
                    id="smtp-password"
                    type="password"
                    autoComplete="new-password"
                    value={smtpPassword}
                    onChange={(e) => setSmtpPassword(e.target.value)}
                    placeholder={smtpHasPassword ? t("settings.emailServer.passwordStored") : ""}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">
                    {t("settings.emailServer.senderAddress")}
                  </label>
                  <Input
                    id="smtp-from-address"
                    type="email"
                    dir="ltr"
                    value={smtpFromAddress}
                    onChange={(e) => setSmtpFromAddress(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">
                    {t("settings.emailServer.senderName")}
                  </label>
                  <Input
                    id="smtp-from-name"
                    value={smtpFromName}
                    onChange={(e) => setSmtpFromName(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button type="submit" disabled={smtpSaving}>
                  {smtpSaving ? t("settings.emailServer.saving") : t("settings.emailServer.save")}
                </Button>
                {smtpConfigured && (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={smtpTestState === "sending"}
                    onClick={handleSmtpTest}
                  >
                    {smtpTestState === "sending"
                      ? t("settings.emailServer.testing")
                      : t("settings.emailServer.test")}
                  </Button>
                )}
                {smtpConfigured && (
                  <button
                    type="button"
                    onClick={handleSmtpRemove}
                    className="text-sm text-red-600 hover:underline"
                  >
                    {t("settings.emailServer.remove")}
                  </button>
                )}
              </div>
              {smtpTestMessage && (
                <div
                  className={`text-sm p-3 rounded-md ${
                    smtpTestState === "sent"
                      ? "bg-green-50 text-green-700"
                      : "bg-red-50 text-red-700"
                  }`}
                >
                  {smtpTestMessage}
                </div>
              )}
            </form>
          </CardContent>
        </Card>
      )}

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

      <Card>
        <CardHeader>
          <CardTitle>{t("settings.bulk.bulkLoad")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {bulkError && (
            <div className="bg-red-50 text-red-700 text-sm p-3 rounded-md">{bulkError}</div>
          )}
          {bulkResult && (
            <div className="bg-green-50 text-green-700 text-sm p-3 rounded-md">
              <p>
                {t("settings.bulk.uploadSummary", {
                  created: bulkResult.created,
                  total: bulkResult.total,
                })}
              </p>
              {bulkResult.results.some((r) => !r.ok) && (
                <ul className="list-disc ml-5 mt-2 space-y-0.5">
                  {bulkResult.results
                    .filter((r) => !r.ok)
                    .map((r) => (
                      <li key={`${bulkResult.kind}-${r.row}`}>
                        {t("settings.bulk.rowFailed", { row: r.row, error: r.error || "" })}
                      </li>
                    ))}
                </ul>
              )}
            </div>
          )}
          <div className="border rounded-md p-4 space-y-1">
            <h3 className="font-medium text-gray-900">{t("settings.bulk.bulkCustomers")}</h3>
            <p className="text-sm text-gray-600">{t("settings.bulk.bulkCustomersDescription")}</p>
            <div className="flex items-center gap-4 pt-2">
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a
                href="/api/farmer/bulk/templates/customers"
                className="text-sm text-green-600 underline hover:text-green-700"
              >
                {t("settings.bulk.downloadCustomerTemplate")}
              </a>
              <label className="cursor-pointer text-sm font-medium text-green-700 hover:underline">
                {bulkBusy === "customers" ? t("settings.bulk.uploading") : t("settings.bulk.chooseFile")}
                <input
                  type="file"
                  accept=".xlsx"
                  className="hidden"
                  disabled={bulkBusy !== null}
                  onChange={(e) => handleBulkUpload("customers", e)}
                />
              </label>
            </div>
          </div>
          <div className="border rounded-md p-4 space-y-1">
            <h3 className="font-medium text-gray-900">{t("settings.bulk.bulkProducts")}</h3>
            <p className="text-sm text-gray-600">{t("settings.bulk.bulkProductsDescription")}</p>
            <div className="flex items-center gap-4 pt-2">
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a
                href="/api/farmer/bulk/templates/products"
                className="text-sm text-green-600 underline hover:text-green-700"
              >
                {t("settings.bulk.downloadProductTemplate")}
              </a>
              <label className="cursor-pointer text-sm font-medium text-green-700 hover:underline">
                {bulkBusy === "products" ? t("settings.bulk.uploading") : t("settings.bulk.chooseFile")}
                <input
                  type="file"
                  accept=".xlsx"
                  className="hidden"
                  disabled={bulkBusy !== null}
                  onChange={(e) => handleBulkUpload("products", e)}
                />
              </label>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
