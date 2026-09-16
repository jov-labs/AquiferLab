export interface DrawdownResult {
  drawdownMeters: number[][];
  maxDrawdownMeters: number;
}

/**
 * Calculates raw drawdown per cell: s = h_reference - h_actual.
 * Negative values are retained to keep the scientific data traceable.
 */
export function calculateDrawdown(
  headsReferenceMeters: readonly (readonly number[])[],
  headsActualMeters: readonly (readonly number[])[],
): DrawdownResult {
  const referenceShape = validateHeadMatrix(headsReferenceMeters, "headsReferenceMeters");
  const actualShape = validateHeadMatrix(headsActualMeters, "headsActualMeters");
  if (
    referenceShape.rows !== actualShape.rows ||
    referenceShape.columns !== actualShape.columns
  ) {
    throw new Error("Reference and current matrices must have the same dimensions.");
  }

  const drawdownMeters = headsReferenceMeters.map((referenceRow, row) =>
    referenceRow.map((referenceHead, column) => referenceHead - headsActualMeters[row][column]),
  );
  const maxDrawdownMeters = Math.max(...drawdownMeters.flat());

  return { drawdownMeters, maxDrawdownMeters };
}

function validateHeadMatrix(
  matrix: readonly (readonly number[])[],
  label: string,
): { rows: number; columns: number } {
  if (matrix.length === 0) {
    throw new Error(`${label} cannot be empty.`);
  }
  const columns = matrix[0].length;
  if (columns === 0) {
    throw new Error(`${label} cannot have empty rows.`);
  }

  for (const row of matrix) {
    if (row.length !== columns) {
      throw new Error(`${label} must be a rectangular matrix.`);
    }
    for (const head of row) {
      if (!Number.isFinite(head)) {
        throw new Error(`${label} must contain only finite numbers.`);
      }
    }
  }

  return { rows: matrix.length, columns };
}
