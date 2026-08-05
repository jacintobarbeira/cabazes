"use client"

import { useState, useEffect, Suspense } from "react"
import { signIn, useSession } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/Button"
import { Input } from "@/components/Form"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/Card"
import { useTranslation } from "@/lib/i18n/useTranslation"

function LoginForm() {
  const { t } = useTranslation()
  const searchParams = useSearchParams()
  const router = useRouter()
  const { status } = useSession()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const errorParam = searchParams.get("error")
    if (errorParam === "CredentialsSignin") {
      setError(t("auth.invalidCredentials"))
    }
  }, [searchParams])

  useEffect(() => {
    if (status === "authenticated") {
      router.push("/farmer/dashboard")
    }
  }, [status, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    await signIn("credentials", {
      email,
      password,
      callbackUrl: "/farmer/dashboard",
    })

    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">🧺 Cabazes</CardTitle>
          <p className="text-sm text-gray-900 mt-1">{t("auth.signInTitle")}</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 text-red-700 text-sm p-3 rounded-md">
                {error}
              </div>
            )}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-900 mb-1">
                {t("auth.email")}
              </label>
              <Input
                id="email"
                name="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-900 mb-1">
                {t("auth.password")}
              </label>
              <Input
                id="password"
                name="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? t("auth.signingIn") : t("auth.signIn")}
            </Button>
            <p className="text-center text-sm text-gray-900">
              {t("auth.noAccount")}{" "}
              <Link href="/register" className="text-green-700 hover:text-green-800 font-medium">
                {t("auth.register")}
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-gray-50 px-4"><p className="text-gray-900">Loading...</p></div>}>
      <LoginForm />
    </Suspense>
  )
}
