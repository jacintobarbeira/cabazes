"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/Button"
import { Input } from "@/components/Form"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/Card"
import { Badge } from "@/components/Badge"
import { useTranslation } from "@/lib/i18n/useTranslation"
import type { ProductDTO } from "@/types/api"

export default function ProductsPage() {
  const { t } = useTranslation()
  const [products, setProducts] = useState<ProductDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [category, setCategory] = useState("")
  const [description, setDescription] = useState("")
  const [formError, setFormError] = useState("")

  const fetchProducts = () => {
    fetch("/api/products")
      .then((res) => {
        if (!res.ok) throw new Error(t("products.failedToFetch"))
        return res.json()
      })
      .then((data) => {
        setProducts(data)
        setLoading(false)
      })
      .catch(() => {
        setProducts([])
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
      body: JSON.stringify({ name, category, description }),
    })

    if (res.ok) {
      resetForm()
      fetchProducts()
    } else {
      const data = await res.json()
      setFormError(data.error || t("products.failedToSave"))
    }
  }

  const handleEdit = (product: ProductDTO) => {
    setEditingId(product.id)
    setName(product.name)
    setCategory(product.category || "")
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
    setDescription("")
    setFormError("")
  }

  if (loading) return <p className="text-gray-900">{t("common.loading")}</p>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t("products.title")}</h1>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? t("products.cancel") : t("products.addProduct")}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? t("products.editProduct") : t("products.newProduct")}</CardTitle>
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
                  <label className="block text-sm font-medium text-gray-900 mb-1">{t("products.nameLabel")}</label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">{t("products.category")}</label>
                  <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder={t("products.categoryPlaceholder")} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">{t("products.description")}</label>
                  <Input value={description} onChange={(e) => setDescription(e.target.value)} />
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit">{editingId ? t("products.update") : t("products.create")}</Button>
                <Button type="button" variant="outline" onClick={resetForm}>{t("products.cancel")}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6">
          {products.length === 0 ? (
            <p className="text-gray-900 text-sm">{t("products.noProducts")}</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 font-medium text-gray-900">{t("products.colName")}</th>
                  <th className="text-left py-2 font-medium text-gray-900">{t("products.colCategory")}</th>
                  <th className="text-left py-2 font-medium text-gray-900">{t("products.colStatus")}</th>
                  <th className="text-right py-2 font-medium text-gray-900">{t("products.colActions")}</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id} className="border-b border-gray-100">
                    <td className="py-2 font-medium text-gray-900">{product.name}</td>
                    <td className="py-2 text-gray-900">{product.category || "-"}</td>
                    <td className="py-2 text-gray-900">
                      <Badge variant={product.active ? "success" : "default"}>
                        {product.active ? t("common.active") : t("common.inactive")}
                      </Badge>
                    </td>
                    <td className="py-2 text-right">
                      <button
                        onClick={() => handleEdit(product)}
                        className="text-green-600 hover:text-green-700 mr-3"
                      >
                        {t("common.edit")}
                      </button>
                      <button
                        onClick={() => handleDelete(product.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        {t("common.delete")}
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
