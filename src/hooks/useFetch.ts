"use client"

import { useCallback, useEffect, useState } from "react"

export function useFetch<T>(url: string) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(() => {
    return fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load")
        return res.json() as Promise<T>
      })
      .then((json) => {
        setData(json)
      })
      .catch(() => {
        setData(null)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [url])

  useEffect(() => {
    reload()
  }, [reload])

  return { data, loading, reload }
}
