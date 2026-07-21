import { prisma } from "@/lib/db"
import { auth } from "@/auth"
import { formatDateOnly } from "@/lib/dates"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/Card"
import Link from "next/link"

export const dynamic = "force-dynamic"

export default async function DashboardPage() {
  const session = await auth()

  if (!session?.user?.id) {
    return null
  }

  const timezone = session.user.timezone || "UTC"
  const farmerId = session.user.id

  const baskets = await prisma.basket.findMany({
    where: { farmerId },
    include: { _count: { select: { orders: true } } },
    orderBy: { orderDeadline: "desc" },
    take: 5,
  })

  const totalOrders = await prisma.order.count({ where: { basket: { farmerId } } })
  const totalCustomers = await prisma.user.count({ where: { role: "CUSTOMER" } })
  const pendingOrders = await prisma.order.count({ where: { status: "PENDING", basket: { farmerId } } })

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-gray-900">Total Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-gray-900">{totalOrders}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-gray-900">Customers</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-gray-900">{totalCustomers}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-gray-900">Pending Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-yellow-600">{pendingOrders}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Recent Baskets</CardTitle>
            <Link href="/farmer/baskets/new" className="text-sm text-green-600 hover:text-green-700">
              + New Basket
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {baskets.length === 0 ? (
            <p className="text-gray-900 text-sm">No baskets yet. Create your first basket!</p>
          ) : (
            <div className="space-y-3">
              {baskets.map((basket) => (
                <Link
                  key={basket.id}
                  href={`/farmer/baskets/${basket.id}`}
                  className="flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:border-green-300 transition-colors"
                >
                  <div>
                    <p className="font-medium text-gray-900">{basket.name}</p>
                    <p className="text-sm text-gray-900">
                      Deadline: {formatDateOnly(basket.orderDeadline, timezone)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">{basket._count.orders} orders</p>
                    <p className={`text-xs ${basket.published ? "text-green-600" : "text-gray-600"}`}>
                      {basket.published ? "Published" : "Draft"}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
