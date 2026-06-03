import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCandidates } from "@/lib/matching/recommend";
import {
  MatchingBoard,
  type OrderOption,
} from "@/components/matching/matching-board";

export const dynamic = "force-dynamic";

const getPendingOrders = unstable_cache(
  async (): Promise<OrderOption[]> => {
    const orders = await prisma.order.findMany({
      where: { status: "pending" },
      include: { customer: true },
      orderBy: { id: "asc" },
      take: 100,
    });
    return orders.map((o) => ({
      id: o.id,
      customerName: o.customer.name,
      cargo: o.cargo,
      requiredVehicleType: o.requiredVehicleType,
    }));
  },
  ["matching-pending-orders"],
  { revalidate: 3600, tags: ["mockdata"] }
);

export default async function MatchingPage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string }>;
}) {
  const sp = await searchParams;
  const orders = await getPendingOrders();
  const orderId = sp.orderId ? Number(sp.orderId) : orders[0]?.id;
  const data = orderId ? await getCandidates(orderId) : null;

  return (
    <MatchingBoard orders={orders} selectedOrderId={orderId} data={data} />
  );
}
