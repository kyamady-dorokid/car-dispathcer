# 99. 意思決定ログ (ADR的)

| Date | 決定 | 経緯/理由 |
|---|---|---|
| 2026-05-28 | プロジェクト方針: 3日でローカル動作するモック開発 | 1週間案 → 速度重視で3日に圧縮 (顧客との議論加速が一義) |
| 2026-05-28 | 段階的ブラウザ確認方式 | スケルトン構築後は各タスク完了時に `localhost:3000` で実装状況を確認できる状態を作る |
| 2026-05-28 | Docker対応 (`docker compose up`) | macOS開発 → 近日 Windows/WSL 移行のため、環境差吸収 |
| 2026-05-28 | リポジトリ内コンテキスト保持 (`docs/`, `CLAUDE.md`) | Claude実行環境が変わる可能性あり、`~/.claude/.../memory/` だけでは引き継げない |
| 2026-05-28 | 顧客要求の詳細詰めはスケルトン完成後 | まず動く骨格を作り、それを見ながら要件詳細化する流れ |
| 2026-05-28 | npm を採用 (pnpmではなく) | pnpmはWindows/WSLで微妙な挙動差があるためnpmで統一。Docker内では差ゼロ |
| 2026-05-28 | Next.js 16 (latest) を採用 | create-next-app@latest で導入。学習データから差異あるため docs/01-app 参照しながら実装 |
| 2026-05-28 | shadcn/ui を初期化、`render` プロップ仕様で使用 | shadcn v4 は Base UI ベース、`asChild` ではなく `render` |
| 2026-05-28 | Prisma v7 + better-sqlite3 adapter 採用 | Prisma v7 は driver adapter 必須。SQLite には `@prisma/adapter-better-sqlite3` を使用 (Pure JS, ネイティブビルド) |
| 2026-05-28 | シードで「ドライバー×顧客の偏り」を意図的に作成 | マッチング段階で「得意領域」「過去実績スコア」が顧客に説明可能になるよう、ランダムでなく構造化された偏りを仕込んだ |
| 2026-05-28 | DispatchRecord で過去ログと現在割当を統一表現 | 別テーブルにする案もあったが、status (`in_progress`/`completed`/`cancelled`) で区別する方がシンプル |
| 2026-05-28 | Docker は node:22-slim + better-sqlite3 のビルド依存(python3/make/g++) 同梱 | better-sqlite3 はネイティブビルドが必要。alpine より slim (debian) の方が問題少ない |
| 2026-05-28 | entrypoint で `prisma generate` + 初回 `db push + seed` を自動化 | bind mount で lib/generated が空になる場合があるため、起動時に再生成。DBが無ければシードも自動 |
| 2026-05-28 | bind mount + 名前付きボリューム(node_modules, .next)の併用構成 | ソースは HMR で同期したいが、node_modules は host OS と非互換になるため隔離 |
| 2026-05-28 | 開発の主軸はローカル `npm run dev`、Docker は環境移行用 | Docker内のHMRは polling で遅め、ネイティブ実行の方が速い。Day1-E で Docker が動くことは検証済(localhost:3000で全画面HTTP 200確認) |
| 2026-06-01 | 配車単位を「1案件=複数集荷→1配送(ミルクラン)、1日1車両=1案件」と確定 | Day1完成後のヒアリングで明確化。当初検討の VRP(車両間で拠点配分)は過剰で、割当は1:1のまま。案件内の複数集荷拠点の巡回順(ミニTSP)が新要素。詳細は 02-requirements.md / 04-data-model.md |
| 2026-06-01 | 複数拠点モデルは docs 反映のみ、実装は後回し | 速度優先。Day2-A の地図は現行の単一発着モデルで進行。スキーマ/シードの複数拠点化は別タイミング |
| 2026-06-01 | 顧客閲覧環境を Vercel に置く方針を決定 | 当初要望「先方にも見える環境」を Vercel で実現。AWS は将来の本番。詳細は 06-deployment-vercel.md |
| 2026-06-01 | Vercel デプロイ連携は Vercel CLI 直 push | GitHub 連携を介さず `vercel` コマンドで直接デプロイ |
| 2026-06-01 | アクセス保護は Vercel Pro + パスワード保護 | NDA 考慮。実データ投入時も安全に顧客限定公開できる |
| 2026-06-01 | Vercel 用 DB は未決定(本命 Neon Postgres) | SQLite はサーバーレスで書込不可。A=Turso/B=Neon/C=Supabase の3案を保留。実装未着手 |
| 2026-06-01 | DB を Neon (Postgres) に確定し、SQLite→Postgres 切替を完了 | adapter は `@prisma/adapter-pg`(ローカルもVercelも同一)。provider=postgresql、Neon へ db push + seed、ローカルから Neon 接続で全画面動作確認済 |
| 2026-06-01 | Claude の Bash サンドボックスが Postgres 5432 をブロック | Neon 接続を伴う db push/seed/dev は `dangerouslyDisableSandbox` で実行。MCP(HTTPS)は影響なし。人間の通常ターミナルでは制約なし |
| 2026-06-01 | Vercel + Neon に本番デプロイ完了 | `npx vercel --prod`。本番URL https://cardispatcher.vercel.app で Neon(pooler)接続を確認。ビルドエラー回避で tsconfig exclude に prisma/seed.ts 追加 |
| 2026-06-01 | Vercel Password Protection が$150/月化 → アプリ側 Basic 認証を自前実装 | `proxy.ts`(Next.js16はmiddleware→proxy)で Basic認証。ID/PWは env `BASIC_AUTH_USER/PASSWORD`。仮 testuser/testpass(後で変更)。本番で 401/200 確認済。AWS移行後も同コードで動く |
| 2026-06-01 | Day2-A 地図配車盤を実装。地図中心は**大阪・関西圏** | MapLibre GL JS + 国土地理院淡色タイル(`/dispatch`)。車両タイプ別色マーカー + 未割当案件の赤ピン + サイドパネル(凡例・未割当一覧)。シードを関西圏に作り直し(緯度経度・関西ナンバー)、drivers の拠点フィルタも関西に。本番で表示確認済 |
| 2026-06-01 | Neon 読込遅延の対策: unstable_cache + sin1リージョン + warm | ①全ページのDB取得を `unstable_cache`(revalidate 1h, tag `mockdata`)。cacheComponents 全面導入はデモ前にリスクなので従来モデルを選択。②`vercel.json` `regions: ["sin1"]`(Neonと同地域シンガポール)。③`/api/warm`(Neon起こす・認証不要)+ `/api/revalidate`(再シード時 tag クリア、proxy除外)。本番計測: /dispatch **1.6s→0.6s**、/drivers **0.9s→0.55s**。`revalidateTag` は Next.js16 で第2引数(`"max"`)必須 |
| 2026-06-01 | Day2-B マッチング推奨を実装(`/matching`) | 硬制約(車両タイプ・免許)で候補ドライバーを絞り→サーバーで生スコア要素を算出(**得意顧客度**=その顧客への過去配車回数, 経験量=総配車+経験年数, 平均評価, 距離=Haversine)→**client で重みスライダー適用しランキングを即時再計算**。標準/関係重視/効率重視プリセット付き。スコア内訳を可視化(説明性)。距離計算は `lib/geo/distance.ts` に分離(将来 Google/ZENRIN トラックルート差替え用)。マッチング本体は `lib/matching/recommend.ts` |

## テンプレート

```
| YYYY-MM-DD | 決定内容 | 経緯/理由 |
```
