import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const placeholderKpis = [
  { label: "本日の配車件数", value: "—", note: "Day3-B で接続" },
  { label: "稼働率", value: "—", note: "Day3-B で接続" },
  { label: "空車数", value: "—", note: "Day3-B で接続" },
  { label: "平均評価", value: "—", note: "Day3-B で接続" },
];

const buildProgress = [
  { phase: "Day1-A", title: "Next.js 初期化", status: "done" },
  { phase: "Day1-B", title: "ドキュメント + サイドバー", status: "done" },
  { phase: "Day1-C", title: "Prisma + ダミーデータ", status: "done" },
  { phase: "Day1-D", title: "案件・車両・ドライバー一覧", status: "done" },
  { phase: "Day1-E", title: "Docker 整備", status: "done" },
  { phase: "Day2-A", title: "地図ベース配車盤", status: "done" },
  { phase: "Day2-B", title: "マッチング推奨", status: "done" },
  { phase: "Day3-A", title: "ドライバー評価可視化", status: "todo" },
  { phase: "Day3-B", title: "KPI ダッシュボード", status: "todo" },
  { phase: "Day3-C", title: "見た目調整 + デモ", status: "todo" },
];

const statusVariant: Record<string, { label: string; className: string }> = {
  done: { label: "完了", className: "bg-emerald-100 text-emerald-700" },
  doing: { label: "進行中", className: "bg-amber-100 text-amber-700" },
  todo: { label: "未着手", className: "bg-slate-100 text-slate-500" },
};

export default function Home() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          ダッシュボード
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          配車システム モック (Day1-B 時点)。骨格を確認するための初期画面です。
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {placeholderKpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs">{kpi.label}</CardDescription>
              <CardTitle className="text-3xl font-semibold text-slate-900">
                {kpi.value}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-slate-400">
              {kpi.note}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">構築進捗</CardTitle>
          <CardDescription>
            3日間ロードマップの実装状況。完了したフェーズから順次機能が見られるようになります。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-2 md:grid-cols-2">
            {buildProgress.map((item) => {
              const v = statusVariant[item.status];
              return (
                <li
                  key={item.phase}
                  className="flex items-center justify-between rounded-md border bg-white px-3 py-2"
                >
                  <div className="flex flex-col">
                    <span className="text-xs text-slate-400">{item.phase}</span>
                    <span className="text-sm text-slate-800">{item.title}</span>
                  </div>
                  <Badge className={v.className} variant="outline">
                    {v.label}
                  </Badge>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
