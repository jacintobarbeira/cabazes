"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/Button"
import { Input } from "@/components/Form"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/Card"
import { Badge } from "@/components/Badge"
import type { ProductDTO } from "@/types/api"

export default function ProductsPage() {
  const [products, setProducts] = useState<ProductDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [category, setCategory] = useState("")
  const [unit, setUnit] = useState("unit")
  const [description, setDescription] = useState("")
  const [formError, setFormError] = useState("")

  const fetchProducts = () => {
    fetch("/api/products")
      .then((res) => res.json())
      .then((data) => {
        setProducts(data)
        setLoading(false)
      })
  }

  useEffect(() => {
    fetchProducts()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError("")

    const method = editingId ? "PATCH" : "POST"
    const url = editingId ? `/api/products/${editingId}` : "/api/products"

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, category, unit, description }),
    })

    if (res.ok) {
      resetForm()
      fetchProducts()
    } else {
      const data = await res.json()
      setFormError(data.error || "Failed to save product")
    }
  }

  const handleEdit = (product: ProductDTO) => {
    setEditingId(product.id)
    setName(product.name)
    setCategory(product.category || "")
    setUnit(product.unit)
    setDescription(product.description || "")
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/products/${id}`, { method: "DELETE" })
    if (res.ok) fetchProducts()
  }

  const resetForm = () => {
    setShowForm(false)
    setEditingId(null)
    setName("")
    setCategory("")
    setUnit("unit")
    setDescription("")
    setFormError("")
  }

  if (loading) return <p className="text-gray-600">Loading...</p>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Products</h1>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "+ Add Product"}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? "Edit Product" : "New Product"}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {formError && (
                <div className="bg-red-50 text-red-700 text-sm p-3 rounded-md">
                  {formError}
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">Name *</label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">Category</label>
                  <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="vegetable, fruit, herb..." />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">Unit</label>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                  >
                    <option value="unit">Unit</option>
                    <option value="kg">Kg</option>
                    <option value="bunch">Bunch</option>
                    <option value="box">Box</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">Description</label>
                  <Input value={description} onChange={(e) => setDescription(e.target.value)} />
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit">{editingId ? "Update" : "Create"}</Button>
                <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6">
          {products.length === 0 ? (
            <p className="text-gray-900 text-sm">No products yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 font-medium text-gray-800">Name</th>
                  <th className="text-left py-2 font-medium text-gray-800">Category</th>
                  <th className="text-left py-2 font-medium text-gray-800">Unit</th>
                  <th className="text-left py-2 font-medium text-gray-800">Status</th>
                  <th className="text-right py-2 font-medium text-gray-800">Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id} className="border-b border-gray-100">
                    <td className="py-2 font-medium text-gray-900">{product.name}</td>
                    <td className="py-2 text-gray-900">{product.category || "-"}</td>
                    <td className="py-2 text-gray-900">{product.unit}</td>
                    <td className="py-2 text-gray-900">
                      <Badge variant={product.active ? "success" : "default"}>
                        {product.active ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="py-2 text-right">
                      <button
                        onClick={() => handleEdit(product)}
                        className="text-green-600 hover:text-green-700 mr-3"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(product.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        Delete
                      </button>
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
