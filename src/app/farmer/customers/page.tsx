"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/Card"
import type { UserDTO } from "@/types/api"

export default function CustomersPage() {
  const [customers, setCustomers] = useState<UserDTO[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/customers")
      .then((res) => res.json())
      .then((data) => {
        setCustomers(data)
        setLoading(false)
      })
  }, [])

  if (loading) return <p className="text-gray-600">Loading...</p>

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Customers ({customers.length})</h1>

      <Card>
        <CardContent className="pt-6">
          {customers.length === 0 ? (
            <p className="text-gray-900 text-sm">No customers yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 font-medium text-gray-800">Name</th>
                  <th className="text-left py-2 font-medium text-gray-800">Email</th>
                  <th className="text-left py-2 font-medium text-gray-800">Phone</th>
                  <th className="text-left py-2 font-medium text-gray-800">Address</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => (
                  <tr key={customer.id} className="border-b border-gray-100">
                    <td className="py-2 font-medium text-gray-900">{customer.name || "-"}</td>
                    <td className="py-2 text-gray-900">{customer.email}</td>
                    <td className="py-2 text-gray-900">{customer.phone || "-"}</td>
                    <td className="py-2 text-gray-900">
                      {customer.address}
                      {customer.city && `, ${customer.city}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
