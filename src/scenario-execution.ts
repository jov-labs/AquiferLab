import type { GroundwaterModelInput } from "./groundwater.js";
import type { Scenario } from "./scenarios.js";

/**
 * Materializes a scenario's hydraulic parameters for a future run.
 * Boundary metadata must already be reflected in `fixedHeadCells`.
 */
export function buildModelInput(scenario: Scenario): GroundwaterModelInput {
  const { parameters } = scenario;
  return {
    ...parameters,
    fixedHeadCells: parameters.fixedHeadCells.map((cell) => ({ ...cell })),
    wells: parameters.wells.map((well) => ({ ...well })),
  };
}
