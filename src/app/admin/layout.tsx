import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { AppSidebar } from "@/components/AppSidebar"

const navItems = [
  { href: "/admin", icon: "📊", labelKey: "nav.dashboard" },
  { href: "/admin/farmers", icon: "👨‍🌾", labelKey: "nav.farmers" },
  { href: "/admin/settings", icon: "⚙️", labelKey: "nav.settings" },
]

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session || session.user?.role !== "ADMINISTRATOR") {
    redirect("/login")
  }

  return (
    <div className="flex min-h-screen">
      <AppSidebar
        navItems={navItems}
        userName={session.user?.name || session.user?.email || null}
        theme="gray"
        brandHref="/admin"
        brandLabelKey="admin.appName"
      />
      <main className="flex-1 p-8 bg-gray-50">{children}</main>
    </div>
  )
}
