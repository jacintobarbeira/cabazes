import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { FarmerSidebar } from "@/components/FarmerSidebar"

const navItems = [
  { href: "/farmer/dashboard", icon: "📊", labelKey: "nav.dashboard" },
  { href: "/farmer/products", icon: "🥕", labelKey: "nav.products" },
  { href: "/farmer/baskets", icon: "🧺", labelKey: "nav.baskets" },
  { href: "/farmer/orders", icon: "📋", labelKey: "nav.orders" },
  { href: "/farmer/deliveries", icon: "🚚", labelKey: "nav.deliveries" },
  { href: "/farmer/customers", icon: "👥", labelKey: "nav.customers" },
  { href: "/farmer/settings", icon: "⚙️", labelKey: "nav.settings" },
]

export default async function FarmerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session || !["FARMER", "FARMER_HELPER"].includes(session.user?.role)) {
    redirect("/login")
  }

  const allNavItems = session.user.role === "FARMER"
    ? [...navItems, { href: "/farmer/helpers", icon: "🤝", labelKey: "nav.helpers" }]
    : navItems

  return (
    <div className="flex min-h-screen">
      <FarmerSidebar
        navItems={allNavItems}
        userName={session.user?.name || session.user?.email || null}
      />
      <main className="flex-1 p-8 bg-gray-50">{children}</main>
    </div>
  )
}
