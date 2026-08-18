import { describe, expect, it } from "vitest";

import {
  createDefaultModelInput,
  solveGroundwater,
  type GroundwaterModelInput,
} from "./groundwater.js";
import { buildModelInput } from "./scenario-execution.js";
import {
  createScenario,
  setScenarioRegionalReferenceSide,
  type RegionalReferenceSide,
} from "./scenarios.js";

function modelParameters(): GroundwaterModelInput {
  return {
    ...createDefaultModelInput(),
    widthMeters: 1_200,
    heightMeters: 800,
    rows: 5,
    columns: 7,
    hydraulicConductivityMetersPerDay: 3.2,
    thicknessMeters: 31,
    rechargeMetersPerDay: 0.004,
    tolerance: 1e-8,
    maxIterations: 12_345,
    fixedHeadCells: [
      { row: 0, column: 0, headMeters: 99 },
      { row: 1, column: 0, headMeters: 101 },
    ],
    wells: [
      { row: 2, column: 3, rateCubicMetersPerDay: 40 },
      { row: 3, column: 5, rateCubicMetersPerDay: 25 },
    ],
  };
}

describe("adaptador de ejecución de Scenario", () => {
  it("conserva todos los valores escalares, la malla y el dominio", () => {
    const scenario = createScenario({ id: "base", name: "Base", parameters: modelParameters() });
    const input = buildModelInput(scenario);

    expect(input.widthMeters).toBe(1_200);
    expect(input.heightMeters).toBe(800);
    expect(input.rows).toBe(5);
    expect(input.columns).toBe(7);
    expect(input.hydraulicConductivityMetersPerDay).toBe(3.2);
    expect(input.thicknessMeters).toBe(31);
    expect(input.rechargeMetersPerDay).toBe(0.004);
    expect(input.tolerance).toBe(1e-8);
    expect(input.maxIterations).toBe(12_345);
  });

  it("conserva exactamente wells y fixedHeadCells", () => {
    const scenario = createScenario({ id: "base", name: "Base", parameters: modelParameters() });
    const input = buildModelInput(scenario);

    expect(input.wells).toEqual(scenario.parameters.wells);
    expect(input.fixedHeadCells).toEqual(scenario.parameters.fixedHeadCells);
  });

  it.each(["west", "east", "north", "south"] as const)(
    "lleva la frontera regional %s al solver sin reinterpretarla",
    (side: RegionalReferenceSide) => {
      const regional = createScenario({
        id: "regional",
        name: "Regional",
        parameters: modelParameters(),
        boundary: { referenceKind: "regional" },
      });
      const configured = setScenarioRegionalReferenceSide(regional, side);
      const input = buildModelInput(configured);

      expect(input.fixedHeadCells).toEqual(configured.parameters.fixedHeadCells);
      expect(input.fixedHeadCells).not.toBe(configured.parameters.fixedHeadCells);
      expect(solveGroundwater(input)).toMatchObject({ converged: true, isValid: true });
    },
  );

  it("produce soluciones distintas para referencias regionales oeste y este", () => {
    const regional = createScenario({
      id: "regional",
      name: "Regional",
      parameters: modelParameters(),
      boundary: { referenceKind: "regional" },
    });
    const west = setScenarioRegionalReferenceSide(regional, "west");
    const east = setScenarioRegionalReferenceSide(regional, "east");

    const westInput = buildModelInput(west);
    const eastInput = buildModelInput(east);
    const westResult = solveGroundwater(westInput);
    const eastResult = solveGroundwater(eastInput);

    expect(westInput.fixedHeadCells.every((cell) => cell.column === 0)).toBe(true);
    expect(eastInput.fixedHeadCells.every((cell) => cell.column === eastInput.columns - 1)).toBe(true);
    expect(westResult).toMatchObject({ converged: true, isValid: true });
    expect(eastResult).toMatchObject({ converged: true, isValid: true });
    expect(westResult.headsMeters[2][0]).not.toBe(eastResult.headsMeters[2][0]);
  });

  it("no reinterpreta la geometría física de una referencia river", () => {
    const scenario = createScenario({
      id: "river",
      name: "Río",
      parameters: modelParameters(),
      boundary: { referenceKind: "river", regionalReferenceSide: "south" },
    });
    const input = buildModelInput(scenario);

    expect(input.fixedHeadCells).toEqual(scenario.parameters.fixedHeadCells);
    expect(input.fixedHeadCells.every((cell) => cell.column === 0)).toBe(true);
    expect(solveGroundwater(input)).toMatchObject({ converged: true, isValid: true });
  });

  it("no muta el Scenario y aísla wells y fixedHeadCells mutables", () => {
    const scenario = createScenario({ id: "base", name: "Base", parameters: modelParameters() });
    const before = structuredClone(scenario);
    const input = buildModelInput(scenario);

    input.wells[0].rateCubicMetersPerDay = 999;
    input.fixedHeadCells[0].headMeters = 77;
    solveGroundwater(buildModelInput(scenario));

    expect(scenario).toEqual(before);
    expect(input.wells[0]).not.toBe(scenario.parameters.wells[0]);
    expect(input.fixedHeadCells[0]).not.toBe(scenario.parameters.fixedHeadCells[0]);
  });
});
