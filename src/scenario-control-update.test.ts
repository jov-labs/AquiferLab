import { describe, expect, it } from "vitest";

import {
  createDefaultModelInput,
  litersPerSecondToCubicMetersPerDay,
  metersPerSecondToMetersPerDay,
  millimetersPerYearToMetersPerDay,
} from "./groundwater.js";
import { buildModelInput } from "./scenario-execution.js";
import {
  createInitialScenarioTableState,
  setScenarioReferenceInTable,
  setScenarioRegionalReferenceSideInTable,
  updateActiveScenarioTableValue,
  type ScenarioTableState,
} from "./scenario-table.js";
import {
  scenarioControlUpdate,
  updateActiveScenarioFromControl,
  type MainHydraulicControl,
} from "./scenario-control-update.js";

function activeScenarioTable(initialState: ScenarioTableState, activeScenarioId = "scenario-1") {
  let state = initialState;
  return {
    updateActiveScenarioValue(field: Parameters<typeof updateActiveScenarioTableValue>[2], value: number) {
      const result = updateActiveScenarioTableValue(state, activeScenarioId, field, value);
      state = result.state;
      return result.scenario;
    },
    getState() {
      return state;
    },
  };
}

describe("active Scenario update from main controls", () => {
  it("maps the six controls to the table hydraulic contract", () => {
    const updates: readonly [MainHydraulicControl, number, string, number][] = [
      ["hydraulicConductivityExponent", -5, "hydraulicConductivity", 1e-5],
      ["recharge", 250, "recharge", 250],
      ["thickness", 35, "thickness", 35],
      ["riverHead", 110, "riverHead", 110],
      ["wellARate", 15, "wellARate", 15],
      ["wellBRate", 25, "wellBRate", 25],
    ];

    for (const [control, value, field, expectedValue] of updates) {
      expect(scenarioControlUpdate(control, value)).toEqual({ field, value: expectedValue });
    }
  });

  it("preserves the regional boundary, wells, and inactive scenario when updating all six controls", () => {
    const initial = setScenarioRegionalReferenceSideInTable(
      setScenarioReferenceInTable(
        createInitialScenarioTableState({
          ...createDefaultModelInput(),
          wells: [
            { row: 8, column: 12, rateCubicMetersPerDay: 86.4 },
            { row: 31, column: 26, rateCubicMetersPerDay: 172.8 },
          ],
        }),
        "scenario-1",
        "regional",
      ),
      "scenario-1",
      "east",
    );
    const fixedHeadCoordinates = initial.scenarios[0].parameters.fixedHeadCells.map(
      ({ row, column }) => ({ row, column }),
    );
    const inactiveScenario = initial.scenarios[1];
    const table = activeScenarioTable(initial);

    updateActiveScenarioFromControl(table, "hydraulicConductivityExponent", -5);
    updateActiveScenarioFromControl(table, "recharge", 250);
    updateActiveScenarioFromControl(table, "thickness", 35);
    updateActiveScenarioFromControl(table, "riverHead", 110);
    updateActiveScenarioFromControl(table, "wellARate", 15);
    const updated = updateActiveScenarioFromControl(table, "wellBRate", 25);
    const input = buildModelInput(updated);

    expect(updated.boundary).toEqual({ referenceKind: "regional", regionalReferenceSide: "east" });
    expect(updated.parameters.hydraulicConductivityMetersPerDay).toBeCloseTo(
      metersPerSecondToMetersPerDay(1e-5),
    );
    expect(updated.parameters.rechargeMetersPerDay).toBeCloseTo(
      millimetersPerYearToMetersPerDay(250),
    );
    expect(updated.parameters.thicknessMeters).toBe(35);
    expect(updated.parameters.fixedHeadCells.map(({ row, column }) => ({ row, column }))).toEqual(
      fixedHeadCoordinates,
    );
    expect(updated.parameters.fixedHeadCells.every((cell) => cell.headMeters === 110)).toBe(true);
    expect(updated.parameters.wells).toEqual([
      { row: 8, column: 12, rateCubicMetersPerDay: litersPerSecondToCubicMetersPerDay(15) },
      { row: 31, column: 26, rateCubicMetersPerDay: litersPerSecondToCubicMetersPerDay(25) },
    ]);
    expect(table.getState().scenarios[1]).toEqual(inactiveScenario);
    expect(input).toEqual(updated.parameters);
  });
});
