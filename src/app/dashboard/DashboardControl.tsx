"use client";

/**
 * 手動充電 ON/OFF 操作 UI。
 * モック環境: フォームから role/PIN を header にセット。
 * TODO: 本番では NextAuth/Clerk 等で session から取得。
 */
import { useState } from "react";
import { useRouter } from "next/navigation";

export type SocStatusProps = {
  lastSuccessSoc: number | null;
  isUnknown: boolean;
  socSafeMin: number;
};

export function DashboardControl({ lastSuccessSoc, isUnknown, socSafeMin }: SocStatusProps) {
  const router = useRouter();
  const [role, setRole] = useState<"admin" | "viewer">("admin");
  const [pin, setPin] = useState("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const needOverride = !isUnknown && lastSuccessSoc !== null && lastSuccessSoc < socSafeMin;
  const offDisabled =
    isUnknown || !pin || (needOverride && !reason.trim());

  async function handleAction(action: "charge_on" | "charge_off") {
    if (role !== "admin") {
      setMessage({ type: "err", text: "Admin ロールが必要です" });
      return;
    }
    if (action === "charge_off") {
      if (isUnknown) {
        setMessage({ type: "err", text: "SoC データが不明のため OFF できません" });
        return;
      }
      if (!pin) {
        setMessage({ type: "err", text: "charge_off には PIN が必要です" });
        return;
      }
      if (needOverride && !reason.trim()) {
        setMessage({ type: "err", text: "オーバーライドには理由の入力が必要です" });
        return;
      }
    }

    setLoading(true);
    setMessage(null);
    try {
      const body: { action: string; reason?: string; overrideLowSoc?: boolean } = {
        action,
      };
      if (action === "charge_off") {
        body.reason = reason.trim() || "Manual charge OFF";
        if (needOverride) body.overrideLowSoc = true;
      }
      const res = await fetch("/api/control", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-mock-role": role,
          "x-mock-pin": pin || "pin_ok",
        },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setMessage({ type: "ok", text: data.message ?? "成功しました" });
        setReason("");
        router.refresh();
      } else {
        setMessage({ type: "err", text: data.message ?? data.error ?? "エラーが発生しました" });
      }
    } catch {
      setMessage({ type: "err", text: "ネットワークエラー" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mb-8 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900">
      <h2 className="mb-4 text-lg font-semibold">手動操作</h2>

      {isUnknown && (
        <p className="mb-4 text-amber-700 dark:text-amber-300">
          SoC データが不明または古いため、OFF 操作は利用できません。
        </p>
      )}
      {needOverride && !isUnknown && (
        <p className="mb-4 text-amber-700 dark:text-amber-300">
          SoC が安全閾値 ({socSafeMin}%) 未満です。OFF するには PIN と理由の入力が必要です。
        </p>
      )}

      <div className="mb-4 flex flex-wrap gap-4">
        <label className="flex items-center gap-2">
          <span className="text-sm">ロール:</span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as "admin" | "viewer")}
            className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-600 dark:bg-zinc-800"
          >
            <option value="admin">admin</option>
            <option value="viewer">viewer</option>
          </select>
        </label>
        <label className="flex items-center gap-2">
          <span className="text-sm">PIN (OFF用):</span>
          <input
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="pin_ok"
            className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-600 dark:bg-zinc-800"
          />
        </label>
      </div>
      <div className="mb-4">
        <label className="mb-1 block text-sm">理由 (OFF/オーバーライド時必須):</label>
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="例: メンテナンスのため"
          className="w-full max-w-md rounded border border-zinc-300 px-2 py-1 dark:border-zinc-600 dark:bg-zinc-800"
        />
      </div>

      <div className="flex flex-wrap gap-4">
        <button
          onClick={() => handleAction("charge_on")}
          disabled={loading}
          className="rounded-lg bg-green-600 px-4 py-2 font-medium text-white hover:bg-green-700 disabled:opacity-50"
        >
          パニック ON（常時活性）
        </button>
        <button
          onClick={() => handleAction("charge_off")}
          disabled={loading || offDisabled}
          className="rounded-lg border border-red-500 bg-white px-4 py-2 font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:bg-zinc-900 dark:hover:bg-red-950/30"
        >
          充電 OFF
        </button>
      </div>

      {message && (
        <p
          className={`mt-4 text-sm ${message.type === "ok" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
        >
          {message.text}
        </p>
      )}
    </section>
  );
}
