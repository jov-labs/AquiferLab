import { describe, expect, it } from "vitest";

import { createDefaultModelInput, type GroundwaterModelInput } from "./groundwater.js";
import {
  MAX_SCENARIOS,
  addScenario,
  createScenario,
  getScenarioById,
  removeScenario,
  renameScenario,
  updateScenarioParameters,
} from "./scenarios.js";

function modelParameters(): GroundwaterModelInput {
  return {
    ...createDefaultModelInput(),
    wells: [{ row: 20, column: 20, rateCubicMetersPerDay: 25 }],
  };
}

describe("scenarios", () => {
  it("crea un escenario válido y conserva sus parámetros", () => {
    const parameters = modelParameters();
    const scenario = createScenario({ id: "base", name: "Base", parameters });

    expect(scenario).toMatchObject({ id: "base", name: "Base", parameters });
    expect(scenario.parameters).toEqual(parameters);
  });

  it("renombra sin mutar el escenario original", () => {
    const original = createScenario({ id: "base", name: "Base", parameters: modelParameters() });
    const renamed = renameScenario(original, "Alternativo");

    expect(renamed).toMatchObject({ id: "base", name: "Alternativo" });
    expect(original.name).toBe("Base");
    expect(renamed).not.toBe(original);
  });

  it("actualiza parámetros sin mutar el escenario original", () => {
    const original = createScenario({ id: "base", name: "Base", parameters: modelParameters() });
    const updatedParameters = { ...modelParameters(), thicknessMeters: 35 };
    const updated = updateScenarioParameters(original, updatedParameters);

    expect(updated.parameters.thicknessMeters).toBe(35);
    expect(original.parameters.thicknessMeters).toBe(20);
    expect(updated).not.toBe(original);
  });

  it("permite exactamente cuatro escenarios y rechaza el quinto", () => {
    let scenarios: readonly ReturnType<typeof createScenario>[] = [];
    for (let index = 1; index <= MAX_SCENARIOS; index += 1) {
      const result = addScenario(
        scenarios,
        createScenario({ id: `scenario-${index}`, name: `Escenario ${index}`, parameters: modelParameters() }),
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        scenarios = result.scenarios;
      }
    }

    const fifth = addScenario(
      scenarios,
      createScenario({ id: "scenario-5", name: "Escenario 5", parameters: modelParameters() }),
    );

    expect(scenarios).toHaveLength(MAX_SCENARIOS);
    expect(fifth).toEqual({ ok: false, reason: "MAX_SCENARIOS_REACHED", scenarios });
  });

  it("permite añadir otro después de eliminar un escenario", () => {
    const first = createScenario({ id: "one", name: "Uno", parameters: modelParameters() });
    const second = createScenario({ id: "two", name: "Dos", parameters: modelParameters() });
    const third = createScenario({ id: "three", name: "Tres", parameters: modelParameters() });
    const fourth = createScenario({ id: "four", name: "Cuatro", parameters: modelParameters() });
    const full = [first, second, third, fourth];
    const withoutSecond = removeScenario(full, "two");
    const replacement = createScenario({ id: "five", name: "Cinco", parameters: modelParameters() });

    const result = addScenario(withoutSecond, replacement);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.scenarios.map((scenario) => scenario.id)).toEqual(["one", "three", "four", "five"]);
    }
  });

  it("busca correctamente por id", () => {
    const first = createScenario({ id: "one", name: "Uno", parameters: modelParameters() });
    const second = createScenario({ id: "two", name: "Dos", parameters: modelParameters() });

    expect(getScenarioById([first, second], "two")).toBe(second);
    expect(getScenarioById([first, second], "missing")).toBeUndefined();
  });

  it("aísla el estado mutable de dos escenarios creados desde la misma configuración", () => {
    const parameters = modelParameters();
    const first = createScenario({ id: "one", name: "Uno", parameters });
    const second = createScenario({ id: "two", name: "Dos", parameters });
    const firstWell = first.parameters.wells[0];
    const firstFixedHead = first.parameters.fixedHeadCells[0];

    firstWell.rateCubicMetersPerDay = 75;
    firstFixedHead.headMeters = 120;

    expect(second.parameters.wells[0].rateCubicMetersPerDay).toBe(25);
    expect(second.parameters.fixedHeadCells[0].headMeters).toBe(100);
    expect(parameters.wells[0].rateCubicMetersPerDay).toBe(25);
    expect(parameters.fixedHeadCells[0].headMeters).toBe(100);
  });
});
