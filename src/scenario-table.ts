import {
  litersPerSecondToCubicMetersPerDay,
  metersPerDayToMetersPerSecond,
  metersPerSecondToMetersPerDay,
  millimetersPerYearToMetersPerDay,
  metersPerDayToMillimetersPerYear,
  type GroundwaterModelInput,
} from "./groundwater.js";
import {
  MAX_SCENARIOS,
  addScenario,
  createScenario,
  removeScenario,
  renameScenario,
  updateScenarioParameters,
  type Scenario,
} from "./scenarios.js";

export type ScenarioTableField =
  | "hydraulicConductivity"
  | "recharge"
  | "thickness"
  | "riverHead"
  | "wellARate"
  | "wellBRate";

export interface ScenarioTableRow {
  field: ScenarioTableField;
  labelKey:
    | "scenarioParameterK"
    | "scenarioParameterThickness"
    | "recharge"
    | "riverHead"
    | "scenarioWellARate"
    | "scenarioWellBRate";
  unitKey: "metersPerSecondUnit" | "rechargeUnit" | "metersUnit" | "litersPerSecondUnit";
  min: number;
  max: number;
  step: number | "any";
}

export const SCENARIO_TABLE_ROWS: readonly ScenarioTableRow[] = [
  {
    field: "hydraulicConductivity",
    labelKey: "scenarioParameterK",
    unitKey: "metersPerSecondUnit",
    min: 1e-6,
    max: 1e-4,
    step: "any",
  },
  { field: "recharge", labelKey: "recharge", unitKey: "rechargeUnit", min: 0, max: 500, step: 10 },
  { field: "thickness", labelKey: "scenarioParameterThickness", unitKey: "metersUnit", min: 10, max: 100, step: 5 },
  { field: "riverHead", labelKey: "riverHead", unitKey: "metersUnit", min: 80, max: 120, step: 1 },
  { field: "wellARate", labelKey: "scenarioWellARate", unitKey: "litersPerSecondUnit", min: 0, max: 50, step: 1 },
  { field: "wellBRate", labelKey: "scenarioWellBRate", unitKey: "litersPerSecondUnit", min: 0, max: 50, step: 1 },
];

export interface ScenarioTableState {
  readonly scenarios: readonly Scenario[];
}

export type AddScenarioTableResult =
  | { readonly ok: true; readonly state: ScenarioTableState }
  | { readonly ok: false; readonly reason: "MAX_SCENARIOS_REACHED"; readonly state: ScenarioTableState };

export type RemoveScenarioTableResult =
  | { readonly ok: true; readonly state: ScenarioTableState }
  | { readonly ok: false; readonly reason: "MINIMUM_SCENARIO_REQUIRED"; readonly state: ScenarioTableState };

/** Crea las dos columnas iniciales a partir de la configuración vigente del simulador. */
export function createInitialScenarioTableState(
  parameters: GroundwaterModelInput,
): ScenarioTableState {
  return {
    scenarios: [
      createScenario({ id: "scenario-1", name: "Escenario 1", parameters }),
      createScenario({ id: "scenario-2", name: "Escenario 2", parameters }),
    ],
  };
}

/** Lee un valor visible de una fila, usando las mismas unidades que los controles existentes. */
export function getScenarioTableValue(scenario: Scenario, field: ScenarioTableField): number {
  const { parameters } = scenario;
  switch (field) {
    case "hydraulicConductivity":
      return metersPerDayToMetersPerSecond(parameters.hydraulicConductivityMetersPerDay);
    case "recharge":
      return metersPerDayToMillimetersPerYear(parameters.rechargeMetersPerDay);
    case "thickness":
      return parameters.thicknessMeters;
    case "riverHead":
      return parameters.fixedHeadCells[0]?.headMeters ?? 0;
    case "wellARate":
      return cubicMetersPerDayToLitersPerSecond(parameters.wells[0]?.rateCubicMetersPerDay ?? 0);
    case "wellBRate":
      return cubicMetersPerDayToLitersPerSecond(parameters.wells[1]?.rateCubicMetersPerDay ?? 0);
  }
}

/** Actualiza una sola fila sin alterar los demás parámetros del escenario. */
export function updateScenarioTableValue(
  scenario: Scenario,
  field: ScenarioTableField,
  value: number,
): Scenario {
  const row = SCENARIO_TABLE_ROWS.find((candidate) => candidate.field === field);
  if (!row || !Number.isFinite(value) || value < row.min || value > row.max) {
    return scenario;
  }

  const parameters = scenario.parameters;
  switch (field) {
    case "hydraulicConductivity":
      return updateScenarioParameters(scenario, {
        ...parameters,
        hydraulicConductivityMetersPerDay: metersPerSecondToMetersPerDay(value),
      });
    case "recharge":
      return updateScenarioParameters(scenario, {
        ...parameters,
        rechargeMetersPerDay: millimetersPerYearToMetersPerDay(value),
      });
    case "thickness":
      return updateScenarioParameters(scenario, { ...parameters, thicknessMeters: value });
    case "riverHead":
      return updateScenarioParameters(scenario, {
        ...parameters,
        fixedHeadCells: parameters.fixedHeadCells.map((cell) => ({ ...cell, headMeters: value })),
      });
    case "wellARate":
      return updateWellRate(scenario, 0, value);
    case "wellBRate":
      return updateWellRate(scenario, 1, value);
  }
}

export function renameScenarioInTable(
  state: ScenarioTableState,
  id: string,
  name: string,
): ScenarioTableState {
  return {
    scenarios: state.scenarios.map((scenario) =>
      scenario.id === id ? renameScenario(scenario, name) : scenario,
    ),
  };
}

export function updateScenarioInTable(
  state: ScenarioTableState,
  id: string,
  field: ScenarioTableField,
  value: number,
): ScenarioTableState {
  return {
    scenarios: state.scenarios.map((scenario) =>
      scenario.id === id ? updateScenarioTableValue(scenario, field, value) : scenario,
    ),
  };
}

export function addScenarioToTable(state: ScenarioTableState): AddScenarioTableResult {
  const source = state.scenarios.at(-1);
  if (!source) {
    return { ok: false, reason: "MAX_SCENARIOS_REACHED", state };
  }

  const sequence = nextScenarioSequence(state.scenarios);
  const result = addScenario(
    state.scenarios,
    createScenario({
      id: `scenario-${sequence}`,
      name: `Escenario ${sequence}`,
      parameters: source.parameters,
    }),
  );
  if (!result.ok) {
    return { ok: false, reason: result.reason, state };
  }
  return { ok: true, state: { scenarios: result.scenarios } };
}

export function removeScenarioFromTable(
  state: ScenarioTableState,
  id: string,
): RemoveScenarioTableResult {
  if (state.scenarios.length <= 1) {
    return { ok: false, reason: "MINIMUM_SCENARIO_REQUIRED", state };
  }
  return { ok: true, state: { scenarios: removeScenario(state.scenarios, id) } };
}

function updateWellRate(scenario: Scenario, wellIndex: number, value: number): Scenario {
  const parameters = scenario.parameters;
  return updateScenarioParameters(scenario, {
    ...parameters,
    wells: parameters.wells.map((well, index) =>
      index === wellIndex
        ? { ...well, rateCubicMetersPerDay: litersPerSecondToCubicMetersPerDay(value) }
        : { ...well },
    ),
  });
}

function cubicMetersPerDayToLitersPerSecond(value: number): number {
  return (value * 1_000) / 86_400;
}

function nextScenarioSequence(scenarios: readonly Scenario[]): number {
  const used = new Set(
    scenarios
      .map((scenario) => Number(scenario.id.replace("scenario-", "")))
      .filter(Number.isInteger),
  );
  let sequence = 1;
  while (used.has(sequence)) {
    sequence += 1;
  }
  return sequence;
}

export { MAX_SCENARIOS };
