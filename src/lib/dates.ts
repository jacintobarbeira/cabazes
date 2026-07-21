const COMMON_TIMEZONES = [
  { label: "GMT (UTC)", value: "UTC" },
  { label: "Europe/Lisbon", value: "Europe/Lisbon" },
  { label: "Europe/London", value: "Europe/London" },
  { label: "Europe/Paris", value: "Europe/Paris" },
  { label: "Europe/Berlin", value: "Europe/Berlin" },
  { label: "Europe/Madrid", value: "Europe/Madrid" },
  { label: "Europe/Rome", value: "Europe/Rome" },
  { label: "Europe/Amsterdam", value: "Europe/Amsterdam" },
  { label: "Europe/Brussels", value: "Europe/Brussels" },
  { label: "Europe/Athens", value: "Europe/Athens" },
  { label: "Europe/Helsinki", value: "Europe/Helsinki" },
  { label: "Europe/Istanbul", value: "Europe/Istanbul" },
  { label: "Europe/Moscow", value: "Europe/Moscow" },
  { label: "America/New_York", value: "America/New_York" },
  { label: "America/Chicago", value: "America/Chicago" },
  { label: "America/Denver", value: "America/Denver" },
  { label: "America/Los_Angeles", value: "America/Los_Angeles" },
  { label: "America/Sao_Paulo", value: "America/Sao_Paulo" },
  { label: "America/Buenos_Aires", value: "America/Argentina/Buenos_Aires" },
  { label: "Asia/Tokyo", value: "Asia/Tokyo" },
  { label: "Asia/Shanghai", value: "Asia/Shanghai" },
  { label: "Asia/Kolkata", value: "Asia/Kolkata" },
  { label: "Asia/Dubai", value: "Asia/Dubai" },
  { label: "Asia/Singapore", value: "Asia/Singapore" },
  { label: "Australia/Sydney", value: "Australia/Sydney" },
  { label: "Pacific/Auckland", value: "Pacific/Auckland" },
]

export function formatDate(
  date: string | Date,
  timezone: string = "UTC",
  options?: Intl.DateTimeFormatOptions
): string {
  const d = typeof date === "string" ? new Date(date) : date
  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  }
  return d.toLocaleString("en-GB", { ...defaultOptions, ...options })
}

export function formatDateOnly(
  date: string | Date,
  timezone: string = "UTC"
): string {
  const d = typeof date === "string" ? new Date(date) : date
  return d.toLocaleDateString("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: timezone,
  })
}

export function formatTimeOnly(
  date: string | Date,
  timezone: string = "UTC"
): string {
  const d = typeof date === "string" ? new Date(date) : date
  return d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  })
}

export function toLocalInput(date: string | Date, timezone: string = "UTC"): string {
  const d = typeof date === "string" ? new Date(date) : date
  const parts = new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: timezone,
  }).formatToParts(d)

  const get = (type: string) => parts.find((p) => p.type === type)?.value || ""
  const year = get("year")
  const month = get("month")
  const day = get("day")
  const hour = get("hour")
  const minute = get("minute")

  return `${year}-${month}-${day}T${hour}:${minute}`
}

export function toLocalDateInput(date: string | Date, timezone: string = "UTC"): string {
  const d = typeof date === "string" ? new Date(date) : date
  const parts = new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: timezone,
  }).formatToParts(d)

  const get = (type: string) => parts.find((p) => p.type === type)?.value || ""
  const year = get("year")
  const month = get("month")
  const day = get("day")

  return `${year}-${month}-${day}`
}

export function fromLocalInputToUTC(localValue: string, timezone: string = "UTC"): Date {
  const parts = localValue.split("T")
  const datePart = parts[0]
  const timePart = parts[1] || "00:00"
  const [year, month, day] = datePart.split("-").map(Number)
  const [hour, minute] = timePart.split(":").map(Number)

  const localDate = new Date(year, month - 1, day, hour, minute)

  const utcString = localDate.toLocaleString("en-US", { timeZone: timezone })
  const utcDate = new Date(utcString)

  const offset = localDate.getTime() - utcDate.getTime()
  return new Date(localDate.getTime() + offset)
}

export function fromLocalDateToUTC(localValue: string, timezone: string = "UTC"): Date {
  const [year, month, day] = localValue.split("-").map(Number)
  const localDate = new Date(year, month - 1, day)

  const utcString = localDate.toLocaleString("en-US", { timeZone: timezone })
  const utcDate = new Date(utcString)

  const offset = localDate.getTime() - utcDate.getTime()
  return new Date(localDate.getTime() + offset)
}

export { COMMON_TIMEZONES }
