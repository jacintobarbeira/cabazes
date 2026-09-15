"use client"

import { useCallback, useEffect, useState } from "react"

export function useFetch<T>(url: string) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(
    (signal?: AbortSignal) => {
      return fetch(url, { signal })
        .then((res) => {
          if (!res.ok) throw new Error("Failed to load")
          return res.json() as Promise<T>
        })
        .then((json) => {
          setData(json)
        })
        .catch((err) => {
          if (err instanceof DOMException && err.name === "AbortError") return
          setData(null)
        })
        .finally(() => {
          setLoading(false)
        })
    },
    [url]
  )

  useEffect(() => {
    const controller = new AbortController()
    reload(controller.signal)
    return () => controller.abort()
  }, [reload])

  return { data, loading, reload: () => reload() }
}
