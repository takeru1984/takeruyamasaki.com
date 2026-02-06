import Link from "next/link";
import { prisma } from "@/lib/db";
import { isDbConfigured } from "@/lib/env-status";

const PAGE_SIZE = 20;

export const dynamic = "force-dynamic";

type SearchParams = { page?: string };

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { page: pageStr } = await searchParams;
  const page = Math.max(1, parseInt(pageStr ?? "1", 10) || 1);
  const skip = (page - 1) * PAGE_SIZE;

  const dbConfigured = isDbConfigured();
  const [items, total] = dbConfigured
    ? await Promise.all([
        prisma.deviceState.findMany({
          take: PAGE_SIZE,
          skip,
          orderBy: { collectedAt: "desc" },
        }),
        prisma.deviceState.count(),
      ])
    : [[], 0];

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="min-h-screen bg-zinc-50 p-6 dark:bg-zinc-950">
      <header className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">履歴</h1>
        <nav className="flex gap-4">
          <Link href="/" className="text-zinc-600 hover:underline dark:text-zinc-400">
            ホーム
          </Link>
          <Link href="/dashboard" className="text-zinc-600 hover:underline dark:text-zinc-400">
            ダッシュボード
          </Link>
          <Link href="/logs" className="text-zinc-600 hover:underline dark:text-zinc-400">
            操作ログ
          </Link>
        </nav>
      </header>

      {!dbConfigured && (
        <div className="mb-4 rounded-lg border border-amber-500/50 bg-amber-50 p-4 dark:bg-amber-950/30">
          <p className="font-medium text-amber-800 dark:text-amber-200">
            DB not configured. Set POSTGRES_PRISMA_URL and POSTGRES_URL_NON_POOLING.
          </p>
        </div>
      )}

      <p className="mb-4 text-zinc-600 dark:text-zinc-400">
        全 {total} 件（DB データのみ表示・外部 API 呼び出しなし）
      </p>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-700">
              <th className="p-3">取得日時</th>
              <th className="p-3">ソース</th>
              <th className="p-3">SoC</th>
              <th className="p-3">入力W</th>
              <th className="p-3">出力W</th>
              <th className="p-3">SwitchBot</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-4 text-zinc-500">
                  データがありません
                </td>
              </tr>
            ) : (
              items.map((row) => (
                <tr key={row.id} className="border-b border-zinc-100 dark:border-zinc-800">
                  <td className="p-3">
                    {new Date(row.collectedAt).toLocaleString("ja-JP")}
                  </td>
                  <td className="p-3">{row.source}</td>
                  <td className="p-3">{row.soc ?? "—"}</td>
                  <td className="p-3">{row.wattsIn ?? "—"}</td>
                  <td className="p-3">{row.wattsOut ?? "—"}</td>
                  <td className="p-3">{row.switchbotState ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <p className="text-sm text-zinc-500">
          {skip + 1}–{Math.min(skip + PAGE_SIZE, total)} / {total}
        </p>
        <div className="flex gap-2">
          {page > 1 && (
            <Link
              href={`/history?page=${page - 1}`}
              className="rounded border border-zinc-300 px-4 py-2 hover:bg-zinc-100 dark:border-zinc-600 dark:hover:bg-zinc-800"
            >
              前へ
            </Link>
          )}
          {page < totalPages && (
            <Link
              href={`/history?page=${page + 1}`}
              className="rounded border border-zinc-300 px-4 py-2 hover:bg-zinc-100 dark:border-zinc-600 dark:hover:bg-zinc-800"
            >
              次へ
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
