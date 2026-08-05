"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/Button"
import { Input } from "@/components/Form"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/Card"
import { useTranslation } from "@/lib/i18n/useTranslation"

interface Farmer {
  id: string
  name: string | null
  email: string
}

export default function RegisterPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [address, setAddress] = useState("")
  const [city, setCity] = useState("")
  const [postalCode, setPostalCode] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [farmers, setFarmers] = useState<Farmer[]>([])
  const [selectedFarmers, setSelectedFarmers] = useState<Set<string>>(new Set())
  const [loadingFarmers, setLoadingFarmers] = useState(true)

  useEffect(() => {
    fetch("/api/farmers")
      .then((res) => res.json())
      .then((data) => {
        setFarmers(data)
        setLoadingFarmers(false)
      })
      .catch(() => setLoadingFarmers(false))
  }, [])

  function getPasswordErrors(password: string): string[] {
    const errors: string[] = []
    if (password.length < 8) errors.push(t("auth.atLeast8Chars"))
    if (!/[A-Z]/.test(password)) errors.push(t("auth.atLeastUpper"))
    if (!/[0-9]/.test(password)) errors.push(t("auth.atLeastDigit"))
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) errors.push(t("auth.atLeastSpecial"))
    return errors
  }

  const passwordErrors = password ? getPasswordErrors(password) : []

  const toggleFarmer = (id: string) => {
    setSelectedFarmers((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (passwordErrors.length > 0) return
    if (selectedFarmers.size === 0) {
      setError(t("auth.selectAtLeastOne"))
      return
    }
    setLoading(true)

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          phone,
          address,
          city,
          postalCode,
          password,
          farmerIds: [...selectedFarmers],
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || t("auth.registrationFailed"))
        return
      }

      router.push("/login?registered=true")
    } catch {
      setError(t("auth.errorOccurred"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-8">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl text-gray-900">🧺 Cabazes</CardTitle>
          <p className="text-sm text-gray-900 mt-1">{t("auth.createAccount")}</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 text-red-700 text-sm p-3 rounded-md">
                {error}
              </div>
            )}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-900 mb-1">
                {t("auth.name")}
              </label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                required
              />
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-900 mb-1">
                {t("auth.emailLabel")}
              </label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-900 mb-1">
                {t("auth.phone")}
              </label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+351 912 345 678"
                required
              />
            </div>
            <div>
              <label htmlFor="address" className="block text-sm font-medium text-gray-900 mb-1">
                {t("auth.deliveryAddress")}
              </label>
              <Input
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Street and number"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="city" className="block text-sm font-medium text-gray-900 mb-1">
                  {t("auth.city")}
                </label>
                <Input
                  id="city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="City"
                />
              </div>
              <div>
                <label htmlFor="postalCode" className="block text-sm font-medium text-gray-900 mb-1">
                  {t("auth.postalCode")}
                </label>
                <Input
                  id="postalCode"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  placeholder="1234-567"
                />
              </div>
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-900 mb-1">
                {t("auth.passwordLabel")}
              </label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={8}
              />
              {passwordErrors.length > 0 && (
                <ul className="text-sm text-red-600 mt-1 space-y-0.5">
                  {passwordErrors.map(err => (
                    <li key={err} className="flex items-center gap-1">
                      <span>•</span> {err}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                {t("auth.selectFarmers")}
              </label>
              {loadingFarmers ? (
                <p className="text-sm text-gray-500">{t("common.loading")}</p>
              ) : farmers.length === 0 ? (
                <p className="text-sm text-gray-500">{t("auth.noFarmersAvailable")}</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded-md p-3">
                  {farmers.map((farmer) => (
                    <label
                      key={farmer.id}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedFarmers.has(farmer.id)}
                        onChange={() => toggleFarmer(farmer.id)}
                        className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                      />
                      <span className="text-sm text-gray-900">
                        {farmer.name || farmer.email}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={loading || passwordErrors.length > 0}>
              {loading ? t("auth.creatingAccount") : t("auth.createAccountBtn")}
            </Button>
            <p className="text-center text-sm text-gray-900">
              {t("auth.hasAccount")}{" "}
              <Link href="/login" className="text-green-700 hover:text-green-800 font-medium">
                {t("auth.signIn")}
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
