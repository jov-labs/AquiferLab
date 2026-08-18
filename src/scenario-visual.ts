import type { HydraulicReferenceKind } from "./scenarios.js";

export interface ScenarioVisualState {
  readonly showRiver: boolean;
}

/** Traduce la semántica de la referencia a una instrucción exclusivamente visual. */
export function getScenarioVisualState(
  referenceKind: HydraulicReferenceKind,
): ScenarioVisualState {
  return { showRiver: referenceKind === "river" };
}
