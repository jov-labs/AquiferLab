import type { GroundwaterModelInput } from "./groundwater.js";

export interface DarcyVector {
  row: number;
  column: number;
  qxMetersPerDay: number;
  qzMetersPerDay: number;
  magnitudeMetersPerDay: number;
}

export interface DarcyFlowField {
  vectors: DarcyVector[];
  maxMagnitudeMetersPerDay: number;
}

/**
 * Calculates Darcy specific discharge in interior cells.
 * Does not calculate interstitial velocity or particle trajectories.
 */
export function calculateDarcyFlow(
  input: GroundwaterModelInput,
  headsMeters: readonly (readonly number[])[],
): DarcyFlowField {
  validateInputAndHeads(input, headsMeters);

  const dx = input.widthMeters / input.columns;
  const dz = input.heightMeters / input.rows;
  const vectors: DarcyVector[] = [];
  let maxMagnitudeMetersPerDay = 0;

  for (let row = 1; row < input.rows - 1; row += 1) {
    for (let column = 1; column < input.columns - 1; column += 1) {
      const gradientX =
        (headsMeters[row][column + 1] - headsMeters[row][column - 1]) / (2 * dx);
      const gradientZ =
        (headsMeters[row + 1][column] - headsMeters[row - 1][column]) / (2 * dz);
      const qxMetersPerDay =
        gradientX === 0 ? 0 : -input.hydraulicConductivityMetersPerDay * gradientX;
      const qzMetersPerDay =
        gradientZ === 0 ? 0 : -input.hydraulicConductivityMetersPerDay * gradientZ;
      const magnitudeMetersPerDay = Math.hypot(qxMetersPerDay, qzMetersPerDay);

      if (
        !Number.isFinite(qxMetersPerDay) ||
        !Number.isFinite(qzMetersPerDay) ||
        !Number.isFinite(magnitudeMetersPerDay)
      ) {
        throw new Error("El campo de Darcy contiene valores no finitos.");
      }

      vectors.push({
        row,
        column,
        qxMetersPerDay,
        qzMetersPerDay,
        magnitudeMetersPerDay,
      });
      maxMagnitudeMetersPerDay = Math.max(maxMagnitudeMetersPerDay, magnitudeMetersPerDay);
    }
  }

  return { vectors, maxMagnitudeMetersPerDay };
}

function validateInputAndHeads(
  input: GroundwaterModelInput,
  headsMeters: readonly (readonly number[])[],
): void {
  assertPositive(input.widthMeters, "El ancho físico");
  assertPositive(input.heightMeters, "El alto físico");
  assertPositive(input.hydraulicConductivityMetersPerDay, "K");
  assertGridDimension(input.rows, "El número de filas");
  assertGridDimension(input.columns, "El número de columnas");

  if (headsMeters.length !== input.rows) {
    throw new Error("headsMeters debe tener el mismo número de filas que la malla.");
  }
  for (const row of headsMeters) {
    if (row.length !== input.columns) {
      throw new Error("headsMeters debe ser una matriz rectangular compatible con la malla.");
    }
    for (const head of row) {
      if (!Number.isFinite(head)) {
        throw new Error("headsMeters no puede contener NaN ni Infinity.");
      }
    }
  }
}

function assertPositive(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} debe ser un número finito mayor que cero.`);
  }
}

function assertGridDimension(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 3) {
    throw new Error(`${label} debe ser un entero de al menos 3.`);
  }
}
