import { describe, expect, it } from "vitest";

import { createDefaultModelInput } from "./groundwater.js";
import { getScenarioVisualState } from "./scenario-visual.js";
import { createScenario, setScenarioHydraulicReference } from "./scenarios.js";

describe("visibilidad visual de la referencia del escenario", () => {
  it("muestra el río para una referencia river y por defecto", () => {
    const scenario = createScenario({
      id: "scenario-1",
      name: "Escenario 1",
      parameters: createDefaultModelInput(),
    });

    expect(getScenarioVisualState(scenario.boundary.referenceKind)).toEqual({ showRiver: true });
  });

  it("oculta el río para una referencia regional sin alterar el modelo", () => {
    const parameters = createDefaultModelInput();
    const scenario = createScenario({ id: "scenario-1", name: "Escenario 1", parameters });
    const regional = setScenarioHydraulicReference(scenario, "regional");

    expect(getScenarioVisualState(regional.boundary.referenceKind)).toEqual({ showRiver: false });
    expect(regional.parameters).toEqual(scenario.parameters);
    expect(regional.parameters.fixedHeadCells).toEqual(parameters.fixedHeadCells);
    expect(regional.parameters.wells).toEqual(parameters.wells);
  });
});
