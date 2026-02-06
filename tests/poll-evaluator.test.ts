import { describe, it, expect } from "vitest";
import { evaluateFailSafe } from "../src/lib/poll-evaluator";

describe("evaluateFailSafe", () => {
  const base = {
    socCriticalMin: 25,
    failureThreshold: 3,
  };

  it("triggers fail-safe when poll_failure_count >= threshold", () => {
    expect(
      evaluateFailSafe({
        ...base,
        pollFailureCount: 3,
        soc: 80,
        switchbotState: "ON",
      })
    ).toEqual({ triggerFailSafe: true, reason: "poll_failure_threshold" });
  });

  it("triggers fail-safe when SoC <= critical and plug is not ON", () => {
    expect(
      evaluateFailSafe({
        ...base,
        pollFailureCount: 0,
        soc: 25,
        switchbotState: "OFF",
      })
    ).toEqual({ triggerFailSafe: true, reason: "low_soc_critical" });
  });

  it("does not trigger when plug is already ON with low SoC", () => {
    expect(
      evaluateFailSafe({
        ...base,
        pollFailureCount: 0,
        soc: 20,
        switchbotState: "ON",
      })
    ).toEqual({ triggerFailSafe: false });
  });
});
