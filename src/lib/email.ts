import nodemailer from "nodemailer"

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function getTransport() {
  if (!process.env.SMTP_HOST) return null
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER || "",
      pass: process.env.SMTP_PASS || "",
    },
  })
}

const from = process.env.SMTP_FROM || "noreply@cabazes.com"

export async function sendOrderLink(options: {
  to: string
  customerName: string
  basketName: string
  link: string
  from?: string
}) {
  const transport = getTransport()
  if (!transport) return

  const safeCustomerName = escapeHtml(options.customerName)
  const safeBasketName = escapeHtml(options.basketName)
  const safeLink = escapeHtml(options.link)

  await transport.sendMail({
    from: options.from || from,
    to: options.to,
    subject: `Your order link for ${options.basketName}`,
    html: `
      <p>Hello ${safeCustomerName},</p>
      <p>You have been invited to place an order for <strong>${safeBasketName}</strong>.</p>
      <p>Click the link below to view and place your order:</p>
      <p><a href="${safeLink}">${safeLink}</a></p>
    `,
  })
}

export async function sendDeliveredNotification(options: {
  to: string
  customerName: string
  basketName: string
  from?: string
}) {
  const transport = getTransport()
  if (!transport) return

  const safeCustomerName = escapeHtml(options.customerName)
  const safeBasketName = escapeHtml(options.basketName)

  await transport.sendMail({
    from: options.from || from,
    to: options.to,
    subject: `Your ${options.basketName} order has been delivered`,
    html: `
      <p>Hello ${safeCustomerName},</p>
      <p>Your order for <strong>${safeBasketName}</strong> has been marked as delivered.</p>
      <p>Thank you for your order!</p>
    `,
  })
}
