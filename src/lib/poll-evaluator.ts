/**
 * Pure safety evaluation for poll: should we trigger fail-safe (force charge ON)?
 * Extracted for unit testing without DB/API mocks.
 */
export type EvalInput = {
  pollFailureCount: number;
  soc: number;
  switchbotState: "ON" | "OFF" | "UNKNOWN";
  socCriticalMin: number;
  failureThreshold: number;
};

export type EvalResult = {
  triggerFailSafe: boolean;
  reason?: "poll_failure_threshold" | "low_soc_critical";
};

export function evaluateFailSafe(input: EvalInput): EvalResult {
  if (input.pollFailureCount >= input.failureThreshold) {
    return { triggerFailSafe: true, reason: "poll_failure_threshold" };
  }
  if (input.soc <= input.socCriticalMin && input.switchbotState !== "ON") {
    return { triggerFailSafe: true, reason: "low_soc_critical" };
  }
  return { triggerFailSafe: false };
}
