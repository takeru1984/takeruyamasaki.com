import Link from "next/link";
import { prisma } from "@/lib/db";

const PAGE_SIZE = 20;

export const dynamic = "force-dynamic";

type SearchParams = { page?: string };

export default async function LogsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { page: pageStr } = await searchParams;
  const page = Math.max(1, parseInt(pageStr ?? "1", 10) || 1);
  const skip = (page - 1) * PAGE_SIZE;

  const [items, total] = await Promise.all([
    prisma.operationLog.findMany({
      take: PAGE_SIZE,
      skip,
      orderBy: { occurredAt: "desc" },
    }),
    prisma.operationLog.count(),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="min-h-screen bg-zinc-50 p-6 dark:bg-zinc-950">
      <header className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">操作ログ</h1>
        <nav className="flex gap-4">
          <Link href="/" className="text-zinc-600 hover:underline dark:text-zinc-400">
            ホーム
          </Link>
          <Link href="/dashboard" className="text-zinc-600 hover:underline dark:text-zinc-400">
            ダッシュボード
          </Link>
          <Link href="/history" className="text-zinc-600 hover:underline dark:text-zinc-400">
            履歴
          </Link>
        </nav>
      </header>

      <p className="mb-4 text-zinc-600 dark:text-zinc-400">
        全 {total} 件（DB データのみ・外部 API 呼び出しなし）
      </p>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-700">
              <th className="p-3">日時</th>
              <th className="p-3">実行者</th>
              <th className="p-3">アクション</th>
              <th className="p-3">対象</th>
              <th className="p-3">自動</th>
              <th className="p-3">理由</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-4 text-zinc-500">
                  ログがありません
                </td>
              </tr>
            ) : (
              items.map((log) => (
                <tr key={log.id} className="border-b border-zinc-100 dark:border-zinc-800">
                  <td className="p-3">
                    {new Date(log.occurredAt).toLocaleString("ja-JP")}
                  </td>
                  <td className="p-3">{log.actorId}</td>
                  <td className="p-3">{log.action}</td>
                  <td className="p-3">{log.target}</td>
                  <td className="p-3">{log.isAuto ? "はい" : "いいえ"}</td>
                  <td className="max-w-md truncate p-3" title={log.reason ?? undefined}>
                    {log.reason ?? "—"}
                  </td>
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
              href={`/logs?page=${page - 1}`}
              className="rounded border border-zinc-300 px-4 py-2 hover:bg-zinc-100 dark:border-zinc-600 dark:hover:bg-zinc-800"
            >
              前へ
            </Link>
          )}
          {page < totalPages && (
            <Link
              href={`/logs?page=${page + 1}`}
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
