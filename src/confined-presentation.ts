import type { ConfinedValidityResult } from "./confined-validity.js";

/** Estado de presentación derivado exclusivamente de la clasificación científica. */
export interface ConfinedPresentationState {
  level: ConfinedValidityResult["level"];
  meshOutputsDegraded: boolean;
  wellAOutputsDegraded: boolean;
  wellBOutputsDegraded: boolean;
}

/**
 * Determina qué grupos visuales se atenúan sin volver a evaluar física.
 * meshInvalid domina deliberadamente las marcas individuales de pozo.
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
