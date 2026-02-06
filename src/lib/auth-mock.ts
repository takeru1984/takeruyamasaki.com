/**
 * Mock auth for MVP: parse role and PIN from headers.
 * Replace with NextAuth/Clerk etc. in production.
 *
 * Expected headers (for testing):
 *   x-mock-role: admin | viewer
 *   x-mock-pin: <APP_PIN_HASH or plain PIN for mock>
 * Or cookie/session in production.
 */
export type AuthUser = { id: string; role: "admin" | "viewer" };

export function getMockAuth(request: Request): AuthUser | null {
  const role = request.headers.get("x-mock-role");
  if (role === "admin" || role === "viewer") {
    return { id: `mock-${role}`, role };
  }
  return null;
}

/** Check PIN for charge_off: mock accepts header x-mock-pin matching env APP_PIN_HASH or literal "pin_ok". */
export function checkPinForOff(request: Request): boolean {
  const pin = request.headers.get("x-mock-pin");
  const expectedHash = process.env.APP_PIN_HASH;
  if (!expectedHash) return pin === "pin_ok";
  return pin === expectedHash || pin === "pin_ok";
}
