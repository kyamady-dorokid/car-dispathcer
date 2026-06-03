import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { statusBadgeClass, statusLabel } from "@/lib/format";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ type?: string }>;

const TYPE_TABS = [
  { value: "all", label: "全て" },
  { value: "2t", label: "2t" },
  { value: "4t", label: "4t" },
  { value: "10t", label: "10t" },
  { value: "trailer", label: "トレーラー" },
];

const getVehiclesData = unstable_cache(
  async (typeFilter: string) => {
    const where = typeFilter === "all" ? {} : { type: typeFilter };
    const vehicles = await prisma.vehicle.findMany({
      where,
      orderBy: [{ type: "asc" }, { plateNumber: "asc" }],
    });
    const activeDispatches = await prisma.dispatchRecord.findMany({
      where: { status: "in_progress" },
      select: { vehicleId: true },
    });
    const counts = {
      all: await prisma.vehicle.count(),
      "2t": await prisma.vehicle.count({ where: { type: "2t" } }),
      "4t": await prisma.vehicle.count({ where: { type: "4t" } }),
      "10t": await prisma.vehicle.count({ where: { type: "10t" } }),
      trailer: await prisma.vehicle.count({ where: { type: "trailer" } }),
    };
    return {
      vehicles,
      busyVehicleIds: activeDispatches.map((d) => d.vehicleId),
      counts,
    };
  },
  ["vehicles-data"],
  { revalidate: 3600, tags: ["mockdata"] }
);

export default async function VehiclesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const typeFilter = sp.type ?? "all";

  const { vehicles, busyVehicleIds: busyIds, counts } =
    await getVehiclesData(typeFilter);
  const busyVehicleIds = new Set(busyIds);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          車両一覧
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          保有車両の一覧。タイプ別フィルタと稼働状況を確認できます。
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center gap-2">
            {TYPE_TABS.map((tab) => {
              const active = tab.value === typeFilter;
              const count = counts[tab.value as keyof typeof counts];
              return (
                <Link
                  key={tab.value}
                  href={`/vehicles?type=${tab.value}`}
                  className={
                    active
                      ? "rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white"
                      : "rounded-md border bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                  }
                >
                  {tab.label}
                  <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-700">
                    {count}
                  </span>
                </Link>
              );
            })}
          </div>
          <CardDescription className="mt-3 text-xs">
            稼働中バッジは「現在 進行中の配車に従事している」状態を表します。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60px]">ID</TableHead>
                <TableHead>車両番号</TableHead>
                <TableHead className="w-[100px]">タイプ</TableHead>
                <TableHead className="w-[120px]">最大積載量</TableHead>
                <TableHead className="w-[110px]">車両状態</TableHead>
                <TableHead className="w-[110px]">配車状況</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vehicles.map((v) => {
                const busy = busyVehicleIds.has(v.id);
                return (
                  <TableRow key={v.id}>
                    <TableCell className="font-mono text-xs text-slate-500">
                      #{v.id}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/vehicles/${v.id}`}
                        className="text-sm font-medium text-slate-900 hover:underline"
                      >
                        {v.plateNumber}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{v.type}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-slate-600">
                      {v.capacityKg.toLocaleString()} kg
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={statusBadgeClass(v.status)}
                      >
                        {statusLabel(v.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          busy
                            ? "bg-blue-100 text-blue-700"
                            : "bg-slate-100 text-slate-600"
                        }
                      >
                        {busy ? "運行中" : "待機中"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
              {vehicles.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-8 text-center text-sm text-slate-400"
                  >
                    該当する車両がありません
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
