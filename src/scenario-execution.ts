import type { GroundwaterModelInput } from "./groundwater.js";
import type { Scenario } from "./scenarios.js";

/**
 * Materializa los parámetros hidráulicos de un escenario para una ejecución futura.
 * Los metadatos de frontera ya deben estar reflejados en `fixedHeadCells`.
 */
export function buildModelInput(scenario: Scenario): GroundwaterModelInput {
  const { parameters } = scenario;
  return {
    ...parameters,
    fixedHeadCells: parameters.fixedHeadCells.map((cell) => ({ ...cell })),
    wells: parameters.wells.map((well) => ({ ...well })),
  };
}
