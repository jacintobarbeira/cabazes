"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { Button } from "@/components/Button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/Card"
import { Badge } from "@/components/Badge"
import { formatDateOnly } from "@/lib/dates"
import type { InviteTokenDTO, UserDTO } from "@/types/api"

export default function BasketLinksPage({ params }: { params: Promise<{ id: string }> }) {
  const { data: session } = useSession()
  const timezone = session?.user?.timezone || "UTC"
  const [tokens, setTokens] = useState<InviteTokenDTO[]>([])
  const [customers, setCustomers] = useState<UserDTO[]>([])
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [basketId, setBasketId] = useState("")

  useEffect(() => {
    params.then((p) => {
      setBasketId(p.id)
      fetch(`/api/baskets/${p.id}/links`)
        .then((res) => res.json())
        .then((data) => {
          setTokens(data)
          setLoading(false)
        })

      fetch("/api/customers")
        .then((res) => res.json())
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

  if (loading) return <p className="text-gray-900">Loading...</p>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Invite Links</h1>
        {tokens.length > 0 && (
          <Button variant="outline" onClick={copyAllLinks}>
            Copy All Links
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Generate Links</CardTitle>
          <p className="text-sm text-gray-900">Select customers to generate personalized order links</p>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-900">
              {selectedCustomers.length} selected
            </span>
            <button onClick={selectAll} className="text-sm text-green-600 hover:text-green-700">
              Select All
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
                  <span className="text-sm font-medium">{customer.name || "No name"}</span>
                  <span className="text-sm text-gray-900 ml-2">{customer.email}</span>
                </div>
              </label>
            ))}
          </div>

          <Button onClick={generateLinks} disabled={selectedCustomers.length === 0 || generating}>
            {generating ? "Generating..." : `Generate ${selectedCustomers.length} Links`}
          </Button>
        </CardContent>
      </Card>

      {tokens.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Generated Links ({tokens.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 font-medium text-gray-800">Customer</th>
                  <th className="text-left py-2 font-medium text-gray-800">Status</th>
                  <th className="text-left py-2 font-medium text-gray-800">Expires</th>
                  <th className="text-right py-2 font-medium text-gray-800">Actions</th>
                </tr>
              </thead>
              <tbody>
                {tokens.map((t) => (
                  <tr key={t.id} className="border-b border-gray-100">
                    <td className="py-2 text-gray-900">
                      <div>
                        <span className="font-medium">{t.customerName || "Unknown"}</span>
                        <div className="text-xs text-gray-900">{t.customerEmail}</div>
                      </div>
                    </td>
                    <td className="py-2 text-gray-900">
                      <Badge variant={t.usedAt ? "default" : "success"}>
                        {t.usedAt ? "Used" : "Active"}
                      </Badge>
                    </td>
                    <td className="py-2 text-gray-900">
                      {formatDateOnly(t.expiresAt, timezone)}
                    </td>
                    <td className="py-2 text-right">
                      {!t.usedAt && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyLink(t.token)}
                        >
                          Copy
                        </Button>
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
