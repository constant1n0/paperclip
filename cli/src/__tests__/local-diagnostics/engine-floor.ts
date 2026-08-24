/**
 * Evidence-lane engine floor guard (FC-R5-14, slice R5-1).
 *
 * Only Node majors measured by execution may appear in the pinned table.
 * R5-1 stubs the floor check only — R5-8 completes each row's measured
 * fields (permissionFlag, stderrAllowSet, deniedCodes, fdTypeSet).
 * The evidence lane floor is Node >= 22 (P-R5-13); the shipped product
 * keeps `engines.node ">=20"` unchanged.
 */
export const PINNED_ENGINE_MAJORS = [22, 24] as const;
export type PinnedEngineMajor = (typeof PINNED_ENGINE_MAJORS)[number];

const isPinnedMajor = (major: number): major is PinnedEngineMajor =>
  (PINNED_ENGINE_MAJORS as readonly number[]).includes(major);

export type EngineFloorResult =
  | { readonly ok: true; readonly major: PinnedEngineMajor }
  | { readonly ok: false; readonly reason: `ENGINE_MAJOR_UNSUPPORTED:${number}` };

export function checkEngineFloor(runningMajor: number): EngineFloorResult {
  if (isPinnedMajor(runningMajor)) return { ok: true, major: runningMajor };
  return { ok: false, reason: `ENGINE_MAJOR_UNSUPPORTED:${runningMajor}` };
}
