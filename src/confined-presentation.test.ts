import { describe, expect, it } from "vitest";

import { evaluateConfinedModelValidity } from "./confined-validity.js";
import { getConfinedPresentationState } from "./confined-presentation.js";

function validityFor(headsMeters: number[][], wellA: number, wellB: number) {
  return evaluateConfinedModelValidity({
    headsMeters,
    aquiferTopElevationMeters: 0,
    estimatedWellHeadsMeters: { wellA, wellB },
  });
}

describe("presentación de validez confinada", () => {
  it("atenúa sólo A y vuelve a la presentación normal al regresar a válido", () => {
    const onlyADegraded = getConfinedPresentationState(validityFor([[1]], -0.1, 1));

    expect(onlyADegraded).toEqual({
      level: "wellDegraded",
      meshOutputsDegraded: false,
      wellAOutputsDegraded: true,
      wellBOutputsDegraded: false,
    });

    const restored = getConfinedPresentationState(validityFor([[1]], 1, 1));
    expect(restored).toEqual({
      level: "valid",
      meshOutputsDegraded: false,
      wellAOutputsDegraded: false,
      wellBOutputsDegraded: false,
    });
  });

  it("atenúa toda salida científica cuando la malla es inválida", () => {
    const presentation = getConfinedPresentationState(validityFor([[-0.1]], 1, 1));

    expect(presentation).toEqual({
      level: "meshInvalid",
      meshOutputsDegraded: true,
      wellAOutputsDegraded: true,
      wellBOutputsDegraded: true,
    });
  });
});
