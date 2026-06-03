# 03. アーキテクチャ・技術選定

## 採用スタックと選定理由

| レイヤ | 採用 | 理由 |
|---|---|---|
| フレームワーク | Next.js 16 (App Router) + TypeScript | フルスタックTS、AWS Amplify/ECS/App Runner 等へ移行容易、SSR/CSR両対応で配車盤UIに強い |
| パッケージ管理 | npm | pnpmはWindows/WSL でやや不安定、npmが最も手堅い (Docker内では差ゼロ) |
| UI | Tailwind CSS v4 + shadcn/ui | コピペで業務UI即構築、shadcnはBase UI ベースに刷新済 |
| DB (ローカル) | SQLite + Prisma | ファイル1個、7000件規模で十分高速、AWSへPostgreSQL移行容易 |
| DB (本番想定) | RDS PostgreSQL + PostGIS | 地理空間検索対応、Prismaスキーマ移行可能 |
| 地図 | MapLibre GL JS + 国土地理院タイル | ライセンス費0、本番でMapbox/Google Maps差替え可 |
| マッチング | TypeScript関数 (API Route) | 段階1はTSで完結、必要に応じてPython FastAPI に切出し |
| 環境差吸収 | Docker / docker-compose | macOS/WSL 両対応、Day1-E で整備 |

## 構成方針

### Server Component 中心

- `app/<path>/page.tsx` は基本Server Component (デフォルト)
- 直接Prisma経由でDBアクセス → そのままレンダリング
- インタラクション必要箇所のみ `"use client"` でClient Component化
- API化(`app/api/.../route.ts`) はマッチング処理など別画面/外部から叩く用途のみ

### マッチング処理の段階的高度化

- **段階1 (Day2-B)**: ルールベース硬制約 + 重み付き総和スコア (TS関数)
- **段階2**: 統計的特徴量(EMA評価、エリア・顧客別実績集計)
- **段階3**: 協調フィルタリング/最適化ソルバー(OR-Tools等、必要なら Python マイクロサービス分離)

### AWS 移行方針 (将来)

- アプリ: ECS Fargate
- DB: RDS PostgreSQL (PostGIS有効)
- データ: S3
- 配信: CloudFront
- IaC: AWS CDK
- 段階: モックがある程度完成し、顧客の合意が見えてから着手

## ディレクトリ構成

[CLAUDE.md](../CLAUDE.md) の「ディレクトリ構成」セクション参照。

## 主要な非採用案 (記録)

- **pnpm**: WSL移行時の不安定さを避けるためnpmに統一
- **Pythonマイクロサービス先行**: マッチングロジックを最初からPython分離する案も検討したが、TSでルールベースまで完結する方が段階1としてシンプル。EDA/特徴量検討フェーズで再検討
- **shadcn `asChild`**: shadcn v4 で `render` プロップに変更されているので注意

## 既知の制約・注意点

- **Next.js 16 は新しいバージョン**。一部APIが私の学習データと差異あり。実装時は `node_modules/next/dist/docs/01-app/` を参照
- **shadcn は Base UI 移行済**。`asChild` ではなく `render` プロップを使用
