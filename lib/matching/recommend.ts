import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { haversineKm } from "@/lib/geo/distance";

/**
 * マッチング候補の算出 (Day2-B)
 *
 * 処理:
 *  1. 硬制約フィルタ … 案件の requiredLicenses を満たすドライバーのみ
 *  2. 各候補ドライバーの「生スコア要素」を集計
 *      - pastCustomerCount: その顧客への過去配車回数(得意顧客度)
 *      - totalCount       : 総配車数(経験量)
 *      - avgRating        : 顧客からの平均評価
 *      - distanceKm       : 拠点→集荷地(発地)の距離
 *  3. 車両候補 … 車両タイプ適合かつ稼働可能(運行中でない)
 *
 * 重み付けによる最終スコア合成は client 側で行う(スライダーで即時再計算)。
 */

export type DriverCandidate = {
  driverId: number;
  driverName: string;
  homeBase: string;
  experienceYears: number;
  licenses: string[];
  pastCustomerCount: number;
  totalCount: number;
  avgRating: number | null;
  ratingCount: number;
  distanceKm: number;
};

export type VehicleCandidate = {
  id: number;
  plateNumber: string;
  type: string;
  busy: boolean;
  distanceKm: number;
};

export type MatchingData = {
  order: {
    id: number;
    customerName: string;
    cargo: string;
    requiredVehicleType: string;
    requiredLicenses: string[];
    originAddress: string;
  };
  drivers: DriverCandidate[];
  vehicles: VehicleCandidate[];
};

async function getCandidatesUncached(
  orderId: number
): Promise<MatchingData | null> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { customer: true },
  });
  if (!order) return null;

  const need = order.requiredLicenses.split(",").filter(Boolean);
  const allDrivers = await prisma.driver.findMany();
  const eligible = allDrivers.filter((d) => {
    const has = d.licenses.split(",");
    return need.every((n) => has.includes(n));
  });

  const drivers: DriverCandidate[] = await Promise.all(
    eligible.map(async (d) => {
      const [pastCustomerCount, totalCount, agg] = await Promise.all([
        prisma.dispatchRecord.count({
          where: { driverId: d.id, order: { customerId: order.customerId } },
        }),
        prisma.dispatchRecord.count({ where: { driverId: d.id } }),
        prisma.rating.aggregate({
          _avg: { score: true },
          _count: { score: true },
          where: { dispatchRecord: { driverId: d.id } },
        }),
      ]);
      return {
        driverId: d.id,
        driverName: d.name,
        homeBase: d.homeBase,
        experienceYears: d.experienceYears,
        licenses: d.licenses.split(","),
        pastCustomerCount,
        totalCount,
        avgRating: agg._avg.score,
        ratingCount: agg._count.score,
        distanceKm: haversineKm(
          d.homeLat,
          d.homeLng,
          order.originLat,
          order.originLng
        ),
      };
    })
  );

  // 車両候補
  const typedVehicles = await prisma.vehicle.findMany({
    where: { type: order.requiredVehicleType, status: "active" },
  });
  const inProgress = await prisma.dispatchRecord.findMany({
    where: { status: "in_progress" },
    select: { vehicleId: true },
  });
  const busy = new Set(inProgress.map((x) => x.vehicleId));
  const vehicles: VehicleCandidate[] = typedVehicles
    .map((v) => ({
      id: v.id,
      plateNumber: v.plateNumber,
      type: v.type,
      busy: busy.has(v.id),
      distanceKm: haversineKm(
        v.baseLat,
        v.baseLng,
        order.originLat,
        order.originLng
      ),
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm);

  return {
    order: {
      id: order.id,
      customerName: order.customer.name,
      cargo: order.cargo,
      requiredVehicleType: order.requiredVehicleType,
      requiredLicenses: need,
      originAddress: order.originAddress,
    },
    drivers,
    vehicles,
  };
}

export const getCandidates = unstable_cache(
  getCandidatesUncached,
  ["matching-candidates"],
  { revalidate: 3600, tags: ["mockdata"] }
);
