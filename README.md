# car_dispatcher

貨物・トラック運送業向け配車システムの**モック**。顧客提案でデモするための動くプロトタイプ。

> Claudeで作業する場合は [CLAUDE.md](CLAUDE.md) を最初に読んでください。

## 概要

- 顧客の中核要求: AI的マッチング (ルールベース + 過去実績 + 顧客評価) + 地図UI + 案件/車両/ドライバー管理
- 過去配車実績 約7000件のダミーデータでマッチング挙動を確認
- 詳細は [docs/01-context.md](docs/01-context.md) 以下を参照

## 起動

### 通常起動 (推奨)

```bash
npm install
npm run dev
```

ブラウザで http://localhost:3000

### Docker (環境移行用)

macOS / Windows-WSL のどちらでも同じ動作:

```bash
# 初回はイメージビルド + npm ci + DB 初期化 (seed) が走るため数分かかります
docker compose up

# 以降の起動 (DB は永続化される)
docker compose up

# 完全リセット (DB含めて作り直す場合)
docker compose down -v
rm -f dev.db
docker compose up --build
```

ブラウザで http://localhost:3000

詳細・WSL移行手順は [docs/migration-windows.md](docs/migration-windows.md) (Day3-C で整備)

## 技術スタック

| レイヤ | 採用 |
|---|---|
| フレームワーク | Next.js 16 (App Router) + TypeScript |
| UI | Tailwind CSS v4 + shadcn/ui |
| DB | SQLite + Prisma (Day1-C) |
| 地図 | MapLibre GL JS + 国土地理院タイル (Day2-A) |
| 開発環境統一 | Docker / docker-compose (Day1-E) |

## ディレクトリ

```
.
├── app/              Next.js App Router (画面 + API)
├── components/       UIコンポーネント (components/ui は shadcn)
├── lib/              共通ユーティリティ
├── prisma/           DBスキーマ + シード
├── docs/             プロジェクト経緯・仕様 (要読)
├── data/             受領CSV置き場 (NDA - .gitignore)
└── public/           静的ファイル
```

## デモ前の準備(速度対策)

Neon は無料プランで5分アイドル後にスリープ(scale-to-zero)するため、デモ直前にウォームアップ推奨:

1. **Neon を起こす**: `curl https://cardispatcher.vercel.app/api/warm`
2. **各ページを1回ずつ開く**(`/dispatch`, `/orders`, `/vehicles`, `/drivers`)→ キャッシュ生成

これでデモ中はキャッシュ(`unstable_cache`, revalidate 1時間)から配信され高速(各ページ約0.5s)。
データを作り直したら `curl -X POST https://cardispatcher.vercel.app/api/revalidate` でキャッシュクリア。
詳細は [docs/06-deployment-vercel.md](docs/06-deployment-vercel.md) / [docs/99-decisions.md](docs/99-decisions.md)。

## 注意事項

- 受領した顧客データは `data/` 配下に置き、Gitにコミットしない (`.gitignore` 済み)
- このリポジトリは社外秘
- テストは書きません (モック優先)
