import { describe, expect, it } from "vitest";

import { createDefaultModelInput } from "./groundwater.js";
import {
  MAX_SCENARIOS,
  SCENARIO_TABLE_ROWS,
  addScenarioToTable,
  createInitialScenarioTableState,
  getScenarioTableValue,
  removeScenarioFromTable,
  renameScenarioInTable,
  updateScenarioInTable,
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

describe("modelo de presentación del comparador de escenarios", () => {
  it("inicializa dos escenarios", () => {
    expect(tableState().scenarios).toHaveLength(2);
  });

  it("muestra los valores de cada Scenario en las unidades de los controles existentes", () => {
    const [scenario] = tableState().scenarios;

    expect(getScenarioTableValue(scenario, "hydraulicConductivity")).toBeCloseTo(1e-4);
    expect(getScenarioTableValue(scenario, "recharge")).toBe(120);
    expect(getScenarioTableValue(scenario, "thickness")).toBe(20);
    expect(getScenarioTableValue(scenario, "riverHead")).toBe(100);
    expect(getScenarioTableValue(scenario, "wellARate")).toBeCloseTo(1);
    expect(getScenarioTableValue(scenario, "wellBRate")).toBeCloseTo(2);
  });

  it("edita una celda sólo en el escenario correspondiente", () => {
    const original = tableState();
    const updated = updateScenarioInTable(original, "scenario-1", "thickness", 35);

    expect(updated.scenarios[0].parameters.thicknessMeters).toBe(35);
    expect(updated.scenarios[1].parameters.thicknessMeters).toBe(20);
    expect(original.scenarios[0].parameters.thicknessMeters).toBe(20);
  });

  it("renombra un escenario", () => {
    const renamed = renameScenarioInTable(tableState(), "scenario-1", "Recarga alta");

    expect(renamed.scenarios[0].name).toBe("Recarga alta");
  });

  it("permite añadir hasta cuatro escenarios y no un quinto", () => {
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

  it("permite añadir después de eliminar un escenario", () => {
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

  it("no permite eliminar el último escenario", () => {
    const initial = tableState();
    const afterFirstRemoval = removeScenarioFromTable(initial, "scenario-1");
    expect(afterFirstRemoval.ok).toBe(true);
    if (!afterFirstRemoval.ok) return;

    expect(removeScenarioFromTable(afterFirstRemoval.state, "scenario-2")).toMatchObject({
      ok: false,
      reason: "MINIMUM_SCENARIO_REQUIRED",
    });
  });

  it("declara las unidades correctas en una columna separada", () => {
    expect(SCENARIO_TABLE_ROWS.map((row) => row.unitKey)).toEqual([
      "metersPerSecondUnit",
      "rechargeUnit",
      "metersUnit",
      "metersUnit",
      "litersPerSecondUnit",
      "litersPerSecondUnit",
    ]);
  });

  it("conserva intactos los parámetros no mostrados al editar una fila", () => {
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
