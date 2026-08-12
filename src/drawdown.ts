export interface DrawdownResult {
  drawdownMeters: number[][];
  maxDrawdownMeters: number;
}

/**
 * Calcula el abatimiento bruto por celda: s = h_referencia - h_actual.
 * Los valores negativos se conservan para mantener el dato científico trazable.
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
    throw new Error("Las matrices de referencia y actual deben tener las mismas dimensiones.");
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
    throw new Error(`${label} no puede estar vacía.`);
  }
  const columns = matrix[0].length;
  if (columns === 0) {
    throw new Error(`${label} no puede tener filas vacías.`);
  }

  for (const row of matrix) {
    if (row.length !== columns) {
      throw new Error(`${label} debe ser una matriz rectangular.`);
    }
    for (const head of row) {
      if (!Number.isFinite(head)) {
        throw new Error(`${label} debe contener únicamente números finitos.`);
      }
    }
  }

  return { rows: matrix.length, columns };
}
