/**
 * ダミーデータシーダー
 *
 * 設計方針:
 * - 関東圏(緯度経度)を中心に約7000件の配車実績を生成
 * - ドライバー × 顧客 / ドライバー × エリア に意図的に偏りを作る
 *   → マッチング段階で「得意領域」が見えるようにする
 * - 評価は drivers の「相性スコア」+ ノイズで生成
 * - 決定論的 (faker.seed) なので再実行で同じデータ
 */

import "dotenv/config";
import { PrismaClient } from "@/lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { faker } from "@faker-js/faker/locale/ja";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

faker.seed(20260528);

// 関東圏の緯度経度範囲
const KANTO = {
  latMin: 35.3,
  latMax: 36.3,
  lngMin: 139.0,
  lngMax: 140.4,
};

// 関西・大阪圏のエリア (大阪を中心に分散)
const AREAS = [
  { name: "大阪市北", lat: 34.71, lng: 135.5 },
  { name: "大阪市南", lat: 34.65, lng: 135.51 },
  { name: "堺", lat: 34.57, lng: 135.48 },
  { name: "東大阪", lat: 34.68, lng: 135.6 },
  { name: "豊中", lat: 34.78, lng: 135.47 },
  { name: "神戸", lat: 34.69, lng: 135.2 },
  { name: "尼崎", lat: 34.73, lng: 135.41 },
  { name: "京都", lat: 35.01, lng: 135.77 },
  { name: "奈良", lat: 34.68, lng: 135.83 },
  { name: "和歌山", lat: 34.23, lng: 135.17 },
];

const VEHICLE_TYPES = ["2t", "4t", "10t", "trailer"] as const;
const VEHICLE_CAPACITY: Record<string, number> = {
  "2t": 2000,
  "4t": 4000,
  "10t": 10000,
  trailer: 20000,
};
const VEHICLE_REQUIRED_LICENSE: Record<string, string> = {
  "2t": "普通",
  "4t": "中型",
  "10t": "大型",
  trailer: "大型,牽引",
};

const CARGO_TYPES = [
  { name: "一般雑貨", extraLicense: "" },
  { name: "食品", extraLicense: "" },
  { name: "建材", extraLicense: "" },
  { name: "冷凍", extraLicense: "" },
  { name: "危険物", extraLicense: "危険物" },
  { name: "精密機器", extraLicense: "" },
  { name: "重機", extraLicense: "" },
];

function randomLatLng(centerLat: number, centerLng: number, jitter = 0.2) {
  return {
    lat: centerLat + faker.number.float({ min: -jitter, max: jitter, multipleOf: 0.0001 }),
    lng: centerLng + faker.number.float({ min: -jitter, max: jitter, multipleOf: 0.0001 }),
  };
}

function pickWeighted<T>(items: T[], weights: number[]): T {
  const total = weights.reduce((s, w) => s + w, 0);
  let r = faker.number.float({ min: 0, max: total });
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

async function main() {
  console.log("🗑  既存データクリア...");
  await prisma.rating.deleteMany();
  await prisma.dispatchRecord.deleteMany();
  await prisma.order.deleteMany();
  await prisma.driver.deleteMany();
  await prisma.vehicle.deleteMany();
  await prisma.customer.deleteMany();

  // -------- Customer 50件 --------
  console.log("🏢 Customer 50件...");
  const customerInputs = Array.from({ length: 50 }).map(() => {
    const area = faker.helpers.arrayElement(AREAS);
    const { lat, lng } = randomLatLng(area.lat, area.lng, 0.15);
    return {
      name: `${faker.company.name()}${faker.helpers.arrayElement(["物流センター", "営業所", "工場", "倉庫"])}`,
      address: `${faker.location.state()}${faker.location.city()}${faker.location.streetAddress()}`,
      lat,
      lng,
    };
  });
  await prisma.customer.createMany({ data: customerInputs });
  const customers = await prisma.customer.findMany();

  // -------- Vehicle 30台 --------
  console.log("🚚 Vehicle 30台...");
  const vehicleInputs = Array.from({ length: 30 }).map((_, i) => {
    const type = pickWeighted(
      [...VEHICLE_TYPES],
      [3, 5, 4, 2] // 4tが多い、trailerが少ない
    );
    const baseArea = faker.helpers.arrayElement(AREAS);
    const { lat, lng } = randomLatLng(baseArea.lat, baseArea.lng, 0.05);
    return {
      plateNumber: `${faker.helpers.arrayElement(["なにわ", "大阪", "和泉", "神戸", "京都", "奈良"])} ${faker.string.numeric(4)} ${faker.string.alpha({ length: 1, casing: "upper" })}`,
      type,
      capacityKg: VEHICLE_CAPACITY[type],
      status: faker.helpers.weightedArrayElement([
        { weight: 9, value: "active" },
        { weight: 1, value: "maintenance" },
      ]),
      baseLat: lat,
      baseLng: lng,
    };
  });
  await prisma.vehicle.createMany({ data: vehicleInputs });
  const vehicles = await prisma.vehicle.findMany();

  // -------- Driver 40名 --------
  console.log("👷 Driver 40名...");
  const driverInputs = Array.from({ length: 40 }).map(() => {
    const homeArea = faker.helpers.arrayElement(AREAS);
    const { lat, lng } = randomLatLng(homeArea.lat, homeArea.lng, 0.08);
    const experienceYears = faker.number.int({ min: 1, max: 35 });
    // 経験年数に応じて保有資格が増える
    const licenses: string[] = ["普通"];
    if (experienceYears >= 2) licenses.push("中型");
    if (experienceYears >= 5 && faker.datatype.boolean(0.8)) licenses.push("大型");
    if (experienceYears >= 7 && faker.datatype.boolean(0.5)) licenses.push("牽引");
    if (faker.datatype.boolean(0.3)) licenses.push("危険物");
    if (faker.datatype.boolean(0.4)) licenses.push("フォークリフト");
    return {
      name: faker.person.lastName() + " " + faker.person.firstName(),
      experienceYears,
      licenses: licenses.join(","),
      homeBase: homeArea.name,
      homeLat: lat,
      homeLng: lng,
    };
  });
  await prisma.driver.createMany({ data: driverInputs });
  const drivers = await prisma.driver.findMany();

  // -------- 「ドライバー×顧客」相性の偏りを作る --------
  // 各ドライバーに「得意な顧客」を2-5社割り当てて、過去配車で優先される
  console.log("🔗 ドライバー得意領域の偏り設定...");
  const driverFavCustomers = new Map<number, Set<number>>();
  for (const d of drivers) {
    const n = faker.number.int({ min: 2, max: 5 });
    const favs = new Set(
      faker.helpers.arrayElements(customers.map((c) => c.id), n)
    );
    driverFavCustomers.set(d.id, favs);
  }

  // 各ドライバーの「得意エリア」(顧客の地理クラスタ的に)
  const driverFavAreas = new Map<number, string>();
  for (const d of drivers) {
    // home base 周辺を主に、たまに別エリアも
    driverFavAreas.set(d.id, d.homeBase);
  }

  // -------- 過去 DispatchRecord 7000件 (Order 込み) --------
  console.log("📦 過去 Order 7000件 + DispatchRecord 7000件 生成中...");
  const PAST_RECORDS = 7000;
  const now = new Date();
  const threeYearsAgoMs = now.getTime() - 365 * 3 * 24 * 60 * 60 * 1000;

  const orderRows: Array<Parameters<typeof prisma.order.create>[0]["data"]> = [];
  for (let i = 0; i < PAST_RECORDS; i++) {
    const customer = faker.helpers.arrayElement(customers);
    const cargo = faker.helpers.arrayElement(CARGO_TYPES);
    const vehicleType = pickWeighted([...VEHICLE_TYPES], [3, 5, 4, 2]);
    const requiredLicenses = [
      VEHICLE_REQUIRED_LICENSE[vehicleType],
      cargo.extraLicense,
    ]
      .filter(Boolean)
      .join(",");
    const dest = randomLatLng(customer.lat, customer.lng, 0.02);
    // 発地は customer 近辺(集荷)、着地は別エリア(配達先)
    const destArea = faker.helpers.arrayElement(AREAS);
    const destLoc = randomLatLng(destArea.lat, destArea.lng, 0.2);
    const requestedAt = new Date(
      threeYearsAgoMs +
        faker.number.float({ min: 0, max: now.getTime() - threeYearsAgoMs })
    );
    orderRows.push({
      customerId: customer.id,
      originAddress: customer.address,
      originLat: customer.lat,
      originLng: customer.lng,
      destAddress: `${faker.location.state()}${faker.location.city()}`,
      destLat: destLoc.lat,
      destLng: destLoc.lng,
      cargo: cargo.name,
      requiredVehicleType: vehicleType,
      requiredLicenses,
      requestedAt,
      status: "completed",
    });
  }
  // bulk insert in chunks
  console.log("   Order を chunk で投入中...");
  const CHUNK = 1000;
  for (let i = 0; i < orderRows.length; i += CHUNK) {
    await prisma.order.createMany({ data: orderRows.slice(i, i + CHUNK) });
  }
  const allOrders = await prisma.order.findMany({
    where: { status: "completed" },
    orderBy: { id: "asc" },
  });

  console.log("   DispatchRecord を生成中...");
  // 候補ドライバー: 案件の車両タイプの免許 + cargo の追加免許を持つドライバー
  function findDriversFor(vehicleType: string, requiredLicenses: string): number[] {
    const need = requiredLicenses.split(",").filter(Boolean);
    return drivers
      .filter((d) => {
        const has = d.licenses.split(",");
        return need.every((n) => has.includes(n));
      })
      .map((d) => d.id);
  }
  function findVehiclesFor(vehicleType: string): number[] {
    return vehicles.filter((v) => v.type === vehicleType).map((v) => v.id);
  }

  const dispatchRows: Array<Parameters<typeof prisma.dispatchRecord.create>[0]["data"]> = [];
  for (const order of allOrders) {
    const candDrivers = findDriversFor(order.requiredVehicleType, order.requiredLicenses);
    const candVehicles = findVehiclesFor(order.requiredVehicleType);
    if (candDrivers.length === 0 || candVehicles.length === 0) continue;

    // ドライバー選定: その顧客の「得意ドライバー」が60%確率で選ばれる
    let driverId: number;
    const favOf = drivers
      .filter((d) => driverFavCustomers.get(d.id)?.has(order.customerId))
      .map((d) => d.id);
    const favsAvailable = favOf.filter((id) => candDrivers.includes(id));
    if (favsAvailable.length > 0 && faker.datatype.boolean(0.6)) {
      driverId = faker.helpers.arrayElement(favsAvailable);
    } else {
      driverId = faker.helpers.arrayElement(candDrivers);
    }
    const vehicleId = faker.helpers.arrayElement(candVehicles);

    const dispatchedAt = order.requestedAt;
    const completedAt = new Date(dispatchedAt.getTime() + faker.number.int({ min: 1, max: 12 }) * 3600_000);
    dispatchRows.push({
      orderId: order.id,
      driverId,
      vehicleId,
      dispatchedAt,
      completedAt,
      status: "completed",
    });
  }
  for (let i = 0; i < dispatchRows.length; i += CHUNK) {
    await prisma.dispatchRecord.createMany({ data: dispatchRows.slice(i, i + CHUNK) });
  }

  // -------- Rating: 85% の配車実績に評価が付く --------
  console.log("⭐ Rating 生成中...");
  const dispatches = await prisma.dispatchRecord.findMany({
    select: { id: true, driverId: true, orderId: true },
  });
  const orderById = new Map(allOrders.map((o) => [o.id, o]));
  const ratingRows: Array<Parameters<typeof prisma.rating.create>[0]["data"]> = [];
  for (const dr of dispatches) {
    if (!faker.datatype.boolean(0.85)) continue;
    const order = orderById.get(dr.orderId);
    if (!order) continue;
    // ドライバー×顧客の相性で評価ベースを変える
    const isFav = driverFavCustomers.get(dr.driverId)?.has(order.customerId);
    const base = isFav ? 4.4 : 3.6;
    const noise = faker.number.float({ min: -0.6, max: 0.6 });
    let score = Math.round(base + noise);
    if (score < 1) score = 1;
    if (score > 5) score = 5;
    ratingRows.push({
      dispatchRecordId: dr.id,
      score,
      comment: faker.helpers.maybe(
        () => faker.helpers.arrayElement([
          "丁寧な対応でした",
          "時間通りで助かりました",
          "また指名したいです",
          "問題なし",
          "もう少し早く来てほしかった",
          "積み方が綺麗",
        ]),
        { probability: 0.3 }
      ) ?? null,
    });
  }
  for (let i = 0; i < ratingRows.length; i += CHUNK) {
    await prisma.rating.createMany({ data: ratingRows.slice(i, i + CHUNK) });
  }

  // -------- 現在の Order 100件 (pending / assigned) --------
  console.log("📋 現在の Order 100件 (pending/assigned)...");
  const currentOrders: Array<Parameters<typeof prisma.order.create>[0]["data"]> = [];
  for (let i = 0; i < 100; i++) {
    const customer = faker.helpers.arrayElement(customers);
    const cargo = faker.helpers.arrayElement(CARGO_TYPES);
    const vehicleType = pickWeighted([...VEHICLE_TYPES], [3, 5, 4, 2]);
    const requiredLicenses = [
      VEHICLE_REQUIRED_LICENSE[vehicleType],
      cargo.extraLicense,
    ].filter(Boolean).join(",");
    const destArea = faker.helpers.arrayElement(AREAS);
    const destLoc = randomLatLng(destArea.lat, destArea.lng, 0.2);
    const status = faker.helpers.weightedArrayElement([
      { weight: 6, value: "pending" },
      { weight: 4, value: "assigned" },
    ]);
    const daysAhead = faker.number.int({ min: 0, max: 7 });
    const requestedAt = new Date(now.getTime() + daysAhead * 24 * 3600_000 + faker.number.int({ min: 0, max: 86400 }) * 1000);
    currentOrders.push({
      customerId: customer.id,
      originAddress: customer.address,
      originLat: customer.lat,
      originLng: customer.lng,
      destAddress: `${faker.location.state()}${faker.location.city()}`,
      destLat: destLoc.lat,
      destLng: destLoc.lng,
      cargo: cargo.name,
      requiredVehicleType: vehicleType,
      requiredLicenses,
      requestedAt,
      status,
    });
  }
  await prisma.order.createMany({ data: currentOrders });

  // ----- assigned な Order には DispatchRecord (in_progress) を付ける -----
  const assignedOrders = await prisma.order.findMany({ where: { status: "assigned" } });
  for (const o of assignedOrders) {
    const candDrivers = findDriversFor(o.requiredVehicleType, o.requiredLicenses);
    const candVehicles = findVehiclesFor(o.requiredVehicleType);
    if (candDrivers.length === 0 || candVehicles.length === 0) continue;
    await prisma.dispatchRecord.create({
      data: {
        orderId: o.id,
        driverId: faker.helpers.arrayElement(candDrivers),
        vehicleId: faker.helpers.arrayElement(candVehicles),
        dispatchedAt: o.requestedAt,
        status: "in_progress",
      },
    });
  }

  // -------- サマリ --------
  const counts = {
    Customer: await prisma.customer.count(),
    Vehicle: await prisma.vehicle.count(),
    Driver: await prisma.driver.count(),
    Order: await prisma.order.count(),
    DispatchRecord: await prisma.dispatchRecord.count(),
    Rating: await prisma.rating.count(),
  };
  console.log("\n✅ シード完了");
  console.table(counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
