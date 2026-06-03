import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
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

export const dynamic = "force-dynamic";

async function getStatsUncached() {
  const [
    customerCount,
    vehicleCount,
    driverCount,
    orderTotal,
    orderPending,
    orderAssigned,
    orderCompleted,
    dispatchTotal,
    dispatchInProgress,
    ratingCount,
    avgRating,
  ] = await Promise.all([
    prisma.customer.count(),
    prisma.vehicle.count(),
    prisma.driver.count(),
    prisma.order.count(),
    prisma.order.count({ where: { status: "pending" } }),
    prisma.order.count({ where: { status: "assigned" } }),
    prisma.order.count({ where: { status: "completed" } }),
    prisma.dispatchRecord.count(),
    prisma.dispatchRecord.count({ where: { status: "in_progress" } }),
    prisma.rating.count(),
    prisma.rating.aggregate({ _avg: { score: true } }),
  ]);

  const sampleCustomers = await prisma.customer.findMany({ take: 5, orderBy: { id: "asc" } });
  const sampleDrivers = await prisma.driver.findMany({
    take: 5,
    orderBy: { experienceYears: "desc" },
  });
  const sampleVehicles = await prisma.vehicle.findMany({ take: 5, orderBy: { id: "asc" } });

  return {
    counts: {
      customerCount,
      vehicleCount,
      driverCount,
      orderTotal,
      orderPending,
      orderAssigned,
      orderCompleted,
      dispatchTotal,
      dispatchInProgress,
      ratingCount,
      avgRating: avgRating._avg.score ?? 0,
    },
    sampleCustomers,
    sampleDrivers,
    sampleVehicles,
  };
}

const getStats = unstable_cache(getStatsUncached, ["db-check-stats"], {
  revalidate: 3600,
  tags: ["mockdata"],
});

export default async function DbCheckPage() {
  const { counts, sampleCustomers, sampleDrivers, sampleVehicles } = await getStats();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          DB 投入確認
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          開発確認用ページ。シード(ダミーデータ)投入結果を表示。
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">顧客(回収先事業場)</CardDescription>
            <CardTitle className="text-3xl font-semibold text-slate-900">
              {counts.customerCount.toLocaleString()}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">車両</CardDescription>
            <CardTitle className="text-3xl font-semibold text-slate-900">
              {counts.vehicleCount.toLocaleString()}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">ドライバー</CardDescription>
            <CardTitle className="text-3xl font-semibold text-slate-900">
              {counts.driverCount.toLocaleString()}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">案件 (合計)</CardDescription>
            <CardTitle className="text-3xl font-semibold text-slate-900">
              {counts.orderTotal.toLocaleString()}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-slate-500">
            未割当 {counts.orderPending} / 割当済 {counts.orderAssigned} / 完了 {counts.orderCompleted.toLocaleString()}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">配車実績 (合計)</CardDescription>
            <CardTitle className="text-3xl font-semibold text-slate-900">
              {counts.dispatchTotal.toLocaleString()}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-slate-500">
            進行中 {counts.dispatchInProgress} / 完了 {(counts.dispatchTotal - counts.dispatchInProgress).toLocaleString()}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">評価 (件数)</CardDescription>
            <CardTitle className="text-3xl font-semibold text-slate-900">
              {counts.ratingCount.toLocaleString()}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">平均評価</CardDescription>
            <CardTitle className="text-3xl font-semibold text-slate-900">
              {counts.avgRating.toFixed(2)}
              <span className="ml-1 text-sm font-normal text-slate-400">/ 5.00</span>
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">顧客サンプル (先頭5件)</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>名称</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sampleCustomers.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>{c.id}</TableCell>
                    <TableCell className="text-xs">{c.name}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">経験豊富なドライバー上位5名</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>氏名</TableHead>
                  <TableHead>経験</TableHead>
                  <TableHead>拠点</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sampleDrivers.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="text-xs">{d.name}</TableCell>
                    <TableCell className="text-xs">{d.experienceYears}年</TableCell>
                    <TableCell className="text-xs">
                      <Badge variant="outline">{d.homeBase}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">車両サンプル (先頭5件)</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>車番</TableHead>
                  <TableHead>タイプ</TableHead>
                  <TableHead>状態</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sampleVehicles.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="text-xs">{v.plateNumber}</TableCell>
                    <TableCell className="text-xs">
                      <Badge variant="outline">{v.type}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      <Badge
                        className={
                          v.status === "active"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-amber-100 text-amber-700"
                        }
                        variant="outline"
                      >
                        {v.status === "active" ? "稼働中" : "整備中"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">確認ポイント</CardTitle>
          <CardDescription>
            シード設計の意図(マッチングデモを面白くするための偏り)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-slate-700">
          <ul className="list-disc pl-6 space-y-1">
            <li>各ドライバーには「得意な顧客」を2-5社設定 → 過去配車で60%確率で割当</li>
            <li>得意顧客への配車は評価が高くなりがち(平均 4.4 ± ノイズ vs 通常 3.6 ± ノイズ)</li>
            <li>車両タイプは要件と一致するもののみ配車に使われる</li>
            <li>ドライバー保有資格は経験年数に応じて増える(中型→大型→牽引)</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
