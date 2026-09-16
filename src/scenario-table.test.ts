import { describe, expect, it } from "vitest";

import { createDefaultModelInput } from "./groundwater.js";
import { createScenarioSelection } from "./scenario-selection.js";
import {
  MAX_SCENARIOS,
  HYDRAULIC_REFERENCE_OPTIONS,
  REGIONAL_REFERENCE_SIDE_OPTIONS,
  SCENARIO_TABLE_ROWS,
  addScenarioToTable,
  createInitialScenarioTableState,
  getScenarioTableValue,
  removeScenarioFromTable,
  renameScenarioInTable,
  setScenarioReferenceInTable,
  setScenarioRegionalReferenceSideInTable,
  updateActiveScenarioTableValue,
  updateScenarioInTable,
  updateScenarioPositionInTable,
} from "./scenario-table.js";

function tableState() {
  return createInitialScenarioTableState({
    ...createDefaultModelInput(),
    wells: [
      { row: 20, column: 20, rateCubicMetersPerDay: 86.4 },
      { row: 28, column: 30, rateCubicMetersPerDay: 172.8 },
    ],
  });
}

describe("scenario comparator presentation model", () => {
  it("initializes two scenarios", () => {
    expect(tableState().scenarios).toHaveLength(2);
  });

  it("shows each Scenario value using the existing control units", () => {
    const [scenario] = tableState().scenarios;

    expect(getScenarioTableValue(scenario, "hydraulicConductivity")).toBeCloseTo(1e-4);
    expect(getScenarioTableValue(scenario, "recharge")).toBe(120);
    expect(getScenarioTableValue(scenario, "thickness")).toBe(20);
    expect(getScenarioTableValue(scenario, "riverHead")).toBe(100);
    expect(getScenarioTableValue(scenario, "wellARate")).toBeCloseTo(1);
    expect(getScenarioTableValue(scenario, "wellBRate")).toBeCloseTo(2);
    expect(getScenarioTableValue(scenario, "wellAX")).toBe(1_000);
    expect(getScenarioTableValue(scenario, "wellAY")).toBe(1_000);
    expect(getScenarioTableValue(scenario, "wellBX")).toBeCloseTo(1487.8048780487804);
    expect(getScenarioTableValue(scenario, "wellBY")).toBeCloseTo(1390.2439024390244);
    expect(getScenarioTableValue(scenario, "wellDistance")).toBeCloseTo(624.6950475544243);
  });

  it("edits a cell only in the corresponding scenario", () => {
    const original = tableState();
    const updated = updateScenarioInTable(original, "scenario-1", "thickness", 35);

    expect(updated.scenarios[0].parameters.thicknessMeters).toBe(35);
    expect(updated.scenarios[1].parameters.thicknessMeters).toBe(20);
    expect(original.scenarios[0].parameters.thicknessMeters).toBe(20);
  });

  it("updates only the active scenario and returns its new version", () => {
    const initial = tableState();
    const selection = createScenarioSelection(initial.scenarios);
    const result = updateActiveScenarioTableValue(
      initial,
      selection.activeScenarioId,
      "thickness",
      35,
    );

    expect(result.scenario.id).toBe("scenario-1");
    expect(selection.activeScenarioId).toBe("scenario-1");
    expect(result.scenario.parameters.thicknessMeters).toBe(35);
    expect(result.state.scenarios[0]).toBe(result.scenario);
    expect(result.state.scenarios[1]).toEqual(initial.scenarios[1]);
    expect(initial.scenarios[0].parameters.thicknessMeters).toBe(20);
  });

  it("preserves regional metadata and geometry when updating the active head", () => {
    const regional = setScenarioRegionalReferenceSideInTable(
      setScenarioReferenceInTable(tableState(), "scenario-1", "regional"),
      "scenario-1",
      "east",
    );
    const beforeCells = regional.scenarios[0].parameters.fixedHeadCells.map(({ row, column }) => ({ row, column }));
    const result = updateActiveScenarioTableValue(regional, "scenario-1", "riverHead", 110);

    expect(result.scenario.boundary).toEqual({
      referenceKind: "regional",
      regionalReferenceSide: "east",
    });
    expect(result.scenario.parameters.fixedHeadCells.map(({ row, column }) => ({ row, column }))).toEqual(
      beforeCells,
    );
    expect(result.scenario.parameters.fixedHeadCells.every((cell) => cell.headMeters === 110)).toBe(true);
  });

  it("updates active rates by slot without moving the wells", () => {
    const initial = tableState();
    const afterA = updateActiveScenarioTableValue(initial, "scenario-1", "wellARate", 15);
    const afterB = updateActiveScenarioTableValue(afterA.state, "scenario-1", "wellBRate", 25);

    expect(afterA.scenario.parameters.wells[0]).toMatchObject({
      row: 20,
      column: 20,
      rateCubicMetersPerDay: 1_296,
    });
    expect(afterA.scenario.parameters.wells[1]).toEqual(initial.scenarios[0].parameters.wells[1]);
    expect(afterB.scenario.parameters.wells[0]).toEqual(afterA.scenario.parameters.wells[0]);
    expect(afterB.scenario.parameters.wells[1]).toMatchObject({
      row: 28,
      column: 30,
      rateCubicMetersPerDay: 2_160,
    });
    expect(afterB.state.scenarios[1]).toEqual(initial.scenarios[1]);
  });

  it("accumulates hydraulic updates on the latest active scenario", () => {
    const initial = tableState();
    const afterK = updateActiveScenarioTableValue(
      initial,
      "scenario-1",
      "hydraulicConductivity",
      1e-5,
    );
    const afterRecharge = updateActiveScenarioTableValue(
      afterK.state,
      "scenario-1",
      "recharge",
      250,
    );

    expect(getScenarioTableValue(afterRecharge.scenario, "hydraulicConductivity")).toBeCloseTo(1e-5);
    expect(getScenarioTableValue(afterRecharge.scenario, "recharge")).toBe(250);
    expect(afterRecharge.scenario.parameters.thicknessMeters).toBe(20);
  });

  it("exposes exactly the River and Regional reference options", () => {
    expect(HYDRAULIC_REFERENCE_OPTIONS).toEqual(["river", "regional"]);
    expect(tableState().scenarios.map((scenario) => scenario.boundary.referenceKind)).toEqual([
      "river",
      "river",
    ]);
  });

  it("changes only the reference of the specified scenario", () => {
    const initial = tableState();
    const regional = setScenarioReferenceInTable(initial, "scenario-1", "regional");

    expect(regional.scenarios[0].boundary.referenceKind).toBe("regional");
    expect(regional.scenarios[1].boundary.referenceKind).toBe("river");
    expect(regional.scenarios[0].parameters).toEqual(initial.scenarios[0].parameters);
    expect(regional.scenarios[0].parameters.fixedHeadCells).toEqual(
      initial.scenarios[0].parameters.fixedHeadCells,
    );
    expect(regional.scenarios[0].parameters.wells).toEqual(initial.scenarios[0].parameters.wells);
  });

  it("keeps the reference head editable independently of metadata", () => {
    const initial = setScenarioReferenceInTable(tableState(), "scenario-1", "regional");
    const updated = updateScenarioInTable(initial, "scenario-1", "riverHead", 110);

    expect(updated.scenarios[0].boundary.referenceKind).toBe("regional");
    expect(updated.scenarios[0].parameters.fixedHeadCells.every((cell) => cell.headMeters === 110)).toBe(true);
    expect(updated.scenarios[1].parameters.fixedHeadCells[0].headMeters).toBe(100);
  });

  it("preserves the fixed head when switching from River to Regional", () => {
    const initial = tableState();
    const regional = setScenarioReferenceInTable(initial, "scenario-1", "regional");

    expect(regional.scenarios[0].parameters.fixedHeadCells).toEqual(
      initial.scenarios[0].parameters.fixedHeadCells,
    );
  });

  it("sets the regional side only in the specified scenario", () => {
    const initial = setScenarioReferenceInTable(tableState(), "scenario-1", "regional");
    const east = setScenarioRegionalReferenceSideInTable(initial, "scenario-1", "east");

    expect(REGIONAL_REFERENCE_SIDE_OPTIONS).toEqual(["west", "east", "north", "south"]);
    expect(east.scenarios[0].boundary.regionalReferenceSide).toBe("east");
    expect(east.scenarios[0].parameters.fixedHeadCells.every((cell) => cell.column === 40)).toBe(true);
    expect(east.scenarios[0].parameters.wells).toEqual(initial.scenarios[0].parameters.wells);
    expect(east.scenarios[1]).toEqual(initial.scenarios[1]);
  });

  it("uses a neutral label for the head row", () => {
    expect(SCENARIO_TABLE_ROWS.find((row) => row.field === "riverHead")?.labelKey).toBe(
      "scenarioReferenceHead",
    );
  });

  it("changes A X only in the specified scenario and preserves its rate", () => {
    const initial = tableState();
    const result = updateScenarioPositionInTable(initial, "scenario-1", "wellAX", 1_100);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.scenarios[0].parameters.wells[0]).toMatchObject({
      row: 20,
      column: 22,
      rateCubicMetersPerDay: 86.4,
    });
    expect(result.state.scenarios[1].parameters.wells[0]).toEqual(initial.scenarios[1].parameters.wells[0]);
  });

  it("changes B Y only in the specified scenario and preserves its rate", () => {
    const initial = tableState();
    const result = updateScenarioPositionInTable(initial, "scenario-1", "wellBY", 1_500);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.scenarios[0].parameters.wells[1]).toMatchObject({
      row: 30,
      column: 30,
      rateCubicMetersPerDay: 172.8,
    });
    expect(result.state.scenarios[1].parameters.wells[1]).toEqual(initial.scenarios[1].parameters.wells[1]);
  });

  it("preserves existing additional well properties when moving it", () => {
    const wellA = {
      row: 20,
      column: 20,
      rateCubicMetersPerDay: 86.4,
      existingMetadata: "preserve",
    };
    const state = createInitialScenarioTableState({
      ...createDefaultModelInput(),
      wells: [wellA, { row: 28, column: 30, rateCubicMetersPerDay: 172.8 }],
    });
    const result = updateScenarioPositionInTable(state, "scenario-1", "wellAX", 1_100);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect((result.state.scenarios[0].parameters.wells[0] as typeof wellA).existingMetadata).toBe(
      "preserve",
    );
  });

  it("recalculates the A–B distance from the well positions in each scenario", () => {
    const initial = tableState();
    const result = updateScenarioPositionInTable(initial, "scenario-1", "wellBX", 1_000);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(getScenarioTableValue(result.state.scenarios[0], "wellDistance")).toBeCloseTo(
      390.2439024390244,
    );
    expect(getScenarioTableValue(result.state.scenarios[1], "wellDistance")).toBeCloseTo(
      624.6950475544243,
    );
  });

  it("rejects an out-of-domain coordinate without corrupting the Scenario", () => {
    const initial = tableState();
    const result = updateScenarioPositionInTable(initial, "scenario-1", "wellAX", 2_000);

    expect(result).toMatchObject({ ok: false, reason: "POSITION_OUTSIDE_DOMAIN", state: initial });
    expect(initial.scenarios[0].parameters.wells[0]).toEqual({
      row: 20,
      column: 20,
      rateCubicMetersPerDay: 86.4,
    });
  });

  it("preserves unrelated parameters when changing a position", () => {
    const initial = tableState();
    const result = updateScenarioPositionInTable(initial, "scenario-1", "wellAY", 1_100);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const after = result.state.scenarios[0].parameters;
    expect(after.hydraulicConductivityMetersPerDay).toBe(
      initial.scenarios[0].parameters.hydraulicConductivityMetersPerDay,
    );
    expect(after.thicknessMeters).toBe(initial.scenarios[0].parameters.thicknessMeters);
    expect(after.rechargeMetersPerDay).toBe(initial.scenarios[0].parameters.rechargeMetersPerDay);
    expect(after.fixedHeadCells).toEqual(initial.scenarios[0].parameters.fixedHeadCells);
    expect(after.wells[1]).toEqual(initial.scenarios[0].parameters.wells[1]);
  });

  it("renames a scenario", () => {
    const renamed = renameScenarioInTable(tableState(), "scenario-1", "High recharge");

    expect(renamed.scenarios[0].name).toBe("High recharge");
  });

  it("allows adding up to four scenarios but not a fifth", () => {
    let state = tableState();
    while (state.scenarios.length < MAX_SCENARIOS) {
      const result = addScenarioToTable(state);
      expect(result.ok).toBe(true);
      if (result.ok) {
        state = result.state;
      }
    }

    const fifth = addScenarioToTable(state);

    expect(state.scenarios).toHaveLength(4);
    expect(fifth).toMatchObject({ ok: false, reason: "MAX_SCENARIOS_REACHED", state });
  });

  it("allows adding a scenario after removing one", () => {
    const full = addScenarioToTable(addScenarioToTable(tableState()).state);
    expect(full.ok).toBe(true);
    if (!full.ok) return;
    const removed = removeScenarioFromTable(full.state, "scenario-2");
    expect(removed.ok).toBe(true);
    if (!removed.ok) return;

    const added = addScenarioToTable(removed.state);

    expect(added.ok).toBe(true);
    if (added.ok) {
      expect(added.state.scenarios).toHaveLength(4);
    }
  });

  it("does not allow removing the last scenario", () => {
    const initial = tableState();
    const afterFirstRemoval = removeScenarioFromTable(initial, "scenario-1");
    expect(afterFirstRemoval.ok).toBe(true);
    if (!afterFirstRemoval.ok) return;

    expect(removeScenarioFromTable(afterFirstRemoval.state, "scenario-2")).toMatchObject({
      ok: false,
      reason: "MINIMUM_SCENARIO_REQUIRED",
    });
  });

  it("declares the correct units in a separate column", () => {
    expect(SCENARIO_TABLE_ROWS.map((row) => row.unitKey)).toEqual([
      "metersPerSecondUnit",
      "rechargeUnit",
      "metersUnit",
      "metersUnit",
      "litersPerSecondUnit",
      "metersUnit",
      "metersUnit",
      "litersPerSecondUnit",
      "metersUnit",
      "metersUnit",
      "metersUnit",
    ]);
  });

  it("preserves hidden parameters unchanged when editing a row", () => {
    const initial = tableState();
    const before = initial.scenarios[0].parameters;
    const updated = updateScenarioInTable(initial, "scenario-1", "wellARate", 12);
    const after = updated.scenarios[0].parameters;

    expect(after.widthMeters).toBe(before.widthMeters);
    expect(after.heightMeters).toBe(before.heightMeters);
    expect(after.rows).toBe(before.rows);
    expect(after.columns).toBe(before.columns);
    expect(after.tolerance).toBe(before.tolerance);
    expect(after.maxIterations).toBe(before.maxIterations);
    expect(after.fixedHeadCells).toEqual(before.fixedHeadCells);
    expect(after.wells[1]).toEqual(before.wells[1]);
  });
});
