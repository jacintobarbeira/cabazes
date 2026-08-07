import { prisma } from "@/lib/db"

export type ProductInput = {
  name?: string | null
  description?: string | null
  category?: string | null
  active?: boolean
}

export async function createProductForFarmer(
  farmerId: string,
  input: ProductInput
): Promise<
  | { ok: true; product: Awaited<ReturnType<typeof prisma.product.create>> }
  | { ok: false; error: string }
> {
  if (!input.name) {
    return { ok: false, error: "Name is required" }
  }

  const product = await prisma.product
    .create({
      data: {
        name: input.name,
        description: input.description || null,
        category: input.category || null,
        active: input.active !== false,
        farmerId,
      },
    })
    .catch(() => null)

  if (!product) {
    return { ok: false, error: "A product with this name already exists" }
  }

  return { ok: true, product }
}
