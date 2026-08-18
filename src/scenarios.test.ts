import { describe, expect, it } from "vitest";

import { createDefaultModelInput, type GroundwaterModelInput } from "./groundwater.js";
import {
  MAX_SCENARIOS,
  addScenario,
  createScenario,
  getScenarioById,
  removeScenario,
  renameScenario,
  setScenarioHydraulicReference,
  setScenarioRegionalReferenceSide,
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
    expect(scenario.boundary).toEqual({ referenceKind: "river", regionalReferenceSide: "west" });
  });

  it("permite crear un escenario con referencia regional", () => {
    const scenario = createScenario({
      id: "regional",
      name: "Regional",
      parameters: modelParameters(),
      boundary: { referenceKind: "regional" },
    });

    expect(scenario.boundary).toEqual({ referenceKind: "regional", regionalReferenceSide: "west" });
  });

  it("cambia de río a regional sin mutar el original", () => {
    const original = createScenario({ id: "base", name: "Base", parameters: modelParameters() });
    const regional = setScenarioHydraulicReference(original, "regional");

    expect(original.boundary).toEqual({ referenceKind: "river", regionalReferenceSide: "west" });
    expect(regional.boundary).toEqual({ referenceKind: "regional", regionalReferenceSide: "west" });
    expect(regional).not.toBe(original);
  });

  it("cambia de regional a río", () => {
    const regional = createScenario({
      id: "regional",
      name: "Regional",
      parameters: modelParameters(),
      boundary: { referenceKind: "regional" },
    });

    expect(setScenarioHydraulicReference(regional, "river").boundary).toEqual({
      referenceKind: "river",
      regionalReferenceSide: "west",
    });
  });

  it("cambiar la referencia conserva id, nombre y todos los parámetros", () => {
    const original = createScenario({ id: "base", name: "Base", parameters: modelParameters() });
    const regional = setScenarioHydraulicReference(original, "regional");

    expect(regional.id).toBe(original.id);
    expect(regional.name).toBe(original.name);
    expect(regional.parameters).toEqual(original.parameters);
    expect(regional.parameters.fixedHeadCells).toEqual(original.parameters.fixedHeadCells);
    expect(regional.parameters.wells).toEqual(original.parameters.wells);
  });

  it("usa Oeste por defecto y conserva exactamente las cargas fijas históricas", () => {
    const parameters = modelParameters();
    const regional = createScenario({
      id: "regional",
      name: "Regional",
      parameters,
      boundary: { referenceKind: "regional" },
    });

    expect(regional.boundary.regionalReferenceSide).toBe("west");
    expect(regional.parameters.fixedHeadCells).toEqual(parameters.fixedHeadCells);
  });

  it("cambia solo la frontera regional y conserva pozos y demás parámetros", () => {
    const regional = createScenario({
      id: "regional",
      name: "Regional",
      parameters: modelParameters(),
      boundary: { referenceKind: "regional" },
    });
    const east = setScenarioRegionalReferenceSide(regional, "east");

    expect(east.boundary).toEqual({ referenceKind: "regional", regionalReferenceSide: "east" });
    expect(east.parameters.fixedHeadCells).toHaveLength(east.parameters.rows);
    expect(east.parameters.fixedHeadCells.every((cell) => cell.column === east.parameters.columns - 1)).toBe(true);
    expect(east.parameters.fixedHeadCells.every((cell) => cell.headMeters === 100)).toBe(true);
    expect(east.parameters.wells).toEqual(regional.parameters.wells);
    expect(east.parameters.hydraulicConductivityMetersPerDay).toBe(
      regional.parameters.hydraulicConductivityMetersPerDay,
    );
    expect(east.parameters.rechargeMetersPerDay).toBe(regional.parameters.rechargeMetersPerDay);
  });

  it("no cambia celdas fijas al configurar un lado que no está activo en un escenario río", () => {
    const river = createScenario({ id: "river", name: "Río", parameters: modelParameters() });
    const configured = setScenarioRegionalReferenceSide(river, "south");

    expect(configured.boundary).toEqual({ referenceKind: "river", regionalReferenceSide: "south" });
    expect(configured.parameters.fixedHeadCells).toEqual(river.parameters.fixedHeadCells);
  });

  it("renombra sin mutar el escenario original", () => {
    const original = createScenario({ id: "base", name: "Base", parameters: modelParameters() });
    const renamed = renameScenario(original, "Alternativo");

    expect(renamed).toMatchObject({ id: "base", name: "Alternativo" });
    expect(original.name).toBe("Base");
    expect(renamed.boundary).toEqual(original.boundary);
    expect(renamed).not.toBe(original);
  });

  it("actualiza parámetros sin mutar el escenario original", () => {
    const original = createScenario({ id: "base", name: "Base", parameters: modelParameters() });
    const updatedParameters = { ...modelParameters(), thicknessMeters: 35 };
    const updated = updateScenarioParameters(original, updatedParameters);

    expect(updated.parameters.thicknessMeters).toBe(35);
    expect(original.parameters.thicknessMeters).toBe(20);
    expect(updated.boundary).toEqual(original.boundary);
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

  it("conserva boundary al añadir un escenario", () => {
    const regional = createScenario({
      id: "regional",
      name: "Regional",
      parameters: modelParameters(),
      boundary: { referenceKind: "regional" },
    });
    const result = addScenario([], regional);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.scenarios[0].boundary).toEqual({
        referenceKind: "regional",
        regionalReferenceSide: "west",
      });
      expect(result.scenarios[0].boundary).not.toBe(regional.boundary);
    }
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

  it("no comparte accidentalmente metadatos entre escenarios", () => {
    const parameters = modelParameters();
    const first = createScenario({ id: "one", name: "Uno", parameters });
    const second = createScenario({ id: "two", name: "Dos", parameters });

    expect(first.boundary).not.toBe(second.boundary);
    const regional = setScenarioHydraulicReference(first, "regional");

    expect(second.boundary.referenceKind).toBe("river");
    expect(regional.boundary).not.toBe(first.boundary);
  });
});
