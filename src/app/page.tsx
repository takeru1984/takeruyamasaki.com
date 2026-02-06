import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-zinc-50 p-8 dark:bg-zinc-950">
      <h1 className="text-2xl font-semibold">EcoFlow Dashboard</h1>
      <nav className="flex gap-4">
        <Link
          href="/dashboard"
          className="rounded-lg bg-zinc-800 px-4 py-2 text-white hover:bg-zinc-700 dark:bg-zinc-200 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          ダッシュボード
        </Link>
        <Link
          href="/history"
          className="rounded-lg border border-zinc-300 px-4 py-2 hover:bg-zinc-100 dark:border-zinc-600 dark:hover:bg-zinc-800"
        >
          履歴
        </Link>
        <Link
          href="/logs"
          className="rounded-lg border border-zinc-300 px-4 py-2 hover:bg-zinc-100 dark:border-zinc-600 dark:hover:bg-zinc-800"
        >
          操作ログ
        </Link>
      </nav>
    </div>
  );
}
