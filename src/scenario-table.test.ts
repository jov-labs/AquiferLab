import { describe, expect, it } from "vitest";

import { createDefaultModelInput } from "./groundwater.js";
import {
  MAX_SCENARIOS,
  HYDRAULIC_REFERENCE_OPTIONS,
  SCENARIO_TABLE_ROWS,
  addScenarioToTable,
  createInitialScenarioTableState,
  getScenarioTableValue,
  removeScenarioFromTable,
  renameScenarioInTable,
  setScenarioReferenceInTable,
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
    expect(getScenarioTableValue(scenario, "wellAX")).toBe(1_000);
    expect(getScenarioTableValue(scenario, "wellAY")).toBe(1_000);
    expect(getScenarioTableValue(scenario, "wellBX")).toBeCloseTo(1487.8048780487804);
    expect(getScenarioTableValue(scenario, "wellBY")).toBeCloseTo(1390.2439024390244);
    expect(getScenarioTableValue(scenario, "wellDistance")).toBeCloseTo(624.6950475544243);
  });

  it("edita una celda sólo en el escenario correspondiente", () => {
    const original = tableState();
    const updated = updateScenarioInTable(original, "scenario-1", "thickness", 35);

    expect(updated.scenarios[0].parameters.thicknessMeters).toBe(35);
    expect(updated.scenarios[1].parameters.thicknessMeters).toBe(20);
    expect(original.scenarios[0].parameters.thicknessMeters).toBe(20);
  });

  it("expone exactamente las referencias Río y Regional", () => {
    expect(HYDRAULIC_REFERENCE_OPTIONS).toEqual(["river", "regional"]);
    expect(tableState().scenarios.map((scenario) => scenario.boundary.referenceKind)).toEqual([
      "river",
      "river",
    ]);
  });

  it("cambia solo la referencia del escenario indicado", () => {
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

  it("mantiene editable la carga de referencia sin depender del metadato", () => {
    const initial = setScenarioReferenceInTable(tableState(), "scenario-1", "regional");
    const updated = updateScenarioInTable(initial, "scenario-1", "riverHead", 110);

    expect(updated.scenarios[0].boundary.referenceKind).toBe("regional");
    expect(updated.scenarios[0].parameters.fixedHeadCells.every((cell) => cell.headMeters === 110)).toBe(true);
    expect(updated.scenarios[1].parameters.fixedHeadCells[0].headMeters).toBe(100);
  });

  it("mantiene la carga fija al cambiar de Río a Regional", () => {
    const initial = tableState();
    const regional = setScenarioReferenceInTable(initial, "scenario-1", "regional");

    expect(regional.scenarios[0].parameters.fixedHeadCells).toEqual(
      initial.scenarios[0].parameters.fixedHeadCells,
    );
  });

  it("usa una etiqueta neutral para la fila de carga", () => {
    expect(SCENARIO_TABLE_ROWS.find((row) => row.field === "riverHead")?.labelKey).toBe(
      "scenarioReferenceHead",
    );
  });

  it("cambia X de A sólo en el escenario indicado y conserva su caudal", () => {
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

  it("cambia Y de B sólo en el escenario indicado y conserva su caudal", () => {
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

  it("conserva las propiedades adicionales existentes del pozo al moverlo", () => {
    const wellA = {
      row: 20,
      column: 20,
      rateCubicMetersPerDay: 86.4,
      existingMetadata: "preservar",
    };
    const state = createInitialScenarioTableState({
      ...createDefaultModelInput(),
      wells: [wellA, { row: 28, column: 30, rateCubicMetersPerDay: 172.8 }],
    });
    const result = updateScenarioPositionInTable(state, "scenario-1", "wellAX", 1_100);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect((result.state.scenarios[0].parameters.wells[0] as typeof wellA).existingMetadata).toBe(
      "preservar",
    );
  });

  it("recalcula la distancia A–B a partir de las posiciones de cada escenario", () => {
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

  it("rechaza una coordenada fuera del dominio sin corromper el Scenario", () => {
    const initial = tableState();
    const result = updateScenarioPositionInTable(initial, "scenario-1", "wellAX", 2_000);

    expect(result).toMatchObject({ ok: false, reason: "POSITION_OUTSIDE_DOMAIN", state: initial });
    expect(initial.scenarios[0].parameters.wells[0]).toEqual({
      row: 20,
      column: 20,
      rateCubicMetersPerDay: 86.4,
    });
  });

  it("mantiene parámetros no relacionados al cambiar una posición", () => {
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
      "metersUnit",
      "metersUnit",
      "litersPerSecondUnit",
      "metersUnit",
      "metersUnit",
      "metersUnit",
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
