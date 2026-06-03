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

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ base?: string; sort?: string }>;

const HOME_BASES = [
  "大阪市北",
  "大阪市南",
  "堺",
  "東大阪",
  "豊中",
  "神戸",
  "尼崎",
  "京都",
  "奈良",
  "和歌山",
];

async function getDriverStatsUncached() {
  const drivers = await prisma.driver.findMany({
    orderBy: { id: "asc" },
  });

  // 各ドライバーの統計を並列取得
  const stats = await Promise.all(
    drivers.map(async (d) => {
      const [totalDispatches, completedDispatches, avg] = await Promise.all([
        prisma.dispatchRecord.count({ where: { driverId: d.id } }),
        prisma.dispatchRecord.count({
          where: { driverId: d.id, status: "completed" },
        }),
        prisma.rating.aggregate({
          _avg: { score: true },
          _count: { score: true },
          where: { dispatchRecord: { driverId: d.id } },
        }),
      ]);
      return {
        ...d,
        totalDispatches,
        completedDispatches,
        avgRating: avg._avg.score ?? null,
        ratingCount: avg._count.score,
      };
    })
  );

  return stats;
}

const getDriverStats = unstable_cache(getDriverStatsUncached, ["driver-stats"], {
  revalidate: 3600,
  tags: ["mockdata"],
});

export default async function DriversPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const baseFilter = sp.base ?? "all";
  const sort = sp.sort ?? "rating";

  let stats = await getDriverStats();
  if (baseFilter !== "all") {
    stats = stats.filter((s) => s.homeBase === baseFilter);
  }
  stats.sort((a, b) => {
    if (sort === "dispatches") return b.totalDispatches - a.totalDispatches;
    if (sort === "experience") return b.experienceYears - a.experienceYears;
    // default: rating
    return (b.avgRating ?? 0) - (a.avgRating ?? 0);
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          ドライバー一覧
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          配車対象のドライバー。経験年数・保有資格・累計配車件数・平均評価から特性を把握できます。
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-wrap items-center gap-1">
              <span className="mr-2 text-xs text-slate-500">拠点:</span>
              <Link
                href={`/drivers?sort=${sort}&base=all`}
                className={
                  baseFilter === "all"
                    ? "rounded-md bg-slate-900 px-2.5 py-1 text-[11px] text-white"
                    : "rounded-md border bg-white px-2.5 py-1 text-[11px] text-slate-600 hover:bg-slate-50"
                }
              >
                全て
              </Link>
              {HOME_BASES.map((b) => (
                <Link
                  key={b}
                  href={`/drivers?sort=${sort}&base=${encodeURIComponent(b)}`}
                  className={
                    baseFilter === b
                      ? "rounded-md bg-slate-900 px-2.5 py-1 text-[11px] text-white"
                      : "rounded-md border bg-white px-2.5 py-1 text-[11px] text-slate-600 hover:bg-slate-50"
                  }
                >
                  {b}
                </Link>
              ))}
            </div>
            <div className="ml-auto flex items-center gap-1">
              <span className="mr-2 text-xs text-slate-500">並べ替え:</span>
              {[
                { v: "rating", label: "評価順" },
                { v: "dispatches", label: "配車数順" },
                { v: "experience", label: "経験年数順" },
              ].map((opt) => (
                <Link
                  key={opt.v}
                  href={`/drivers?sort=${opt.v}&base=${encodeURIComponent(baseFilter)}`}
                  className={
                    sort === opt.v
                      ? "rounded-md bg-slate-900 px-2.5 py-1 text-[11px] text-white"
                      : "rounded-md border bg-white px-2.5 py-1 text-[11px] text-slate-600 hover:bg-slate-50"
                  }
                >
                  {opt.label}
                </Link>
              ))}
            </div>
          </div>
          <CardDescription className="mt-3 text-xs">
            平均評価は過去の配車に対する顧客評価(1-5)の平均。配車数は過去ログ全体。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60px]">ID</TableHead>
                <TableHead>氏名</TableHead>
                <TableHead className="w-[80px]">経験</TableHead>
                <TableHead className="w-[100px]">拠点</TableHead>
                <TableHead>保有資格</TableHead>
                <TableHead className="w-[110px] text-right">累計配車</TableHead>
                <TableHead className="w-[120px] text-right">平均評価</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-mono text-xs text-slate-500">
                    #{d.id}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/drivers/${d.id}`}
                      className="text-sm font-medium text-slate-900 hover:underline"
                    >
                      {d.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-xs text-slate-600">
                    {d.experienceYears} 年
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{d.homeBase}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {d.licenses.split(",").map((l) => (
                        <Badge
                          key={l}
                          variant="outline"
                          className="text-[10px] bg-slate-50"
                        >
                          {l}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-xs text-slate-700">
                    {d.totalDispatches.toLocaleString()} 件
                  </TableCell>
                  <TableCell className="text-right">
                    {d.avgRating !== null ? (
                      <div className="text-xs text-slate-700">
                        <span className="text-base font-semibold text-slate-900">
                          {d.avgRating.toFixed(2)}
                        </span>
                        <span className="text-slate-400">
                          {" "}
                          / 5 ({d.ratingCount})
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {stats.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-8 text-center text-sm text-slate-400"
                  >
                    該当するドライバーがいません
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
