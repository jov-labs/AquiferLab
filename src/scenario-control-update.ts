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
  /** Valor en las unidades visibles que ya normaliza scenario-table.ts. */
  readonly value: number;
}

/**
 * Adapta un valor bruto de los controles principales al contrato de la tabla.
 * Las conversiones restantes a unidades internas son responsabilidad de los
 * actualizadores puros de scenario-table.ts.
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

/** Actualiza el escenario activo mediante la interfaz, sin leer el DOM ni ejecutar cálculos. */
export function updateActiveScenarioFromControl(
  scenarioTable: Pick<ScenarioTableInterface, "updateActiveScenarioValue">,
  control: MainHydraulicControl,
  value: number,
): Scenario {
  const update = scenarioControlUpdate(control, value);
  return scenarioTable.updateActiveScenarioValue(update.field, update.value);
}
