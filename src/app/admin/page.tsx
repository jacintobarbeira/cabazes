import { prisma } from "@/lib/db"
import { auth } from "@/auth"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/Card"

export const dynamic = "force-dynamic"

export default async function AdminDashboardPage() {
  const session = await auth()

  if (!session?.user?.id) {
    return null
  }

  const totalFarmers = await prisma.user.count({ where: { role: "FARMER" } })
  const totalHelpers = await prisma.user.count({ where: { role: "FARMER_HELPER" } })
  const totalCustomers = await prisma.user.count({ where: { role: "CUSTOMER" } })

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-gray-900">Total Farmers</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{totalFarmers}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-gray-900">Farmer Helpers</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{totalHelpers}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-gray-900">Customers</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{totalCustomers}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
