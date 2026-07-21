import Link from "next/link"
import { auth, signOut } from "@/auth"
import { redirect } from "next/navigation"

const navItems = [
  { href: "/farmer/dashboard", label: "Dashboard", icon: "📊" },
  { href: "/farmer/products", label: "Products", icon: "🥕" },
  { href: "/farmer/baskets", label: "Baskets", icon: "🧺" },
  { href: "/farmer/orders", label: "Orders", icon: "📋" },
  { href: "/farmer/deliveries", label: "Deliveries", icon: "🚚" },
  { href: "/farmer/customers", label: "Customers", icon: "👥" },
  { href: "/farmer/settings", label: "Settings", icon: "⚙️" },
]

function SignOutButton() {
  return (
    <form
      action={async () => {
        "use server"
        await signOut({ redirectTo: "/login" })
      }}
    >
      <button type="submit" className="text-sm text-green-200 hover:text-white transition-colors">
        Sign out
      </button>
    </form>
  )
}

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
    ? [...navItems, { href: "/farmer/helpers", label: "Helpers", icon: "🤝" }]
    : navItems

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 bg-green-800 text-white flex flex-col">
        <div className="p-6">
          <Link href="/farmer/dashboard" className="text-xl font-bold text-white">
            🧺 Cabazes
          </Link>
        </div>
        <nav className="mt-6 flex-1">
          {allNavItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-6 py-3 text-sm text-white hover:bg-green-700 transition-colors"
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="p-6 border-t border-green-700">
          <div className="text-sm text-green-200 mb-2">
            {session.user?.name || session.user?.email}
          </div>
          <SignOutButton />
        </div>
      </aside>
      <main className="flex-1 p-8 bg-gray-50">{children}</main>
    </div>
  )
}
