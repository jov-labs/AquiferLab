import { describe, expect, it } from "vitest";

import { evaluateConfinedModelValidity } from "./confined-validity.js";
import { getConfinedPresentationState } from "./confined-presentation.js";
import { translate } from "./i18n.js";

function validityFor(headsMeters: number[][], wellA: number, wellB: number) {
  return evaluateConfinedModelValidity({
    headsMeters,
    aquiferTopElevationMeters: 0,
    estimatedWellHeadsMeters: { wellA, wellB },
  });
}

describe("confined-validity presentation", () => {
  it("dims only A and returns to normal presentation when valid again", () => {
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

  it("dims all scientific output when the grid is invalid", () => {
    const presentation = getConfinedPresentationState(validityFor([[-0.1]], 1, 1));

    expect(presentation).toEqual({
      level: "meshInvalid",
      meshOutputsDegraded: true,
      wellAOutputsDegraded: true,
      wellBOutputsDegraded: true,
    });
  });

  it("states in ES and EN that an invalid grid must not be interpreted as valid", () => {
    expect(translate("es", "meshInvalidStatus")).toBe(
      "Escenario fuera del modelo confinado",
    );
    expect(translate("es", "meshInvalidPublicWarning")).toContain(
      "no deben interpretarse como válidos",
    );
    expect(translate("en", "meshInvalidStatus")).toBe(
      "Scenario outside the confined model",
    );
    expect(translate("en", "meshInvalidPublicWarning")).toContain(
      "must not be interpreted as valid",
    );
  });
});
