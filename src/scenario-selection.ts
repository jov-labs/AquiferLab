import type { Scenario } from "./scenarios.js";

export interface ScenarioSelection {
  readonly activeScenarioId: string;
}

export function createScenarioSelection(
  scenarios: readonly Scenario[],
): ScenarioSelection {
  const firstScenario = scenarios[0];
  if (!firstScenario) {
    throw new Error("At least one scenario is required to create the active selection.");
  }
  return { activeScenarioId: firstScenario.id };
}

export function setActiveScenario(
  selection: ScenarioSelection,
  scenarios: readonly Scenario[],
  scenarioId: string,
): ScenarioSelection {
  if (scenarios.some((scenario) => scenario.id === scenarioId)) {
    return { activeScenarioId: scenarioId };
  }
  return scenarios.some((scenario) => scenario.id === selection.activeScenarioId)
    ? selection
    : createScenarioSelection(scenarios);
}

export function reconcileScenarioSelectionAfterRemoval(
  selection: ScenarioSelection,
  scenariosBeforeRemoval: readonly Scenario[],
  scenariosAfterRemoval: readonly Scenario[],
  removedScenarioId: string,
): ScenarioSelection {
  if (selection.activeScenarioId !== removedScenarioId) {
    return scenariosAfterRemoval.some((scenario) => scenario.id === selection.activeScenarioId)
      ? selection
      : createScenarioSelection(scenariosAfterRemoval);
  }

  const removedIndex = scenariosBeforeRemoval.findIndex(
    (scenario) => scenario.id === removedScenarioId,
  );
  const nextScenario = scenariosAfterRemoval[removedIndex] ?? scenariosAfterRemoval[removedIndex - 1];
  if (!nextScenario) {
    throw new Error("At least one scenario is required after removal.");
  }
  return { activeScenarioId: nextScenario.id };
}
