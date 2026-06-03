import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  DispatchMap,
  VEHICLE_COLORS,
  type MapVehicle,
  type MapOrder,
} from "@/components/map/dispatch-map";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

// モックデータは不変 → DB取得をキャッシュ(2回目以降はDBを叩かない)
const getDispatchData = unstable_cache(
  async () => {
    const [vehicles, inProgress, pendingOrders, vehicleTypeCounts] =
      await Promise.all([
        prisma.vehicle.findMany({ orderBy: { id: "asc" } }),
        prisma.dispatchRecord.findMany({
          where: { status: "in_progress" },
          select: { vehicleId: true },
        }),
        prisma.order.findMany({
          where: { status: "pending" },
          include: { customer: true },
          orderBy: { requestedAt: "asc" },
          take: 200,
        }),
        prisma.vehicle.groupBy({ by: ["type"], _count: { _all: true } }),
      ]);
    return { vehicles, inProgress, pendingOrders, vehicleTypeCounts };
  },
  ["dispatch-data"],
  { revalidate: 3600, tags: ["mockdata"] }
);

export default async function DispatchPage() {
  const { vehicles, inProgress, pendingOrders, vehicleTypeCounts } =
    await getDispatchData();

  const busy = new Set(inProgress.map((d) => d.vehicleId));

  const mapVehicles: MapVehicle[] = vehicles.map((v) => ({
    id: v.id,
    plateNumber: v.plateNumber,
    type: v.type,
    baseLat: v.baseLat,
    baseLng: v.baseLng,
    status: v.status,
    busy: busy.has(v.id),
  }));

  const mapOrders: MapOrder[] = pendingOrders.map((o) => ({
    id: o.id,
    customerName: o.customer.name,
    cargo: o.cargo,
    requiredVehicleType: o.requiredVehicleType,
    originLat: o.originLat,
    originLng: o.originLng,
  }));

  const busyCount = mapVehicles.filter((v) => v.busy).length;
  const idleCount = mapVehicles.length - busyCount;

  const typeOrder = ["2t", "4t", "10t", "trailer"];
  const typeLabels: Record<string, string> = {
    "2t": "2t車",
    "4t": "4t車",
    "10t": "10t車",
    trailer: "トレーラー",
  };

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col gap-4">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            配車盤(地図)
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            大阪・関西圏。車両(色=タイプ)と未割当案件(赤ピン)を地図上で確認できます。
          </p>
        </div>
        <div className="flex gap-2 text-xs">
          <span className="rounded-md border bg-white px-3 py-1.5">
            未割当案件{" "}
            <b className="text-rose-600">{mapOrders.length}</b> 件
          </span>
          <span className="rounded-md border bg-white px-3 py-1.5">
            待機中{" "}
            <b className="text-emerald-600">{idleCount}</b> / 運行中{" "}
            <b className="text-blue-600">{busyCount}</b>
          </span>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 gap-4">
        {/* 左サイドパネル */}
        <aside className="flex w-72 shrink-0 flex-col gap-3">
          {/* 凡例 */}
          <div className="rounded-lg border bg-white p-3">
            <div className="mb-2 text-xs font-semibold text-slate-700">凡例</div>
            <div className="space-y-1.5">
              {typeOrder.map((t) => {
                const count =
                  vehicleTypeCounts.find((c) => c.type === t)?._count._all ?? 0;
                return (
                  <div
                    key={t}
                    className="flex items-center gap-2 text-xs text-slate-600"
                  >
                    <span
                      className="inline-block h-3.5 w-3.5 rounded-full border border-white shadow"
                      style={{ background: VEHICLE_COLORS[t] }}
                    />
                    {typeLabels[t]}
                    <span className="ml-auto text-slate-400">{count}台</span>
                  </div>
                );
              })}
              <div className="flex items-center gap-2 pt-1 text-xs text-slate-600">
                <span
                  className="inline-block h-3 w-3 border-2 border-white shadow"
                  style={{
                    background: "#ef4444",
                    borderRadius: "50% 50% 50% 0",
                    transform: "rotate(-45deg)",
                  }}
                />
                未割当案件
              </div>
            </div>
          </div>

          {/* 未割当案件リスト */}
          <div className="flex min-h-0 flex-1 flex-col rounded-lg border bg-white">
            <div className="border-b px-3 py-2 text-xs font-semibold text-slate-700">
              未割当案件 ({mapOrders.length})
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {mapOrders.map((o) => (
                <div
                  key={o.id}
                  className="border-b px-3 py-2 text-xs hover:bg-slate-50"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-800">
                      #{o.id} {o.customerName}
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      {o.requiredVehicleType}
                    </Badge>
                  </div>
                  <div className="mt-0.5 text-slate-500">{o.cargo}</div>
                </div>
              ))}
              {mapOrders.length === 0 && (
                <div className="px-3 py-8 text-center text-xs text-slate-400">
                  未割当案件はありません
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* 地図 */}
        <div className="min-h-0 flex-1">
          <DispatchMap vehicles={mapVehicles} orders={mapOrders} />
        </div>
      </div>
    </div>
  );
}
