import type { HydraulicReferenceKind } from "./scenarios.js";

export interface ScenarioVisualState {
  readonly showRiver: boolean;
}

/** Translates reference semantics into an exclusively visual instruction. */
export function getScenarioVisualState(
  referenceKind: HydraulicReferenceKind,
): ScenarioVisualState {
  return { showRiver: referenceKind === "river" };
}
