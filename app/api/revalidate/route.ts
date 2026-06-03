import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";

/**
 * キャッシュクリア用エンドポイント。
 * 再シード(データ作り直し)後に叩くと、各ページの unstable_cache(tag: "mockdata")を
 * 無効化して最新データを反映できる。
 *
 * 使い方: POST /api/revalidate?secret=<REVALIDATE_SECRET>
 * REVALIDATE_SECRET 未設定時は誰でも実行可(開発用)。本番は env に設定推奨。
 */
export async function POST(request: Request) {
  const secret = new URL(request.url).searchParams.get("secret");
  const expected = process.env.REVALIDATE_SECRET;
  if (expected && secret !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  revalidateTag("mockdata", "max");
  return NextResponse.json({ revalidated: true, tag: "mockdata" });
}
