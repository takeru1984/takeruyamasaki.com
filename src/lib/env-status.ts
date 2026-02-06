/**
 * Env status: DB 設定の有無を判定。
 * POSTGRES_PRISMA_URL と POSTGRES_URL_NON_POOLING が空でなく、
 * REPLACE_ME を含まない場合に configured とみなす。
 */

function isConfigured(val: string | undefined): boolean {
  if (!val || val.trim() === "") return false;
  if (val.includes("REPLACE_ME")) return false;
  return true;
}

export function isDbConfigured(): boolean {
  return (
    isConfigured(process.env.POSTGRES_PRISMA_URL) &&
    isConfigured(process.env.POSTGRES_URL_NON_POOLING)
  );
}

export function requireDbConfigured(): void {
  if (!isDbConfigured()) {
    throw new Error("Database not configured. Set POSTGRES_PRISMA_URL and POSTGRES_URL_NON_POOLING.");
  }
}
