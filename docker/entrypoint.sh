#!/bin/sh
# 配車システム モック - コンテナ起動時の初期化
#
# 1. node_modules が空(初回マウント)なら npm ci
# 2. Prisma client を生成 (bind mount された lib/generated 配下に書き込み)
# 3. DB が無ければ db push + seed
# 4. 渡されたコマンド(通常 `npm run dev`) を実行

set -e

cd /app

if [ ! -d "node_modules" ] || [ -z "$(ls -A node_modules 2>/dev/null)" ]; then
  echo "📦 node_modules が空なので npm ci 実行..."
  npm ci
fi

echo "🔧 Prisma client 生成..."
npx prisma generate

if [ ! -f "dev.db" ]; then
  echo "🗄  DB が無いので初期化 (db push + seed)..."
  npx prisma db push
  npm run seed
else
  echo "🗄  既存 DB を使用 (dev.db)"
fi

echo "🚀 起動: $@"
exec "$@"
