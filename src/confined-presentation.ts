import type { ConfinedValidityResult } from "./confined-validity.js";

/** Presentation state derived exclusively from the scientific classification. */
export interface ConfinedPresentationState {
  level: ConfinedValidityResult["level"];
  meshOutputsDegraded: boolean;
  wellAOutputsDegraded: boolean;
  wellBOutputsDegraded: boolean;
}

/**
 * Determines which visual groups are dimmed without re-evaluating physics.
 * meshInvalid deliberately takes precedence over individual well flags.
 */
export function getConfinedPresentationState(
  validity: Readonly<ConfinedValidityResult>,
): ConfinedPresentationState {
  const meshOutputsDegraded = validity.level === "meshInvalid";
  return {
    level: validity.level,
    meshOutputsDegraded,
    wellAOutputsDegraded:
      meshOutputsDegraded || validity.wellA.status === "OUTSIDE_CONFINED_RANGE",
    wellBOutputsDegraded:
      meshOutputsDegraded || validity.wellB.status === "OUTSIDE_CONFINED_RANGE",
  };
}
