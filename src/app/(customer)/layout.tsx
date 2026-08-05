import Link from "next/link"
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { CustomerNav } from "@/components/CustomerNav"

export default async function CustomerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session || session.user?.role !== "CUSTOMER") {
    redirect("/login")
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/my-orders" className="text-xl font-bold text-green-700">
              🧺 Cabazes
            </Link>
            <CustomerNav />
          </div>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  )
}
