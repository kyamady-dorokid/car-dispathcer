# 06. デプロイ方式 — Vercel + Neon (顧客閲覧環境)

> ステータス: **実施中(2026-06-01)**。DB は **Neon (Postgres) で確定**。
> 目的: 当初要望「先方にも見える環境」を Vercel で実現する(AWS は将来の本番)。

## 🔖 再開ポイント(2026-06-01 時点)

> Claude Code 再起動で Neon MCP ツールを有効化するため、ここで一旦中断。
> 再起動後の新セッションは **CLAUDE.md → この節** を読んで継続すること。

### 完了済み

- ✅ Neon サインアップ + プロジェクト作成(`sample-project` / aws-ap-southeast-1 / PG17)
- ✅ `.env` に Neon 接続文字列設定済み(`postgresql`, **direct接続/pooler なし**, `sslmode=require`)
- ✅ Neon MCP ツール有効化済み(再起動後に利用可能に。`list_projects`/`get_connection_string` 等)
- ✅ 準備ファイル: `.vercelignore`, `.env.example`
- ✅ **SQLite → Postgres コード切替 完了**
  - `@prisma/adapter-pg` + `pg` 導入、`schema.prisma` を `provider=postgresql`、`lib/prisma.ts`/`seed.ts` の adapter を `PrismaPg` に、`package.json` build を `prisma generate && next build` に
- ✅ **Neon にスキーマ反映(`db push`)+ シード投入 完了**(Customer 50 / Vehicle 30 / Driver 40 / Order 7,100 / DispatchRecord 7,037 / Rating 5,933)
- ✅ **ローカルから Neon 接続で全画面 動作確認 完了**(`localhost:3000`, `/dev/db-check` 件数一致)

### ⚠️ Claude 実行環境での注意(重要)

- Claude の Bash は**サンドボックスが外部TCP(Postgres 5432)をブロック**する。`db push` / `seed` / `npm run dev`(Neon接続)は **`dangerouslyDisableSandbox: true` で実行**が必要。
- MCP(HTTPS API)経由の Neon 操作はサンドボックスでも可。
- 人間が普通のターミナルで `npm run dev` する分にはこの制約はない。

### Vercel デプロイ(フェーズ2-3)

- ✅ Vercel ログイン(`kyamady-5922` / scope `kyamady-dorokid`)
- ✅ `npx vercel link`(プロジェクト `kyamady-dorokid/car_dispatcher` 作成、projectId `prj_B7jlc6hXP4Ej1M39N7DR2e78AEVc`)
- ✅ pooler 接続文字列を `.env` の direct 版から生成(`@ep-xxx.` の前に `-pooler` 挿入)、**Production** env に登録
  - ⚠️ Preview env は CLI の挙動で未登録(本番デプロイには不要)。必要なら `vercel env add DATABASE_URL preview --value <値> --yes --scope kyamady-dorokid`
- ✅ ビルドエラー対応: `tsconfig.json` の exclude に `prisma/seed.ts` を追加(seed の型エラーで `next build` がこけたため。seed はアプリ実行に不要)
- ✅ `npx vercel --prod` デプロイ成功(READY)
- ✅ **本番で Neon(pooler)接続 動作確認済み**
  - 本番URL(公開エイリアス): **https://cardispatcher.vercel.app** → `/dev/db-check` で件数一致を確認
  - deployment 固有URL は team の Vercel Authentication で 401(team メンバーのみ)

### アクセス保護: アプリ側 Basic 認証(✅ 完了)

- Vercel の Password Protection が **$150/月** に有償化したため、**アプリ側で Basic 認証を自前実装**(`proxy.ts`。Next.js 16 は middleware→proxy にリネーム)
- ID/パスワードは Vercel 環境変数 `BASIC_AUTH_USER` / `BASIC_AUTH_PASSWORD`(Production に設定済み。どちらか未設定なら保護スキップ)
- 現在は **仮の `testuser` / `testpass`**(後で変更予定)
- 本番で動作確認済み: 認証なし→401、正認証→200(Neon データ表示)
- **パスワード変更手順**:
  1. `npx vercel env rm BASIC_AUTH_PASSWORD production --yes --scope kyamady-dorokid`
  2. `npx vercel env add BASIC_AUTH_PASSWORD production --value <新PW> --yes --scope kyamady-dorokid`
  3. `npx vercel --prod --scope kyamady-dorokid`(再デプロイで反映)
  - ローカル `.env` の `BASIC_AUTH_PASSWORD` も合わせて更新
- 顧客へは **本番URL + ID/パスワード** を共有

### メモ

- 本番デプロイは Vercel CLI 直push(`npx vercel --prod --scope kyamady-dorokid`)。git は介していない(git コミットは別途必要なら実施)。
- 再デプロイ手順: コード変更 → `npx vercel --prod --scope kyamady-dorokid`
- SSL警告(`uselibpqcompat=true&sslmode=require`)が出るが非致命的。
- `dev.db` はもう不使用(削除可)。Docker 構成は SQLite 前提のままで Postgres 対応は後回し。

---

## 方針サマリ

| 項目 | 決定 (2026-06-01) |
|---|---|
| ホスティング | Vercel(顧客が URL で閲覧できる環境) |
| デプロイ連携 | **Vercel CLI 直 push**(`vercel` コマンド。GitHub 連携は介さない) |
| アクセス保護 | **アプリ側 Basic 認証**(`proxy.ts`)。Vercel Password Protection が$150/月化したため自前実装 |
| データベース | **Neon (Postgres) 確定** |
| DB接続方式 | **`@prisma/adapter-pg`(node-postgres)で統一**。ローカルも Vercel も同じコードで Neon に接続 |
| ローカル開発 | SQLite を廃止し、ローカルも Neon(同一 or 開発用ブランチ)に接続。DBエンジンを dev/staging/本番で統一 |

## なぜ Neon + adapter-pg か

- Neon は Vercel ネイティブ統合の**サーバーレス Postgres**。将来の AWS RDS PostgreSQL まで**DBエンジンを Postgres で一貫**(SQLite→Postgres の二度手間を回避)。
- `@prisma/adapter-pg`(node-postgres ベース)を使えば、**ローカルも Vercel も同一コード**で Neon に TCP 接続できる(Neon 専用 serverless driver より分岐が少なくシンプル)。
- Neon の **Pooled connection**(PgBouncer)を使えば、サーバーレスの接続枯渇を緩和できる。

## SQLite → Postgres 切替の影響

- 現スキーマは `Int / String / Float / DateTime` と `@@index` のみで **SQLite 固有機能を使っていない** → Postgres でそのまま動く(`autoincrement` も Postgres 互換)。
- 変更が必要なファイル(**Neon 接続文字列が手元に来てから Claude が実施**):
  1. `prisma/schema.prisma`: `provider = "sqlite"` → `"postgresql"`
  2. `lib/prisma.ts`: `PrismaBetterSqlite3` → `@prisma/adapter-pg` の `PrismaPg`
  3. `prisma/seed.ts`: 同上 adapter 差替え
  4. `package.json`: `"build": "prisma generate && next build"`(`lib/generated` は gitignore のため Vercel ビルドで必須生成)
  5. 依存追加: `@prisma/adapter-pg`, `pg`(`@prisma/adapter-better-sqlite3` は撤去可)
- **破壊的変更のため、ローカル確認が途切れないよう Neon 接続文字列が `.env` に入った直後に一括実施する。**

## ⚠️ NDA / セキュリティ

- Vercel デプロイは**デフォルト公開URL**。**実データ投入前に必ずパスワード保護を有効化**。
- 採用: **Vercel Pro + パスワード保護**(Deployment Protection)。顧客にパスワードを共有して閲覧してもらう。
- `data/` 配下の受領CSVは Git にも Vercel build にも含めない(`.gitignore` / `.vercelignore` 済)。
- **Neon 接続文字列は秘密情報**。`.env`(gitignore済)に書き、会話やコミットに残さない。

---

## 👤 人間作業チェックリスト(Vercel / Neon 側)

Claude が代行できない、アカウント操作・ブラウザ認証・課金が絡む作業。**フェーズ1が終われば Claude がローカル Postgres 化と動作確認まで進められる。**

### フェーズ1: Neon を用意(これが最優先・クリティカルパス)

- [ ] **1-1. Neon アカウント作成** — https://neon.tech にサインアップ(GitHub/Google でOK、無料プランで可)
- [ ] **1-2. プロジェクト作成** — 「Create project」。リージョンは `AWS Asia Pacific (Tokyo)` 推奨。DB名は任意(例 `car_dispatcher`)
- [ ] **1-3. Pooled 接続文字列を取得** — プロジェクトの「Connection Details」で **「Pooled connection」をオン**にした接続文字列をコピー
  - 形式: `postgresql://USER:PASSWORD@ep-xxxx-pooler.ap-...aws.neon.tech/DBNAME?sslmode=require`
  - `-pooler` が含まれていることを確認
- [ ] **1-4. `.env` に設定** — リポジトリ直下の `.env` の `DATABASE_URL=` に貼り付け(**会話には貼らないでOK**。Claude が `.env` を読んで使う)

> ✅ ここまで完了したら Claude に「Neon設定した」と伝えてください。Claude が schema/adapter を Postgres 化 → `db push` + `seed` → `localhost:3000` で動作確認します。

### フェーズ2: Vercel を用意(ローカル確認OK後)

- [ ] **2-1. Vercel アカウント作成 + Pro 契約** — https://vercel.com 。パスワード保護に **Pro($20/月)** が必要
- [ ] **2-2. Vercel CLI ログイン** — ターミナルで `npx vercel login`(ブラウザ認証)
  - ※ログイン後は Claude が `npx vercel` でデプロイ実行を代行可能
- [ ] **2-3. プロジェクト作成** — リポジトリ直下で `npx vercel link`(または初回 `npx vercel` の対話で作成)
- [ ] **2-4. 環境変数 DATABASE_URL を Vercel に登録** — `npx vercel env add DATABASE_URL`(Production/Preview に Neon の Pooled 文字列)
  - ※Claude がコマンドを案内/実行できるが、値の入力は人間が行うと安全

### フェーズ3: デプロイ & 保護(Claude と分担)

- [ ] **3-1. 本番デプロイ** — `npx vercel --prod`(Claude が代行可)
- [ ] **3-2. パスワード保護を有効化** — Vercel ダッシュボード → プロジェクト → Settings → **Deployment Protection** → Password Protection をオン、パスワード設定
- [ ] **3-3. 動作確認** — 本番URL + パスワードで全画面表示を確認
- [ ] **3-4. 顧客へ共有** — 本番URL とパスワードを顧客に連絡

---

## Claude が実施する作業(接続文字列が `.env` に入った後)

1. `npm install @prisma/adapter-pg pg`
2. `prisma/schema.prisma` の provider を `postgresql` に変更
3. `lib/prisma.ts` / `prisma/seed.ts` の adapter を `PrismaPg` に差替え
4. `package.json` の build を `prisma generate && next build` に
5. `npx prisma generate` → `npx prisma db push` → `npm run seed`
6. `localhost:3000` で全画面動作確認(ローカルから Neon 接続)
7. (フェーズ2以降)`npx vercel --prod` でデプロイ

## ローカル開発はどうなるか

- 開発: 引き続き `npm run dev`(DBは Neon に接続)
- デプロイ: `npx vercel`(プレビュー)/ `npx vercel --prod`(本番)
- Docker 構成(現在 SQLite 前提)は **Postgres 対応の更新が別途必要**(優先度低、TODO)

## 既存計画への影響

- Day2 以降の機能開発は止めずに継続。Vercel 移行は横断タスクとして並走。
- 「Windows/WSL 移行」の優先度は低下(動かす場所が Vercel になるため)。
- Docker は Postgres 対応の更新が必要(後回し可)。
- AWS は将来の本番。Neon 採用で Postgres 一貫。

## TODO

- [ ] (人間) フェーズ1: Neon 作成 → `.env` 設定 ← **最優先**
- [ ] (Claude) Postgres 化コード変更 + ローカル動作確認
- [ ] (人間) フェーズ2: Vercel Pro + CLI ログイン + 環境変数
- [ ] (Claude/人間) フェーズ3: デプロイ + パスワード保護
- [ ] (後回し) Docker 構成の Postgres 対応
