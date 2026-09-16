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

describe("active scenario selection", () => {
  it("initially activates the first scenario", () => {
    expect(createScenarioSelection(scenarios())).toEqual({ activeScenarioId: "one" });
  });

  it("keeps exactly one valid active id", () => {
    const available = scenarios();
    const selection = setActiveScenario(
      createScenarioSelection(available),
      available,
      "two",
    );

    expect(selection).toEqual({ activeScenarioId: "two" });
    expect(available.filter((scenario) => scenario.id === selection.activeScenarioId)).toHaveLength(1);
  });

  it("allows activating the second scenario without modifying any Scenario", () => {
    const available = scenarios();
    const before = structuredClone(available);
    const selection = setActiveScenario(createScenarioSelection(available), available, "two");

    expect(selection.activeScenarioId).toBe("two");
    expect(available).toEqual(before);
  });

  it("preserves the active scenario when adding one", () => {
    const available = scenarios();
    const selection = setActiveScenario(createScenarioSelection(available), available, "two");
    const withNewScenario = [...available, createScenario({ id: "four", name: "Cuatro", parameters: createDefaultModelInput() })];

    expect(setActiveScenario(selection, withNewScenario, selection.activeScenarioId)).toEqual(selection);
  });

  it("preserves the active scenario when another scenario is removed", () => {
    const before = scenarios();
    const selection = setActiveScenario(createScenarioSelection(before), before, "two");
    const after = before.filter((scenario) => scenario.id !== "three");

    expect(reconcileScenarioSelectionAfterRemoval(selection, before, after, "three")).toEqual(selection);
  });

  it("selects the next scenario when the active one is removed", () => {
    const before = scenarios();
    const selection = setActiveScenario(createScenarioSelection(before), before, "two");
    const after = before.filter((scenario) => scenario.id !== "two");

    expect(reconcileScenarioSelectionAfterRemoval(selection, before, after, "two")).toEqual({
      activeScenarioId: "three",
    });
  });

  it("selects the previous scenario when the last active one is removed", () => {
    const before = scenarios();
    const selection = setActiveScenario(createScenarioSelection(before), before, "three");
    const after = before.filter((scenario) => scenario.id !== "three");

    expect(reconcileScenarioSelectionAfterRemoval(selection, before, after, "three")).toEqual({
      activeScenarioId: "two",
    });
  });

  it("never leaves a nonexistent activeScenarioId", () => {
    const before = scenarios();
    const selection = { activeScenarioId: "missing" };
    const after = before.filter((scenario) => scenario.id !== "one");

    expect(reconcileScenarioSelectionAfterRemoval(selection, before, after, "one")).toEqual({
      activeScenarioId: "two",
    });
  });

  it("does not alter selection when renaming", () => {
    const before = scenarios();
    const selection = setActiveScenario(createScenarioSelection(before), before, "two");
    const renamed = before.map((scenario) =>
      scenario.id === "two" ? renameScenario(scenario, "Renombrado") : scenario,
    );

    expect(setActiveScenario(selection, renamed, selection.activeScenarioId)).toEqual(selection);
  });

  it("does not alter selection when editing parameters", () => {
    const before = scenarios();
    const selection = setActiveScenario(createScenarioSelection(before), before, "two");
    const updated = before.map((scenario) =>
      scenario.id === "two"
        ? updateScenarioParameters(scenario, { ...scenario.parameters, thicknessMeters: 35 })
        : scenario,
    );

    expect(setActiveScenario(selection, updated, selection.activeScenarioId)).toEqual(selection);
  });

  it("does not alter selection when changing river/regional", () => {
    const before = scenarios();
    const selection = setActiveScenario(createScenarioSelection(before), before, "two");
    const updated = before.map((scenario) =>
      scenario.id === "two" ? setScenarioHydraulicReference(scenario, "regional") : scenario,
    );

    expect(setActiveScenario(selection, updated, selection.activeScenarioId)).toEqual(selection);
  });
});
