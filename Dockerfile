# 配車システム モック - 開発用 Dockerfile
# macOS / Windows-WSL の両環境で `docker compose up` から動作させるための構成
#
# - node:22-slim (Debian系) を使い、better-sqlite3 のネイティブビルドを簡単に
# - 開発モード (npm run dev) で起動。HMR は polling (WSL対応) で有効化
# - Prisma client と DB初期化は entrypoint で実行 (バインドマウント後の状態に対応)

FROM node:22-slim

# better-sqlite3 のビルド依存
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    openssl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 依存だけ先に入れてキャッシュを効かせる
COPY package.json package-lock.json ./
RUN npm ci

# 残りのソースをコピー (compose では bind mount で上書きされる想定)
COPY . .

# Prisma client を一度生成 (entrypoint で再生成するが、image自体も動かせるよう)
RUN npx prisma generate || true

# エントリポイント
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["npm", "run", "dev"]
