# 配車システム モック - Claude セッション向けガイド

このリポジトリは、客先(貨物・トラック運送業)に対する配車システム企画提案の**動くモック**です。
新しいClaudeセッションは、まずこのファイルと `docs/` を読んで状況把握してください。

## プロジェクトの目的

- NDA下で先方から受領した過去配車実績(約7000件)をベースに、要求機能の「動き」を見せて議論を加速する
- 顧客の中核要求: **AI的マッチング(ルール + 過去実績 + 顧客評価)** + 地図UI + 案件/車両/ドライバー管理
- 初期はローカル(macOS) → 将来 Windows/WSL に移行 → さらに AWS へ移行予定

## 開発方針 (重要)

詳細は [docs/01-context.md](docs/01-context.md) と [docs/03-architecture.md](docs/03-architecture.md) 参照。

- **速度最優先**: 3日でデモまで。システム的綺麗さ(抽象化、テスト、最適化)は不要
- **見た目重視**: 顧客に見せて議論するのが一義
- **段階的ブラウザ確認**: 各タスクのアウトプットは `localhost:3000` で見える状態を作る
- **環境移行対応**: Docker (`docker compose up` で macOS/WSL どちらでも動く) を Day1-E で整備
- **リポジトリ内コンテキスト保持**: 経緯/仕様/判断は `docs/` 配下に残す
- **テストは書かない**: モックなので動けばよい
- **リファクタは控える**: 手作業/コピペ/ハードコーディングOK

## 技術スタック

- Next.js **16.2.6** (App Router) + React 19 + TypeScript
- Tailwind CSS **v4** + shadcn/ui (※shadcnは `asChild` ではなく `render` プロップ使用に変わっている)
- Prisma **v7** + **Neon (Postgres)** (`@prisma/adapter-pg`) ← SQLiteではない
- MapLibre GL JS + 国土地理院タイル (Day2-A)
- ダミーデータシード (faker-js) — 実データは Day1-D 以降の検討で接続

**Next.js 16 注意**: 私の学習データと差異があるとのこと。実装前に `node_modules/next/dist/docs/01-app/` を確認すること。
`AGENTS.md` も併せて読むこと(自動生成、Next.js 公式の AIエージェント向け注意書き)。

## ロードマップ (3日 + ブラウザ確認ポイント)

| Phase | アウトプット | URL |
|---|---|---|
| Day1-A ✓ | Next.js 初期化 | `/` |
| Day1-B ✓ | ドキュメント + サイドバー + 仮ダッシュボード | `/` |
| Day1-C ✓ | Prisma + Neon(Postgres) + ダミーデータシード | `/dev/db-check` |
| Day1-D ✓ | 案件・車両・ドライバー 一覧 | `/orders`, `/vehicles`, `/drivers` |
| Day1-E ✓ | Docker 整備 | (環境確認) |
| Day2-A ✓ | 地図ベース配車盤 (大阪中心) | `/dispatch` |
| Day2-B ✓ | マッチング推奨 + 重み調整UI | `/matching` |
| Day3-A | ドライバー評価/得意領域 | `/drivers/[id]` |
| Day3-B | KPI ダッシュボード | `/` |
| Day3-C | 見た目調整 + デモシナリオ + 環境移行手順 | (docs整備) |

## 現在の作業状態 (2026-06-03)

**Day1〜Day2 完了。Vercel + Neon (Postgres) で本番稼働中。**
SQLite→Postgres 切替 + Neon 反映 + ローカル動作確認まで完了。
DBは Neon (`@prisma/adapter-pg`)。残るは Day3 実装。

- 本番URL: **https://cardispatcher.vercel.app** (ID: testuser / PW: testpass ← 後で変更予定)
- Basic認証: `proxy.ts` で実装 (Vercel Password Protectionが$150/月化のため自前実装)
- Vercel CLI で直 push: `npx vercel --prod --scope kyamady-dorokid`

→ 詳細は [docs/06-deployment-vercel.md](docs/06-deployment-vercel.md)。
⚠️ Claude の Bash で Neon 接続する操作(`db push`/`seed`/`dev`)は `dangerouslyDisableSandbox: true` 必須(5432がサンドボックスでブロックされる)。MCP(HTTPS)は影響なし。

## 起動手順

```bash
npm install
npx prisma generate   # lib/generated/prisma を生成 (.gitignore対象のため必須)
npm run dev
# → http://localhost:3000
```

⚠️ **Neon 接続が必要**: `.env` に `DATABASE_URL` が必要。`.env.example` を参照して設定すること。
Claude Code の Bash からは `dangerouslyDisableSandbox: true` が必要 (TCP 5432 ブロック)。

Docker (環境移行対応):
```bash
docker compose up           # 初回: ビルド + npm ci + DB 初期化 + seed (数分)
# → http://localhost:3000
```

Docker 構成のポイント:
- `Dockerfile`: node:22-slim ベース、better-sqlite3 用に python3/make/g++ 同梱
- `docker/entrypoint.sh`: 初回起動時に `prisma generate` + `db push` + `seed` を自動実行
- `docker-compose.yml`: ソースは bind mount(HMR有効)、`node_modules`/`.next` は名前付きボリュームでホストOS非依存
- ファイル変更検知のために `WATCHPACK_POLLING=true` (WSL対応)
- ※ Docker は現状 Postgres 未対応(SQLite 前提のまま)。優先度低で後回し

## ディレクトリ構成

- `app/` — Next.js App Router (ページ・APIエンドポイント)
- `components/` — UIコンポーネント (`components/ui/` は shadcn 生成)
- `lib/` — サーバ/クライアント共通ユーティリティ、マッチングロジック
- `lib/geo/` — 距離計算 (将来 Google/ZENRIN トラックルートへ差替え前提)
- `lib/matching/` — マッチング推奨ロジック
- `prisma/` — DBスキーマ + シード (Neon Postgres)
- `docs/` — プロジェクト経緯・仕様・意思決定の記録 (**リポジトリ内コンテキスト保持の中核**)
- `data/` — 顧客から受領したCSV/Excelの置き場 (.gitignore 必須、NDA注意)
- `public/` — 静的ファイル

## ⚠️ 顧客データ取り扱い

`data/` 配下に顧客データを置く場合、必ず `.gitignore` 対象に。NDAあり。
コミット前に `git status` で確認すること。
