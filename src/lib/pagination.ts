export const DEFAULT_PAGE_SIZE = 50
export const MAX_PAGE_SIZE = 100

export function parsePagination(url: URL): { take: number; skip: number } {
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10) || 1)
  const rawSize = parseInt(url.searchParams.get("pageSize") || String(DEFAULT_PAGE_SIZE), 10)
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, isNaN(rawSize) ? DEFAULT_PAGE_SIZE : rawSize))
  return { take: pageSize, skip: (page - 1) * pageSize }
}

export function paginatedResponse<T>(data: T[], take: number, skip: number, total?: number) {
  // For backwards compatibility, if caller expects array, we still return array when no pagination params provided?
  // But we always paginate. Keep array shape for now if total not known; otherwise wrap.
  return data
}
