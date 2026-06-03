import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * ウォームアップ用エンドポイント。
 * デモ開始前に1回叩くと、Neon のコールドスタート(scale-to-zero からの起動)を
 * 解消し、最初のページ表示を速くできる。認証不要(count するだけで無害)。
 *
 * 使い方: GET /api/warm
 */
export async function GET() {
  const start = Date.now();
  const vehicles = await prisma.vehicle.count();
  return NextResponse.json({
    ok: true,
    vehicles,
    ms: Date.now() - start,
  });
}
