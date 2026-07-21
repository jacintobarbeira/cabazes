export function auditLog(event: Record<string, string | number | boolean | null>) {
  const timestamp = new Date().toISOString()
  const logEntry = { timestamp, ...event }
  console.log(JSON.stringify(logEntry))
}
