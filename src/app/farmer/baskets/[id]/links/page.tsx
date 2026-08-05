"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { Button } from "@/components/Button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/Card"
import { Badge } from "@/components/Badge"
import { useTranslation } from "@/lib/i18n/useTranslation"
import { formatDateOnly } from "@/lib/dates"
import type { InviteTokenDTO, UserDTO } from "@/types/api"

export default function BasketLinksPage({ params }: { params: Promise<{ id: string }> }) {
  const { t } = useTranslation()
  const { data: session } = useSession()
  const timezone = session?.user?.timezone || "UTC"
  const [tokens, setTokens] = useState<InviteTokenDTO[]>([])
  const [customers, setCustomers] = useState<UserDTO[]>([])
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [sendingIds, setSendingIds] = useState<Set<string>>(new Set())
  const [sentIds, setSentIds] = useState<Set<string>>(new Set())
  const [basketId, setBasketId] = useState("")

  useEffect(() => {
    params.then((p) => {
      setBasketId(p.id)
      fetch(`/api/baskets/${p.id}/links`)
        .then((res) => {
          if (!res.ok) throw new Error("Failed to load")
          return res.json()
        })
        .then((data) => {
          setTokens(data)
          setLoading(false)
        })
        .catch(() => setLoading(false))

      fetch("/api/customers")
        .then((res) => {
          if (!res.ok) throw new Error("Failed to load")
          return res.json()
        })
        .then((data) => setCustomers(data))
    })
  }, [params])

  const toggleCustomer = (id: string) => {
    setSelectedCustomers((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    )
  }

  const selectAll = () => {
    setSelectedCustomers(customers.map((c) => c.id))
  }

  const generateLinks = async () => {
    if (selectedCustomers.length === 0) return
    setGenerating(true)

    const res = await fetch(`/api/baskets/${basketId}/links`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerIds: selectedCustomers }),
    })

    if (res.ok) {
      const data = await res.json()
      setTokens(data)
      setSelectedCustomers([])
    }
    setGenerating(false)
  }

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/order/${token}`
    navigator.clipboard.writeText(url)
  }

  const copyAllLinks = () => {
    const links = tokens
      .filter((t) => !t.usedAt)
      .map((t) => `${t.customerName || t.customerEmail}: ${window.location.origin}/order/${t.token}`)
      .join("\n")
    navigator.clipboard.writeText(links)
  }

  const sendEmail = async (tokenId: string) => {
    if (sendingIds.has(tokenId)) return
    setSendingIds((prev) => new Set(prev).add(tokenId))
    try {
      const res = await fetch(`/api/baskets/${basketId}/links/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokenIds: [tokenId] }),
      })
      if (res.ok) {
        setSentIds((prev) => new Set(prev).add(tokenId))
      }
    } finally {
      setSendingIds((prev) => {
        const next = new Set(prev)
        next.delete(tokenId)
        return next
      })
    }
  }

  const sendAllEmail = async () => {
    const activeTokens = tokens.filter((t) => !t.usedAt)
    const ids = activeTokens.map((t) => t.id)
    setSendingIds(new Set(ids))
    try {
      const res = await fetch(`/api/baskets/${basketId}/links/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokenIds: ids }),
      })
      if (res.ok) {
        setSentIds(new Set(ids))
      }
    } finally {
      setSendingIds(new Set())
    }
  }

  if (loading) return <p className="text-gray-900">{t("common.loading")}</p>

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">{t("basketLinks.title")}</h1>

      <Card>
        <CardHeader>
          <CardTitle>{t("basketLinks.generateLinks")}</CardTitle>
          <p className="text-sm text-gray-900">{t("basketLinks.selectCustomers")}</p>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-900">
              {selectedCustomers.length} {t("common.selected")}
            </span>
            <button onClick={selectAll} className="text-sm text-green-600 hover:text-green-700">
              {t("basketLinks.selectAll")}
            </button>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto mb-4">
            {customers.map((customer) => (
              <label
                key={customer.id}
                className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedCustomers.includes(customer.id)}
                  onChange={() => toggleCustomer(customer.id)}
                  className="h-4 w-4 text-green-600 rounded border-gray-300"
                />
                <div>
                  <span className="text-sm font-medium text-gray-900">{customer.name || t("basketLinks.noName")}</span>
                  <span className="text-sm text-gray-900 ml-2">{customer.email}</span>
                </div>
              </label>
            ))}
          </div>

          <Button onClick={generateLinks} disabled={selectedCustomers.length === 0 || generating}>
            {generating ? t("basketLinks.generating") : t("basketLinks.generateCount", { count: selectedCustomers.length })}
          </Button>
        </CardContent>
      </Card>

      {tokens.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("basketLinks.generatedCount", { count: tokens.length })}</CardTitle>
          </CardHeader>
          <CardContent>
            {tokens.length > 0 && (
              <div className="flex gap-2 mb-4">
                <Button variant="outline" onClick={copyAllLinks}>
                  {t("basketLinks.copyAll")}
                </Button>
                <Button
                  variant="outline"
                  onClick={sendAllEmail}
                  disabled={sendingIds.size > 0 || tokens.filter((t) => !t.usedAt).length === 0}
                >
                  {sendingIds.size > 0 ? t("basketLinks.sending", { count: sendingIds.size }) : t("basketLinks.sendAllEmail")}
                </Button>
              </div>
            )}
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 font-medium text-gray-900">{t("basketLinks.colCustomer")}</th>
                  <th className="text-left py-2 font-medium text-gray-900">{t("basketLinks.colStatus")}</th>
                  <th className="text-left py-2 font-medium text-gray-900">{t("basketLinks.colExpires")}</th>
                  <th className="text-right py-2 font-medium text-gray-900">{t("basketLinks.colActions")}</th>
                </tr>
              </thead>
              <tbody>
                {tokens.map((token) => (
                  <tr key={token.id} className="border-b border-gray-100">
                    <td className="py-2 text-gray-900">
                      <div>
                        <span className="font-medium">{token.customerName || t("basketOrders.unknown")}</span>
                        <div className="text-xs text-gray-900">{token.customerEmail}</div>
                      </div>
                    </td>
                    <td className="py-2 text-gray-900">
                      <Badge variant={token.usedAt ? "default" : "success"}>
                        {token.usedAt ? t("basketLinks.used") : t("basketLinks.active")}
                      </Badge>
                    </td>
                    <td className="py-2 text-gray-900">
                      {formatDateOnly(token.expiresAt, timezone)}
                    </td>
                    <td className="py-2 text-right">
                      {!token.usedAt && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyLink(token.token)}
                          >
                            {t("common.copy")}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => sendEmail(token.id)}
                            disabled={sendingIds.has(token.id)}
                          >
                            {sentIds.has(token.id) ? t("basketLinks.sent") : sendingIds.has(token.id) ? "..." : t("basketLinks.email")}
                          </Button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
