import {
  createDefaultModelInput,
  type ExtractionWell,
  type GroundwaterModelInput,
} from "./groundwater.js";

/** Pozos visibles históricos del simulador, en el orden A/B. */
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
 * Construye la configuración hidráulica inicial visible sin leer controles DOM.
 * Conserva los defaults del modelo y materializa los dos pozos históricos A/B.
 */
export function createInitialModelInput(): GroundwaterModelInput {
  const defaultInput = createDefaultModelInput();
  return {
    ...defaultInput,
    fixedHeadCells: defaultInput.fixedHeadCells.map((cell) => ({ ...cell })),
    wells: [{ ...INITIAL_WELL_A }, { ...INITIAL_WELL_B }],
  };
}
