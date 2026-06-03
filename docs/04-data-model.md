# 04. データモデル

DB: SQLite (Prisma 経由)
スキーマ実体: [prisma/schema.prisma](../prisma/schema.prisma)
シーダー: [prisma/seed.ts](../prisma/seed.ts)

## エンティティ一覧

| Model | 役割 | 件数 (シード後) |
|---|---|---|
| Customer | 顧客 = 回収先事業場 | 50 |
| Vehicle | 車両 | 30 |
| Driver | ドライバー | 40 |
| Order | 案件 (現在 + 過去) | 7100 (現在100 + 過去7000) |
| DispatchRecord | 配車実績 (現在の割当 + 過去ログ) | 約7037 |
| Rating | 顧客→ドライバー評価 | 約5933 (実績の85%) |

## 主要フィールド

### Customer
- `name`, `address`, `lat`, `lng`

### Vehicle
- `plateNumber`, `type` (`"2t"|"4t"|"10t"|"trailer"`), `capacityKg`, `status` (`"active"|"maintenance"`), `baseLat/Lng`

### Driver
- `name`, `experienceYears`, `licenses` (カンマ区切り文字列: 普通,中型,大型,牽引,危険物,フォークリフト), `homeBase` (拠点エリア名), `homeLat/Lng`

### Order
- `customerId`, `originAddress/Lat/Lng` (集荷地=顧客所在), `destAddress/Lat/Lng` (配達先), `cargo` (品目), `requiredVehicleType`, `requiredLicenses`, `requestedAt`, `status` (`"pending"|"assigned"|"completed"|"cancelled"`)

### DispatchRecord
- `orderId` (unique), `driverId`, `vehicleId`, `dispatchedAt`, `completedAt`, `status` (`"in_progress"|"completed"|"cancelled"`)

### Rating
- `dispatchRecordId` (unique), `score` (1-5), `comment`

## ER 概要

```
Customer 1 -- * Order
Order 1 -- 0..1 DispatchRecord
DispatchRecord * -- 1 Driver
DispatchRecord * -- 1 Vehicle
DispatchRecord 1 -- 0..1 Rating
```

## シード設計の意図 (マッチングデモを面白くする偏り)

過去配車7000件には意図的なパターンを仕込んでいる:

1. **ドライバー × 顧客の相性**: 各ドライバーに「得意な顧客」を2-5社設定し、過去配車で60%確率でその組合せが選ばれる → マッチング段階で「過去実績スコア」が効く
2. **評価のばらつき**: 得意顧客への配車は平均4.4 ± ノイズ、それ以外は平均3.6 ± ノイズ → 「評価スコア」も得意領域と相関する
3. **エリアと拠点**: ドライバーには `homeBase`(関東圏10エリアから1つ)、車両にも `baseLat/Lng` を設定 → 「距離スコア」が機能する
4. **車両タイプ × 免許の整合**: 車両タイプに必要な免許を持つドライバーのみが過去配車に登場 → 硬制約フィルタの動作確認可能
5. **品目別の追加資格**: 危険物の案件は危険物免許保持者のみ

## 地理空間データの扱い

- ローカル (SQLite): 緯度/経度を Float、距離は Haversine 公式でアプリ側計算
- 本番 (PostgreSQL想定): PostGIS の GEOGRAPHY 型へ移行検討

## 顧客実データとの対応

受領 Excel/CSV のスキーマ確認後、カラムマッピングを追記予定。

---

## 複数拠点モデル(将来案 / 2026-06-01)

> ⚠️ 未実装。docs 反映のみ。仕様確定の経緯は [02-requirements.md](02-requirements.md) 参照。

### 背景

配車の単位が「**1案件 = 複数の集荷拠点を回って最後に1配送先へ(ミルクラン集荷型)**」と確定。
1日1車両=1案件(1:1)は不変。各拠点は1日1回、複数車両で重複なし。

### 現状モデルとの差分

現状 `Order` は `originLat/Lng` + `destLat/Lng` の**単一発着**。
将来は `Order` が**複数の立寄り拠点(集荷) + 1配送先**を持つ。

```
Order: cargo, requiredVehicleType, requestedAt, status, destAddress/Lat/Lng (最終配送先)
  Order 1 -- * OrderStop          ← 新規: 集荷拠点のリスト(順序付き)
  Order 1 -- 0..1 DispatchRecord  ← 1:1 のまま (driver + vehicle)

OrderStop (集荷立寄り)
  - id
  - orderId
  - customerId        (= 回収先事業場 / 拠点。複数集荷の各社)
  - sequence          (集荷の訪問順 1,2,3…)
  - lat, lng
  - cargoKg           (その拠点での積込量)
  - timeWindowStart?  (集荷希望時間帯, 任意)
  - timeWindowEnd?
```

- 最終配送先は `Order.destAddress/Lat/Lng` のまま流用可(配送は1か所)。
- 「重複なし」制約: 同日に同一 `customerId` が複数 OrderStop に現れないよう、シード/ロジックで担保。

### マッチング・地図への影響(再掲)

- **割当(案件→ドライバー/車両)は不変。** スコア計算の対象が単一発着 → 拠点集合に変わるだけ。
  - 距離 = 全集荷拠点 + 配送先を巡る総ルート距離
  - 積載 = 各拠点 cargoKg の合計 ≤ 車両 capacityKg(制約として有効化)
  - 得意度 = 拠点"群"に対するドライバーの過去実績
- 地図(配車盤) = 1案件 = 複数拠点を結ぶ1本の折れ線(訪問順 ①②③ + 配送先)。

### シード変更時にやること

- 各 Order に集荷拠点 2〜5 件を持たせて生成。
- 過去7000件も複数拠点化 → 得意領域抽出がより自然に。
- 同日・同拠点の重複を避ける制御を入れる。
