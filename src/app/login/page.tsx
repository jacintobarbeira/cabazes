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
    } else if (errorParam === "OAuthAccountNotLinked") {
      setError(t("auth.oauthAccountNotLinked"))
    }
  }, [searchParams, t])

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

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-white px-2 text-gray-500">{t("auth.orDivider")}</span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => signIn("google", { callbackUrl: "/farmer/dashboard" })}
          >
            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.05 5.05 0 0 1-2.19 3.31v2.77h3.54c2.08-1.92 3.29-4.75 3.29-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.54-2.77c-.98.66-2.23 1.06-3.74 1.06-2.88 0-5.32-1.94-6.19-4.56H1.14v2.88A11 11 0 0 0 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.81 14.07a6.99 6.99 0 0 1-.38-2.07c0-.72.13-1.42.38-2.07V7.05H1.14A11 11 0 0 0 0 12s0 .01.01.01A11 11 0 0 0 1.14 16.95l3.67-2.88z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.39 1 3.39 3.55 1.14 7.41l3.67 2.88c.87-2.62 3.31-4.56 6.19-4.56z"
              />
            </svg>
            {t("auth.signInWithGoogle")}
          </Button>
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
