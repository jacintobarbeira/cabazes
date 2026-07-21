import Link from "next/link"
import { auth, signOut } from "@/auth"
import { redirect } from "next/navigation"

const navItems = [
  { href: "/admin", label: "Dashboard", icon: "📊" },
  { href: "/admin/farmers", label: "Farmers", icon: "👨‍🌾" },
]

function SignOutButton() {
  return (
    <form
      action={async () => {
        "use server"
        await signOut({ redirectTo: "/login" })
      }}
    >
      <button type="submit" className="text-sm text-gray-300 hover:text-white transition-colors">
        Sign out
      </button>
    </form>
  )
}

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
      <aside className="w-64 bg-gray-900 text-white flex flex-col">
        <div className="p-6">
          <Link href="/admin" className="text-xl font-bold text-white">
            🧺 Cabazes Admin
          </Link>
        </div>
        <nav className="mt-6 flex-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-6 py-3 text-sm text-white hover:bg-gray-800 transition-colors"
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="p-6 border-t border-gray-800">
          <div className="text-sm text-gray-300 mb-2">
            {session.user?.name || session.user?.email}
          </div>
          <SignOutButton />
        </div>
      </aside>
      <main className="flex-1 p-8 bg-gray-50">{children}</main>
    </div>
  )
}
