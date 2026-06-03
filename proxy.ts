import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Basic 認証 (簡易アクセス保護)
 *
 * Next.js 16 では middleware は「proxy」にリネームされた。
 * 顧客にモックを限定公開するための簡易保護。
 * ID/パスワードは環境変数で管理:
 *   - BASIC_AUTH_USER
 *   - BASIC_AUTH_PASSWORD
 * どちらか未設定なら保護をスキップ(ローカルで認証なしに動かしたい場合など)。
 *
 * ※ Vercel の Password Protection が有償($150/月)化したため、
 *    アプリ側で同等の保護を実装している。詳細: docs/06-deployment-vercel.md
 */
export function proxy(request: NextRequest) {
  const user = process.env.BASIC_AUTH_USER;
  const pass = process.env.BASIC_AUTH_PASSWORD;

  // 認証情報が未設定なら保護しない
  if (!user || !pass) {
    return NextResponse.next();
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Basic ")) {
    const encoded = authHeader.slice("Basic ".length).trim();
    let decoded = "";
    try {
      decoded = atob(encoded);
    } catch {
      decoded = "";
    }
    const sep = decoded.indexOf(":");
    if (sep >= 0) {
      const u = decoded.slice(0, sep);
      const p = decoded.slice(sep + 1);
      if (u === user && p === pass) {
        return NextResponse.next();
      }
    }
  }

  return new NextResponse("認証が必要です。", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="car_dispatcher (mock)", charset="UTF-8"',
    },
  });
}

export const config = {
  // 静的アセットと favicon、warm/revalidate API を除く全リクエストに適用
  // (/api/warm はウォームアップ用に認証なしで叩けるようにする)
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/warm|api/revalidate).*)"],
};
