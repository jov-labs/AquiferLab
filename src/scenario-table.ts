import {
  litersPerSecondToCubicMetersPerDay,
  metersPerDayToMetersPerSecond,
  metersPerSecondToMetersPerDay,
  millimetersPerYearToMetersPerDay,
  metersPerDayToMillimetersPerYear,
  type GroundwaterModelInput,
} from "./groundwater.js";
import { gridCellAtMeters, gridCellCenterMeters } from "./grid-coordinates.js";
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
  | "wellAX"
  | "wellAY"
  | "wellBRate"
  | "wellBX"
  | "wellBY"
  | "wellDistance";

export interface ScenarioTableRow {
  field: ScenarioTableField;
  labelKey:
    | "scenarioParameterK"
    | "scenarioParameterThickness"
    | "recharge"
    | "riverHead"
    | "scenarioWellARate"
    | "scenarioWellAX"
    | "scenarioWellAY"
    | "scenarioWellBRate"
    | "scenarioWellBX"
    | "scenarioWellBY"
    | "scenarioWellDistance";
  unitKey: "metersPerSecondUnit" | "rechargeUnit" | "metersUnit" | "litersPerSecondUnit";
  min: number;
  max: number;
  step: number | "any";
  readonly?: boolean;
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
  { field: "wellAX", labelKey: "scenarioWellAX", unitKey: "metersUnit", min: 0, max: Infinity, step: "any" },
  { field: "wellAY", labelKey: "scenarioWellAY", unitKey: "metersUnit", min: 0, max: Infinity, step: "any" },
  { field: "wellBRate", labelKey: "scenarioWellBRate", unitKey: "litersPerSecondUnit", min: 0, max: 50, step: 1 },
  { field: "wellBX", labelKey: "scenarioWellBX", unitKey: "metersUnit", min: 0, max: Infinity, step: "any" },
  { field: "wellBY", labelKey: "scenarioWellBY", unitKey: "metersUnit", min: 0, max: Infinity, step: "any" },
  {
    field: "wellDistance",
    labelKey: "scenarioWellDistance",
    unitKey: "metersUnit",
    min: 0,
    max: Infinity,
    step: "any",
    readonly: true,
  },
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

export type UpdateScenarioPositionResult =
  | { readonly ok: true; readonly state: ScenarioTableState }
  | {
      readonly ok: false;
      readonly reason: "POSITION_OUTSIDE_DOMAIN" | "POSITION_ON_FIXED_HEAD";
      readonly state: ScenarioTableState;
    };

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
    case "wellAX":
      return wellPositionMeters(parameters, 0).xMeters;
    case "wellAY":
      return wellPositionMeters(parameters, 0).yMeters;
    case "wellBRate":
      return cubicMetersPerDayToLitersPerSecond(parameters.wells[1]?.rateCubicMetersPerDay ?? 0);
    case "wellBX":
      return wellPositionMeters(parameters, 1).xMeters;
    case "wellBY":
      return wellPositionMeters(parameters, 1).yMeters;
    case "wellDistance":
      return distanceBetweenWellsMeters(parameters);
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
    case "wellAX":
    case "wellAY":
    case "wellBX":
    case "wellBY":
    case "wellDistance":
      return scenario;
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

/** Actualiza X o Y de un pozo usando la celda que contiene esa coordenada física. */
export function updateScenarioPositionInTable(
  state: ScenarioTableState,
  id: string,
  field: "wellAX" | "wellAY" | "wellBX" | "wellBY",
  value: number,
): UpdateScenarioPositionResult {
  const scenario = state.scenarios.find((candidate) => candidate.id === id);
  if (!scenario) {
    return { ok: false, reason: "POSITION_OUTSIDE_DOMAIN", state };
  }

  const wellIndex = field === "wellAX" || field === "wellAY" ? 0 : 1;
  const currentPosition = wellPositionMeters(scenario.parameters, wellIndex);
  const xMeters = field === "wellAX" || field === "wellBX" ? value : currentPosition.xMeters;
  const yMeters = field === "wellAY" || field === "wellBY" ? value : currentPosition.yMeters;
  const cell = gridCellAtMeters(scenario.parameters, xMeters, yMeters);
  if (!cell) {
    return { ok: false, reason: "POSITION_OUTSIDE_DOMAIN", state };
  }
  if (scenario.parameters.fixedHeadCells.some((fixed) => fixed.row === cell.row && fixed.column === cell.column)) {
    return { ok: false, reason: "POSITION_ON_FIXED_HEAD", state };
  }

  const nextScenario = updateScenarioParameters(scenario, {
    ...scenario.parameters,
    wells: scenario.parameters.wells.map((well, index) =>
      index === wellIndex ? { ...well, ...cell } : { ...well },
    ),
  });
  return {
    ok: true,
    state: {
      scenarios: state.scenarios.map((candidate) =>
        candidate.id === id ? nextScenario : candidate,
      ),
    },
  };
}

export function scenarioTableBounds(
  scenario: Scenario,
  field: ScenarioTableField,
): { min: number; max: number } {
  if (field === "wellAX" || field === "wellBX") {
    return { min: 0, max: scenario.parameters.widthMeters };
  }
  if (field === "wellAY" || field === "wellBY") {
    return { min: 0, max: scenario.parameters.heightMeters };
  }
  const row = SCENARIO_TABLE_ROWS.find((candidate) => candidate.field === field);
  return { min: row?.min ?? 0, max: row?.max ?? Infinity };
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

function wellPositionMeters(parameters: GroundwaterModelInput, wellIndex: number) {
  const well = parameters.wells[wellIndex];
  if (!well) {
    return { xMeters: 0, yMeters: 0 };
  }
  return gridCellCenterMeters(parameters, well.row, well.column);
}

function distanceBetweenWellsMeters(parameters: GroundwaterModelInput): number {
  const wellA = wellPositionMeters(parameters, 0);
  const wellB = wellPositionMeters(parameters, 1);
  return Math.hypot(wellB.xMeters - wellA.xMeters, wellB.yMeters - wellA.yMeters);
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
