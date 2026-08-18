import type { GroundwaterModelInput } from "./groundwater.js";
import {
  createRegionalFixedHeadCells,
  type RegionalReferenceSide,
} from "./regional-reference.js";

/** Número máximo de escenarios que puede contener el comparador futuro. */
export const MAX_SCENARIOS = 4;

export type HydraulicReferenceKind = "river" | "regional";
export type { RegionalReferenceSide } from "./regional-reference.js";

export interface ScenarioBoundaryMetadata {
  readonly referenceKind: HydraulicReferenceKind;
  /** Lado completo usado únicamente cuando la referencia es regional. */
  readonly regionalReferenceSide: RegionalReferenceSide;
}

export interface ScenarioBoundaryOptions {
  readonly referenceKind: HydraulicReferenceKind;
  readonly regionalReferenceSide?: RegionalReferenceSide;
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
  boundary?: ScenarioBoundaryOptions;
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
    boundary: createBoundaryMetadata(boundary),
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
    boundary: { ...scenario.boundary, referenceKind },
  };
}

/** Configura el lado de carga fija de un escenario regional sin tocar pozos ni otros parámetros. */
export function setScenarioRegionalReferenceSide(
  scenario: Scenario,
  regionalReferenceSide: RegionalReferenceSide,
): Scenario {
  const boundary = { ...scenario.boundary, regionalReferenceSide };
  if (scenario.boundary.referenceKind !== "regional") {
    return {
      ...scenario,
      parameters: cloneParameters(scenario.parameters),
      boundary,
    };
  }

  const referenceHeadMeters = scenario.parameters.fixedHeadCells[0]?.headMeters;
  if (referenceHeadMeters === undefined) {
    return {
      ...scenario,
      parameters: cloneParameters(scenario.parameters),
      boundary,
    };
  }

  return {
    ...scenario,
    parameters: cloneParameters({
      ...scenario.parameters,
      fixedHeadCells: createRegionalFixedHeadCells(
        scenario.parameters,
        regionalReferenceSide,
        referenceHeadMeters,
      ),
    }),
    boundary,
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
  return {
    referenceKind: boundary.referenceKind,
    regionalReferenceSide: boundary.regionalReferenceSide,
  };
}

function createBoundaryMetadata(
  boundary: ScenarioBoundaryOptions | undefined,
): ScenarioBoundaryMetadata {
  return {
    referenceKind: boundary?.referenceKind ?? "river",
    regionalReferenceSide: boundary?.regionalReferenceSide ?? "west",
  };
}

function cloneParameters(parameters: GroundwaterModelInput): GroundwaterModelInput {
  return {
    ...parameters,
    fixedHeadCells: parameters.fixedHeadCells.map((cell) => ({ ...cell })),
    wells: parameters.wells.map((well) => ({ ...well })),
  };
}
