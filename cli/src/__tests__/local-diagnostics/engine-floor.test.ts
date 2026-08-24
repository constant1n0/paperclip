import { describe, expect, it } from "vitest";
import { checkEngineFloor, PINNED_ENGINE_MAJORS } from "./engine-floor.js";

describe("engine floor guard (FC-R5-14, slice R5-1)", () => {
  it("pins exactly the measured evidence-lane majors {22, 24}", () => {
    expect(PINNED_ENGINE_MAJORS).toEqual([22, 24]);
  });

  it.each(PINNED_ENGINE_MAJORS)("accepts the measured major %d", (major) => {
    expect(checkEngineFloor(major)).toEqual({ ok: true, major });
  });

  it.each([18, 19, 20, 21])("fails closed below the Node >= 22 floor for major %d (P-R5-13)", (major) => {
    expect(checkEngineFloor(major)).toEqual({ ok: false, reason: `ENGINE_MAJOR_UNSUPPORTED:${major}` });
  });

  it.each([23, 25])("fails closed for an unmeasured major %d, never guessing", (major) => {
    expect(checkEngineFloor(major)).toEqual({ ok: false, reason: `ENGINE_MAJOR_UNSUPPORTED:${major}` });
  });
});
