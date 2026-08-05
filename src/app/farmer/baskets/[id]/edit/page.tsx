"use client"

import { useEffect, useState } from "react"
import BasketWizard from "@/components/BasketWizard"

export default function EditBasketPage({ params }: { params: Promise<{ id: string }> }) {
  const [basketId, setBasketId] = useState<string | null>(null)

  useEffect(() => {
    params.then((p) => setBasketId(p.id))
  }, [params])

  if (!basketId) return null

  return <BasketWizard basketId={basketId} />
}
