import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSocStatus } from "@/lib/soc-status";
import { config } from "@/lib/config";
import { isDbConfigured } from "@/lib/env-status";
import { DashboardControl } from "./DashboardControl";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const dbConfigured = isDbConfigured();

  const [systemStatus, latestEcoflow, latestSwitchbot, recentStates, recentLogs, socStatus] =
    dbConfigured
      ? await Promise.all([
          prisma.systemStatus.findUnique({ where: { id: 1 } }),
          prisma.deviceState.findFirst({
            where: { source: "ecoflow" },
            orderBy: { collectedAt: "desc" },
          }),
          prisma.deviceState.findFirst({
            where: { source: "switchbot" },
            orderBy: { collectedAt: "desc" },
          }),
          prisma.deviceState.findMany({
            take: 10,
            orderBy: { collectedAt: "desc" },
          }),
          prisma.operationLog.findMany({
            take: 10,
            orderBy: { occurredAt: "desc" },
          }),
          getSocStatus(),
        ])
      : [null, null, null, [], [], { lastSuccessSoc: null, lastPollAt: null, isStale: true, isUnknown: true }];

  const soc = latestEcoflow?.soc ?? systemStatus?.lastSuccessSoc ?? null;
  const switchbotState = latestSwitchbot?.switchbotState ?? "UNKNOWN";
  const lastPollAt = systemStatus?.lastPollAt ?? null;
  const pollFailureCount = systemStatus?.pollFailureCount ?? 0;

  return (
    <div className="min-h-screen bg-zinc-50 p-6 dark:bg-zinc-950">
      <header className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">ダッシュボード</h1>
        <nav className="flex gap-4">
          <Link href="/" className="text-zinc-600 hover:underline dark:text-zinc-400">
            ホーム
          </Link>
          <Link href="/history" className="text-zinc-600 hover:underline dark:text-zinc-400">
            履歴
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

      <DashboardControl
        lastSuccessSoc={socStatus.lastSuccessSoc}
        isUnknown={socStatus.isUnknown}
        socSafeMin={config.socSafeMin()}
      />

      {pollFailureCount >= 1 && (
        <div className="mb-4 rounded-lg border border-amber-500/50 bg-amber-50 p-4 dark:bg-amber-950/30">
          <p className="font-medium text-amber-800 dark:text-amber-200">
            ポール失敗が {pollFailureCount} 回記録されています。充電器の状態を確認してください。
          </p>
        </div>
      )}

      <section className="mb-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <h2 className="mb-2 text-sm font-medium text-zinc-500 dark:text-zinc-400">
            現在の SoC
          </h2>
          <p className="text-4xl font-bold text-zinc-900 dark:text-zinc-100">
            {soc !== null ? `${soc}%` : "—"}
          </p>
          {lastPollAt && (
            <p className="mt-2 text-xs text-zinc-500">
              最終取得: {new Date(lastPollAt).toLocaleString("ja-JP")}
            </p>
          )}
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <h2 className="mb-2 text-sm font-medium text-zinc-500 dark:text-zinc-400">
            SwitchBot 充電器
          </h2>
          <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            {switchbotState}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <h2 className="mb-2 text-sm font-medium text-zinc-500 dark:text-zinc-400">
            入力 / 出力
          </h2>
          <p className="text-lg text-zinc-700 dark:text-zinc-300">
            {latestEcoflow?.wattsIn != null ? `${latestEcoflow.wattsIn} W` : "—"} in /{" "}
            {latestEcoflow?.wattsOut != null ? `${latestEcoflow.wattsOut} W` : "—"} out
          </p>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-4 text-lg font-semibold">直近の履歴（最大10件）</h2>
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-700">
                <th className="p-3">取得日時</th>
                <th className="p-3">ソース</th>
                <th className="p-3">SoC</th>
                <th className="p-3">SwitchBot</th>
              </tr>
            </thead>
            <tbody>
              {recentStates.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-4 text-zinc-500">
                    データがありません
                  </td>
                </tr>
              ) : (
                recentStates.map((row) => (
                  <tr key={row.id} className="border-b border-zinc-100 dark:border-zinc-800">
                    <td className="p-3">
                      {new Date(row.collectedAt).toLocaleString("ja-JP")}
                    </td>
                    <td className="p-3">{row.source}</td>
                    <td className="p-3">{row.soc ?? "—"}</td>
                    <td className="p-3">{row.switchbotState ?? "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-2">
          <Link href="/history" className="text-blue-600 hover:underline dark:text-blue-400">
            履歴をすべて見る →
          </Link>
        </p>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold">操作ログ（抜粋）</h2>
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-700">
                <th className="p-3">日時</th>
                <th className="p-3">実行者</th>
                <th className="p-3">アクション</th>
                <th className="p-3">自動</th>
                <th className="p-3">理由</th>
              </tr>
            </thead>
            <tbody>
              {recentLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-4 text-zinc-500">
                    ログがありません
                  </td>
                </tr>
              ) : (
                recentLogs.map((log) => (
                  <tr key={log.id} className="border-b border-zinc-100 dark:border-zinc-800">
                    <td className="p-3">
                      {new Date(log.occurredAt).toLocaleString("ja-JP")}
                    </td>
                    <td className="p-3">{log.actorId}</td>
                    <td className="p-3">{log.action}</td>
                    <td className="p-3">{log.isAuto ? "はい" : "いいえ"}</td>
                    <td className="p-3 max-w-xs truncate">{log.reason ?? "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-2">
          <Link href="/logs" className="text-blue-600 hover:underline dark:text-blue-400">
            ログをすべて見る →
          </Link>
        </p>
      </section>
    </div>
  );
}
