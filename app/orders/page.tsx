import Link from "next/link";
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
import { formatDateTime, statusBadgeClass, statusLabel } from "@/lib/format";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ status?: string }>;

const STATUS_TABS = [
  { value: "current", label: "現在 (未割当 + 割当済)" },
  { value: "pending", label: "未割当のみ" },
  { value: "assigned", label: "割当済のみ" },
  { value: "completed", label: "完了 (過去)" },
];

async function getOrdersUncached(status: string) {
  const where =
    status === "current"
      ? { status: { in: ["pending", "assigned"] } }
      : status === "completed"
        ? { status: "completed" }
        : { status };

  const [orders, counts] = await Promise.all([
    prisma.order.findMany({
      where,
      include: { customer: true, dispatch: { include: { driver: true } } },
      orderBy: { requestedAt: status === "completed" ? "desc" : "asc" },
      take: 200,
    }),
    {
      current: prisma.order.count({
        where: { status: { in: ["pending", "assigned"] } },
      }),
      pending: prisma.order.count({ where: { status: "pending" } }),
      assigned: prisma.order.count({ where: { status: "assigned" } }),
      completed: prisma.order.count({ where: { status: "completed" } }),
    },
  ]);

  const resolvedCounts = {
    current: await counts.current,
    pending: await counts.pending,
    assigned: await counts.assigned,
    completed: await counts.completed,
  };

  return { orders, counts: resolvedCounts };
}

const getOrders = unstable_cache(getOrdersUncached, ["orders"], {
  revalidate: 3600,
  tags: ["mockdata"],
});

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const status = sp.status ?? "current";
  const { orders, counts } = await getOrders(status);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          案件一覧
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          配車対象の案件 (回収先事業場からの輸送依頼) を確認できます。
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center gap-2">
            {STATUS_TABS.map((tab) => {
              const active = tab.value === status;
              const count =
                tab.value === "current"
                  ? counts.current
                  : counts[tab.value as "pending" | "assigned" | "completed"];
              return (
                <Link
                  key={tab.value}
                  href={`/orders?status=${tab.value}`}
                  className={
                    active
                      ? "rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white"
                      : "rounded-md border bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                  }
                >
                  {tab.label}
                  <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-700">
                    {count.toLocaleString()}
                  </span>
                </Link>
              );
            })}
          </div>
          <CardDescription className="mt-3 text-xs">
            上位200件を表示。完了タブは最近の200件 (時系列降順)。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60px]">ID</TableHead>
                <TableHead>顧客 (回収先)</TableHead>
                <TableHead>品目</TableHead>
                <TableHead className="w-[80px]">車両</TableHead>
                <TableHead>希望日時</TableHead>
                <TableHead>担当ドライバー</TableHead>
                <TableHead className="w-[90px]">ステータス</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-mono text-xs text-slate-500">
                    #{o.id}
                  </TableCell>
                  <TableCell className="text-xs">
                    <Link
                      href={`/orders/${o.id}`}
                      className="font-medium text-slate-900 hover:underline"
                    >
                      {o.customer.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-xs text-slate-700">
                    {o.cargo}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {o.requiredVehicleType}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-slate-600">
                    {formatDateTime(o.requestedAt)}
                  </TableCell>
                  <TableCell className="text-xs text-slate-700">
                    {o.dispatch?.driver?.name ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={statusBadgeClass(o.status)}
                    >
                      {statusLabel(o.status)}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {orders.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-8 text-center text-sm text-slate-400"
                  >
                    該当する案件がありません
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
