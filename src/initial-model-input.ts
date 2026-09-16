import {
  createDefaultModelInput,
  type ExtractionWell,
  type GroundwaterModelInput,
} from "./groundwater.js";

/** Historical visible wells of the simulator, in A/B order. */
export const INITIAL_WELL_A: Readonly<ExtractionWell> = {
  row: 20,
  column: 20,
  rateCubicMetersPerDay: 0,
};

export const INITIAL_WELL_B: Readonly<ExtractionWell> = {
  row: 28,
  column: 30,
  rateCubicMetersPerDay: 0,
};

/**
 * Builds the visible initial hydraulic configuration without reading DOM controls.
 * Preserves model defaults and materializes the two historical A/B wells.
 */
export function createInitialModelInput(): GroundwaterModelInput {
  const defaultInput = createDefaultModelInput();
  return {
    ...defaultInput,
    fixedHeadCells: defaultInput.fixedHeadCells.map((cell) => ({ ...cell })),
    wells: [{ ...INITIAL_WELL_A }, { ...INITIAL_WELL_B }],
  };
}
