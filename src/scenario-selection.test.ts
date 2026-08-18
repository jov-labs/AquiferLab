import { describe, expect, it } from "vitest";

import { createDefaultModelInput } from "./groundwater.js";
import {
  createScenario,
  renameScenario,
  setScenarioHydraulicReference,
  updateScenarioParameters,
  type Scenario,
} from "./scenarios.js";
import {
  createScenarioSelection,
  reconcileScenarioSelectionAfterRemoval,
  setActiveScenario,
} from "./scenario-selection.js";

function scenarios(): Scenario[] {
  const parameters = createDefaultModelInput();
  return [
    createScenario({ id: "one", name: "Uno", parameters }),
    createScenario({ id: "two", name: "Dos", parameters }),
    createScenario({ id: "three", name: "Tres", parameters }),
  ];
}

describe("selección activa de escenarios", () => {
  it("activa inicialmente el primer escenario", () => {
    expect(createScenarioSelection(scenarios())).toEqual({ activeScenarioId: "one" });
  });

  it("mantiene exactamente un id activo válido", () => {
    const available = scenarios();
    const selection = setActiveScenario(
      createScenarioSelection(available),
      available,
      "two",
    );

    expect(selection).toEqual({ activeScenarioId: "two" });
    expect(available.filter((scenario) => scenario.id === selection.activeScenarioId)).toHaveLength(1);
  });

  it("permite activar el segundo escenario sin modificar ningún Scenario", () => {
    const available = scenarios();
    const before = structuredClone(available);
    const selection = setActiveScenario(createScenarioSelection(available), available, "two");

    expect(selection.activeScenarioId).toBe("two");
    expect(available).toEqual(before);
  });

  it("conserva el activo al añadir un escenario", () => {
    const available = scenarios();
    const selection = setActiveScenario(createScenarioSelection(available), available, "two");
    const withNewScenario = [...available, createScenario({ id: "four", name: "Cuatro", parameters: createDefaultModelInput() })];

    expect(setActiveScenario(selection, withNewScenario, selection.activeScenarioId)).toEqual(selection);
  });

  it("conserva el activo si se elimina otro escenario", () => {
    const before = scenarios();
    const selection = setActiveScenario(createScenarioSelection(before), before, "two");
    const after = before.filter((scenario) => scenario.id !== "three");

    expect(reconcileScenarioSelectionAfterRemoval(selection, before, after, "three")).toEqual(selection);
  });

  it("selecciona el siguiente si se elimina el activo", () => {
    const before = scenarios();
    const selection = setActiveScenario(createScenarioSelection(before), before, "two");
    const after = before.filter((scenario) => scenario.id !== "two");

    expect(reconcileScenarioSelectionAfterRemoval(selection, before, after, "two")).toEqual({
      activeScenarioId: "three",
    });
  });

  it("selecciona el anterior si se elimina el último activo", () => {
    const before = scenarios();
    const selection = setActiveScenario(createScenarioSelection(before), before, "three");
    const after = before.filter((scenario) => scenario.id !== "three");

    expect(reconcileScenarioSelectionAfterRemoval(selection, before, after, "three")).toEqual({
      activeScenarioId: "two",
    });
  });

  it("nunca deja un activeScenarioId inexistente", () => {
    const before = scenarios();
    const selection = { activeScenarioId: "missing" };
    const after = before.filter((scenario) => scenario.id !== "one");

    expect(reconcileScenarioSelectionAfterRemoval(selection, before, after, "one")).toEqual({
      activeScenarioId: "two",
    });
  });

  it("renombrar no altera la selección", () => {
    const before = scenarios();
    const selection = setActiveScenario(createScenarioSelection(before), before, "two");
    const renamed = before.map((scenario) =>
      scenario.id === "two" ? renameScenario(scenario, "Renombrado") : scenario,
    );

    expect(setActiveScenario(selection, renamed, selection.activeScenarioId)).toEqual(selection);
  });

  it("editar parámetros no altera la selección", () => {
    const before = scenarios();
    const selection = setActiveScenario(createScenarioSelection(before), before, "two");
    const updated = before.map((scenario) =>
      scenario.id === "two"
        ? updateScenarioParameters(scenario, { ...scenario.parameters, thicknessMeters: 35 })
        : scenario,
    );

    expect(setActiveScenario(selection, updated, selection.activeScenarioId)).toEqual(selection);
  });

  it("cambiar river/regional no altera la selección", () => {
    const before = scenarios();
    const selection = setActiveScenario(createScenarioSelection(before), before, "two");
    const updated = before.map((scenario) =>
      scenario.id === "two" ? setScenarioHydraulicReference(scenario, "regional") : scenario,
    );

    expect(setActiveScenario(selection, updated, selection.activeScenarioId)).toEqual(selection);
  });
});
