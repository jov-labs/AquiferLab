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
  it("creates a valid scenario and preserves its parameters", () => {
    const parameters = modelParameters();
    const scenario = createScenario({ id: "base", name: "Base", parameters });

    expect(scenario).toMatchObject({ id: "base", name: "Base", parameters });
    expect(scenario.parameters).toEqual(parameters);
    expect(scenario.boundary).toEqual({ referenceKind: "river", regionalReferenceSide: "west" });
  });

  it("allows creating a scenario with a regional reference", () => {
    const scenario = createScenario({
      id: "regional",
      name: "Regional",
      parameters: modelParameters(),
      boundary: { referenceKind: "regional" },
    });

    expect(scenario.boundary).toEqual({ referenceKind: "regional", regionalReferenceSide: "west" });
  });

  it("switches from river to regional without mutating the original", () => {
    const original = createScenario({ id: "base", name: "Base", parameters: modelParameters() });
    const regional = setScenarioHydraulicReference(original, "regional");

    expect(original.boundary).toEqual({ referenceKind: "river", regionalReferenceSide: "west" });
    expect(regional.boundary).toEqual({ referenceKind: "regional", regionalReferenceSide: "west" });
    expect(regional).not.toBe(original);
  });

  it("switches from regional to river", () => {
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

  it("changing the reference preserves id, name, and all parameters", () => {
    const original = createScenario({ id: "base", name: "Base", parameters: modelParameters() });
    const regional = setScenarioHydraulicReference(original, "regional");

    expect(regional.id).toBe(original.id);
    expect(regional.name).toBe(original.name);
    expect(regional.parameters).toEqual(original.parameters);
    expect(regional.parameters.fixedHeadCells).toEqual(original.parameters.fixedHeadCells);
    expect(regional.parameters.wells).toEqual(original.parameters.wells);
  });

  it("uses West by default and preserves the historical fixed heads exactly", () => {
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

  it("changes only the regional boundary and preserves wells and other parameters", () => {
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

  it("does not change fixed cells when setting an inactive side in a river scenario", () => {
    const river = createScenario({ id: "river", name: "River", parameters: modelParameters() });
    const configured = setScenarioRegionalReferenceSide(river, "south");

    expect(configured.boundary).toEqual({ referenceKind: "river", regionalReferenceSide: "south" });
    expect(configured.parameters.fixedHeadCells).toEqual(river.parameters.fixedHeadCells);
  });

  it("renames without mutating the original scenario", () => {
    const original = createScenario({ id: "base", name: "Base", parameters: modelParameters() });
    const renamed = renameScenario(original, "Alternative");

    expect(renamed).toMatchObject({ id: "base", name: "Alternative" });
    expect(original.name).toBe("Base");
    expect(renamed.boundary).toEqual(original.boundary);
    expect(renamed).not.toBe(original);
  });

  it("updates parameters without mutating the original scenario", () => {
    const original = createScenario({ id: "base", name: "Base", parameters: modelParameters() });
    const updatedParameters = { ...modelParameters(), thicknessMeters: 35 };
    const updated = updateScenarioParameters(original, updatedParameters);

    expect(updated.parameters.thicknessMeters).toBe(35);
    expect(original.parameters.thicknessMeters).toBe(20);
    expect(updated.boundary).toEqual(original.boundary);
    expect(updated).not.toBe(original);
  });

  it("allows exactly four scenarios and rejects the fifth", () => {
    let scenarios: readonly ReturnType<typeof createScenario>[] = [];
    for (let index = 1; index <= MAX_SCENARIOS; index += 1) {
      const result = addScenario(
        scenarios,
        createScenario({ id: `scenario-${index}`, name: `Scenario ${index}`, parameters: modelParameters() }),
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        scenarios = result.scenarios;
      }
    }

    const fifth = addScenario(
      scenarios,
      createScenario({ id: "scenario-5", name: "Scenario 5", parameters: modelParameters() }),
    );

    expect(scenarios).toHaveLength(MAX_SCENARIOS);
    expect(fifth).toEqual({ ok: false, reason: "MAX_SCENARIOS_REACHED", scenarios });
  });

  it("preserves boundary when adding a scenario", () => {
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

  it("allows adding another scenario after removing one", () => {
    const first = createScenario({ id: "one", name: "One", parameters: modelParameters() });
    const second = createScenario({ id: "two", name: "Two", parameters: modelParameters() });
    const third = createScenario({ id: "three", name: "Three", parameters: modelParameters() });
    const fourth = createScenario({ id: "four", name: "Four", parameters: modelParameters() });
    const full = [first, second, third, fourth];
    const withoutSecond = removeScenario(full, "two");
    const replacement = createScenario({ id: "five", name: "Five", parameters: modelParameters() });

    const result = addScenario(withoutSecond, replacement);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.scenarios.map((scenario) => scenario.id)).toEqual(["one", "three", "four", "five"]);
    }
  });

  it("finds a scenario correctly by id", () => {
    const first = createScenario({ id: "one", name: "One", parameters: modelParameters() });
    const second = createScenario({ id: "two", name: "Two", parameters: modelParameters() });

    expect(getScenarioById([first, second], "two")).toBe(second);
    expect(getScenarioById([first, second], "missing")).toBeUndefined();
  });

  it("isolates mutable state between two scenarios created from the same configuration", () => {
    const parameters = modelParameters();
    const first = createScenario({ id: "one", name: "One", parameters });
    const second = createScenario({ id: "two", name: "Two", parameters });
    const firstWell = first.parameters.wells[0];
    const firstFixedHead = first.parameters.fixedHeadCells[0];

    firstWell.rateCubicMetersPerDay = 75;
    firstFixedHead.headMeters = 120;

    expect(second.parameters.wells[0].rateCubicMetersPerDay).toBe(25);
    expect(second.parameters.fixedHeadCells[0].headMeters).toBe(100);
    expect(parameters.wells[0].rateCubicMetersPerDay).toBe(25);
    expect(parameters.fixedHeadCells[0].headMeters).toBe(100);
  });

  it("does not accidentally share metadata between scenarios", () => {
    const parameters = modelParameters();
    const first = createScenario({ id: "one", name: "One", parameters });
    const second = createScenario({ id: "two", name: "Two", parameters });

    expect(first.boundary).not.toBe(second.boundary);
    const regional = setScenarioHydraulicReference(first, "regional");

    expect(second.boundary.referenceKind).toBe("river");
    expect(regional.boundary).not.toBe(first.boundary);
  });
});
