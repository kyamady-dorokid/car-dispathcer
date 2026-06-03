"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Slider } from "@/components/ui/slider";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { MatchingData } from "@/lib/matching/recommend";

export type OrderOption = {
  id: number;
  customerName: string;
  cargo: string;
  requiredVehicleType: string;
};

const WEIGHTS = [
  { key: "customer", label: "得意顧客度", hint: "この顧客への過去配車実績", color: "#3b82f6" },
  { key: "experience", label: "経験量", hint: "総配車件数・経験年数", color: "#64748b" },
  { key: "rating", label: "顧客評価", hint: "過去の平均評価", color: "#16a34a" },
  { key: "distance", label: "近さ", hint: "拠点から集荷地までの距離", color: "#f97316" },
] as const;

export function MatchingBoard({
  orders,
  selectedOrderId,
  data,
}: {
  orders: OrderOption[];
  selectedOrderId: number | undefined;
  data: MatchingData | null;
}) {
  const router = useRouter();
  const [w, setW] = useState({
    customer: 40,
    experience: 15,
    rating: 25,
    distance: 20,
  });

  const ranked = useMemo(() => {
    if (!data) return [];
    const maxCust = Math.max(1, ...data.drivers.map((d) => d.pastCustomerCount));
    const maxExp = Math.max(1, ...data.drivers.map((d) => d.experienceYears));
    const maxTotal = Math.max(1, ...data.drivers.map((d) => d.totalCount));
    const maxDist = Math.max(1, ...data.drivers.map((d) => d.distanceKm));
    const wSum = w.customer + w.experience + w.rating + w.distance || 1;

    return data.drivers
      .map((d) => {
        const custN = d.pastCustomerCount / maxCust;
        const expN = (d.experienceYears / maxExp + d.totalCount / maxTotal) / 2;
        const ratingN = (d.avgRating ?? 0) / 5;
        const distN = 1 - d.distanceKm / maxDist; // 近いほど高い
        const score =
          (w.customer * custN +
            w.experience * expN +
            w.rating * ratingN +
            w.distance * distN) /
          wSum;
        return { ...d, custN, expN, ratingN, distN, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  }, [data, w]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          マッチング推奨
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          ルール(車両タイプ・免許)で絞り込み → 過去実績・評価・距離をスコア化して推奨。
          重みスライダーを動かすと順位が即座に変わります。
        </p>
      </div>

      {/* 案件選択 + 条件 */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm font-medium text-slate-700">
              対象案件:
            </label>
            <select
              className="rounded-md border bg-white px-3 py-1.5 text-sm"
              value={selectedOrderId ?? ""}
              onChange={(e) =>
                router.push(`/matching?orderId=${e.target.value}`)
              }
            >
              {orders.map((o) => (
                <option key={o.id} value={o.id}>
                  #{o.id} {o.customerName} / {o.cargo} / {o.requiredVehicleType}
                </option>
              ))}
            </select>
          </div>
          {data && (
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <span className="rounded bg-slate-100 px-2 py-1">
                顧客: <b>{data.order.customerName}</b>
              </span>
              <span className="rounded bg-slate-100 px-2 py-1">
                品目: <b>{data.order.cargo}</b>
              </span>
              <span className="rounded bg-slate-100 px-2 py-1">
                必要車両: <b>{data.order.requiredVehicleType}</b>
              </span>
              <span className="rounded bg-slate-100 px-2 py-1">
                必要免許: <b>{data.order.requiredLicenses.join("・") || "なし"}</b>
              </span>
            </div>
          )}
        </CardHeader>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
        {/* 重み調整 */}
        <Card className="h-fit">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">スコア重み調整</CardTitle>
            <CardDescription className="text-xs">
              配車係の方針に合わせて調整 → 推奨順位がリアルタイムに変化
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {WEIGHTS.map((item) => (
              <div key={item.key}>
                <div className="mb-1.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-3 w-3 rounded-full"
                      style={{ background: item.color }}
                    />
                    <span className="text-sm font-medium text-slate-700">
                      {item.label}
                    </span>
                  </div>
                  <span className="text-sm font-semibold text-slate-900">
                    {w[item.key as keyof typeof w]}
                  </span>
                </div>
                <Slider
                  value={[w[item.key as keyof typeof w]]}
                  onValueChange={(value) => {
                    const v = Array.isArray(value) ? value[0] : value;
                    setW((prev) => ({ ...prev, [item.key]: v }));
                  }}
                  min={0}
                  max={100}
                  step={5}
                />
                <p className="mt-1 text-[11px] text-slate-400">{item.hint}</p>
              </div>
            ))}
            <div className="flex gap-2 pt-1">
              <button
                onClick={() =>
                  setW({ customer: 40, experience: 15, rating: 25, distance: 20 })
                }
                className="rounded-md border bg-white px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50"
              >
                標準
              </button>
              <button
                onClick={() =>
                  setW({ customer: 70, experience: 10, rating: 15, distance: 5 })
                }
                className="rounded-md border bg-white px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50"
              >
                関係重視
              </button>
              <button
                onClick={() =>
                  setW({ customer: 10, experience: 10, rating: 15, distance: 65 })
                }
                className="rounded-md border bg-white px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50"
              >
                効率重視
              </button>
            </div>
          </CardContent>
        </Card>

        {/* 推奨ランキング */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              推奨ドライバー(上位{ranked.length})
            </CardTitle>
            <CardDescription className="text-xs">
              硬制約(車両タイプ・免許)を満たす {data?.drivers.length ?? 0}{" "}
              名から、重み付きスコア順に表示
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {ranked.map((d, i) => (
              <div
                key={d.driverId}
                className="rounded-lg border bg-white p-3"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                      i === 0
                        ? "bg-amber-400 text-white"
                        : i < 3
                          ? "bg-slate-700 text-white"
                          : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    {i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-900">
                        {d.driverName}
                      </span>
                      <Badge variant="outline" className="text-[10px]">
                        {d.homeBase}
                      </Badge>
                      <span className="text-xs text-slate-400">
                        {d.experienceYears}年
                      </span>
                    </div>
                    {/* 総合スコアバー */}
                    <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-500"
                        style={{ width: `${Math.round(d.score * 100)}%` }}
                      />
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-lg font-bold text-slate-900">
                      {Math.round(d.score * 100)}
                    </div>
                    <div className="text-[10px] text-slate-400">スコア</div>
                  </div>
                </div>
                {/* スコア内訳 */}
                <div className="mt-2 grid grid-cols-4 gap-2 text-[11px]">
                  <div className="rounded bg-blue-50 px-2 py-1">
                    <div className="text-slate-500">得意顧客</div>
                    <div className="font-semibold text-blue-700">
                      {d.pastCustomerCount}回
                    </div>
                  </div>
                  <div className="rounded bg-slate-50 px-2 py-1">
                    <div className="text-slate-500">総配車</div>
                    <div className="font-semibold text-slate-700">
                      {d.totalCount}件
                    </div>
                  </div>
                  <div className="rounded bg-emerald-50 px-2 py-1">
                    <div className="text-slate-500">評価</div>
                    <div className="font-semibold text-emerald-700">
                      {d.avgRating !== null ? d.avgRating.toFixed(2) : "—"}
                    </div>
                  </div>
                  <div className="rounded bg-orange-50 px-2 py-1">
                    <div className="text-slate-500">距離</div>
                    <div className="font-semibold text-orange-700">
                      {d.distanceKm.toFixed(1)}km
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {ranked.length === 0 && (
              <div className="py-8 text-center text-sm text-slate-400">
                条件を満たすドライバーがいません
              </div>
            )}

            {/* 車両候補 */}
            {data && data.vehicles.length > 0 && (
              <div className="mt-4 border-t pt-3">
                <div className="mb-2 text-xs font-semibold text-slate-700">
                  推奨車両(タイプ {data.order.requiredVehicleType} ・近い順)
                </div>
                <div className="flex flex-wrap gap-2">
                  {data.vehicles.slice(0, 6).map((v) => (
                    <div
                      key={v.id}
                      className="rounded-md border bg-white px-3 py-1.5 text-xs"
                    >
                      <span className="font-medium">{v.plateNumber}</span>
                      <span className="ml-2 text-slate-400">
                        {v.distanceKm.toFixed(1)}km
                      </span>
                      <Badge
                        variant="outline"
                        className={`ml-2 text-[10px] ${
                          v.busy
                            ? "bg-blue-100 text-blue-700"
                            : "bg-emerald-100 text-emerald-700"
                        }`}
                      >
                        {v.busy ? "運行中" : "待機中"}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
