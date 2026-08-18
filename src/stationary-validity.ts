import type { GroundwaterModelInput } from "./groundwater.js";

export type StationaryValidityCode =
  | "VALID"
  | "MISSING_HYDRAULIC_REFERENCE"
  | "INVALID_FIXED_HEAD"
  | "WELL_ON_FIXED_HEAD";

export interface StationaryValidityResult {
  readonly valid: boolean;
  readonly code: StationaryValidityCode;
}

/** Comprueba las condiciones mínimas de referencia para un modelo estacionario. */
export function validateStationaryModel(
  input: GroundwaterModelInput,
): StationaryValidityResult {
  if (input.fixedHeadCells.length === 0) {
    return { valid: false, code: "MISSING_HYDRAULIC_REFERENCE" };
  }

  const fixedHeadIndexes = new Set<number>();
  for (const cell of input.fixedHeadCells) {
    if (!isCellInsideGrid(cell.row, cell.column, input.rows, input.columns)) {
      return { valid: false, code: "INVALID_FIXED_HEAD" };
    }
    if (!Number.isFinite(cell.headMeters)) {
      return { valid: false, code: "INVALID_FIXED_HEAD" };
    }
    fixedHeadIndexes.add(cell.row * input.columns + cell.column);
  }

  for (const well of input.wells) {
    if (fixedHeadIndexes.has(well.row * input.columns + well.column)) {
      return { valid: false, code: "WELL_ON_FIXED_HEAD" };
    }
  }

  return { valid: true, code: "VALID" };
}

function isCellInsideGrid(
  row: number,
  column: number,
  rows: number,
  columns: number,
): boolean {
  return (
    Number.isInteger(row) &&
    Number.isInteger(column) &&
    row >= 0 &&
    row < rows &&
    column >= 0 &&
    column < columns
  );
}
