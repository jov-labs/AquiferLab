import type { ScenarioTableInterface } from "./scenario-table-ui.js";
import type { ScenarioTableHydraulicField } from "./scenario-table.js";
import type { Scenario } from "./scenarios.js";

export type MainHydraulicControl =
  | "hydraulicConductivityExponent"
  | "recharge"
  | "thickness"
  | "riverHead"
  | "wellARate"
  | "wellBRate";

export interface ScenarioControlUpdate {
  readonly field: ScenarioTableHydraulicField;
  /** Value in visible units, already normalized by scenario-table.ts. */
  readonly value: number;
}

/**
 * Adapts a raw value from the main controls to the table contract.
 * Pure updaters in scenario-table.ts are responsible for remaining conversions
 * to internal units.
 */
export function scenarioControlUpdate(
  control: MainHydraulicControl,
  value: number,
): ScenarioControlUpdate {
  switch (control) {
    case "hydraulicConductivityExponent":
      return { field: "hydraulicConductivity", value: 10 ** value };
    case "recharge":
      return { field: "recharge", value };
    case "thickness":
      return { field: "thickness", value };
    case "riverHead":
      return { field: "riverHead", value };
    case "wellARate":
      return { field: "wellARate", value };
    case "wellBRate":
      return { field: "wellBRate", value };
  }
}

/** Updates the active scenario through the interface without reading the DOM or running calculations. */
export function updateActiveScenarioFromControl(
  scenarioTable: Pick<ScenarioTableInterface, "updateActiveScenarioValue">,
  control: MainHydraulicControl,
  value: number,
): Scenario {
  const update = scenarioControlUpdate(control, value);
  return scenarioTable.updateActiveScenarioValue(update.field, update.value);
}
