import type { GroundwaterModelInput } from "./groundwater.js";

/** Número máximo de escenarios que puede contener el comparador futuro. */
export const MAX_SCENARIOS = 4;

export type HydraulicReferenceKind = "river" | "regional";

export interface ScenarioBoundaryMetadata {
  readonly referenceKind: HydraulicReferenceKind;
}

/**
 * Configuración de un escenario hidrogeológico.
 *
 * `GroundwaterModelInput` es el mismo contrato que consume el solver actual.
 */
export interface Scenario {
  readonly id: string;
  readonly name: string;
  readonly parameters: GroundwaterModelInput;
  readonly boundary: ScenarioBoundaryMetadata;
}

export interface CreateScenarioOptions {
  id: string;
  name: string;
  parameters: GroundwaterModelInput;
  boundary?: ScenarioBoundaryMetadata;
}

export type AddScenarioResult =
  | { readonly ok: true; readonly scenarios: readonly Scenario[] }
  | {
      readonly ok: false;
      readonly reason: "MAX_SCENARIOS_REACHED";
      readonly scenarios: readonly Scenario[];
    };

/** Crea un escenario aislado a partir de parámetros ya válidos para el solver. */
export function createScenario({ id, name, parameters, boundary }: CreateScenarioOptions): Scenario {
  return {
    id,
    name,
    parameters: cloneParameters(parameters),
    boundary: cloneBoundary(boundary ?? { referenceKind: "river" }),
  };
}

/** Devuelve una copia del escenario con un nombre nuevo. */
export function renameScenario(scenario: Scenario, name: string): Scenario {
  return {
    ...scenario,
    name,
    parameters: cloneParameters(scenario.parameters),
    boundary: cloneBoundary(scenario.boundary),
  };
}

/** Devuelve una copia del escenario con una configuración nueva e independiente. */
export function updateScenarioParameters(
  scenario: Scenario,
  parameters: GroundwaterModelInput,
): Scenario {
  return {
    ...scenario,
    parameters: cloneParameters(parameters),
    boundary: cloneBoundary(scenario.boundary),
  };
}

/** Devuelve una copia con la procedencia semántica de la referencia actualizada. */
export function setScenarioHydraulicReference(
  scenario: Scenario,
  referenceKind: HydraulicReferenceKind,
): Scenario {
  return {
    ...scenario,
    parameters: cloneParameters(scenario.parameters),
    boundary: { referenceKind },
  };
}

/** Añade un escenario mientras la colección no alcance el límite definido. */
export function addScenario(
  scenarios: readonly Scenario[],
  scenario: Scenario,
): AddScenarioResult {
  if (scenarios.length >= MAX_SCENARIOS) {
    return { ok: false, reason: "MAX_SCENARIOS_REACHED", scenarios: [...scenarios] };
  }

  return { ok: true, scenarios: [...scenarios, cloneScenario(scenario)] };
}

/** Elimina el escenario cuyo id coincide; si no existe, devuelve una copia de la colección. */
export function removeScenario(scenarios: readonly Scenario[], id: string): readonly Scenario[] {
  return scenarios.filter((scenario) => scenario.id !== id);
}

/** Busca un escenario por su identificador estable. */
export function getScenarioById(
  scenarios: readonly Scenario[],
  id: string,
): Scenario | undefined {
  return scenarios.find((scenario) => scenario.id === id);
}

function cloneScenario(scenario: Scenario): Scenario {
  return {
    ...scenario,
    parameters: cloneParameters(scenario.parameters),
    boundary: cloneBoundary(scenario.boundary),
  };
}

function cloneBoundary(boundary: ScenarioBoundaryMetadata): ScenarioBoundaryMetadata {
  return { referenceKind: boundary.referenceKind };
}

function cloneParameters(parameters: GroundwaterModelInput): GroundwaterModelInput {
  return {
    ...parameters,
    fixedHeadCells: parameters.fixedHeadCells.map((cell) => ({ ...cell })),
    wells: parameters.wells.map((well) => ({ ...well })),
  };
}
