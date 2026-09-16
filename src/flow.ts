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
        throw new Error("The Darcy field contains non-finite values.");
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
  assertPositive(input.widthMeters, "Physical width");
  assertPositive(input.heightMeters, "Physical height");
  assertPositive(input.hydraulicConductivityMetersPerDay, "K");
  assertGridDimension(input.rows, "Row count");
  assertGridDimension(input.columns, "Column count");

  if (headsMeters.length !== input.rows) {
    throw new Error("headsMeters must have the same row count as the grid.");
  }
  for (const row of headsMeters) {
    if (row.length !== input.columns) {
      throw new Error("headsMeters must be a rectangular matrix compatible with the grid.");
    }
    for (const head of row) {
      if (!Number.isFinite(head)) {
        throw new Error("headsMeters cannot contain NaN or Infinity.");
      }
    }
  }
}

function assertPositive(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be a finite number greater than zero.`);
  }
}

function assertGridDimension(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 3) {
    throw new Error(`${label} must be an integer of at least 3.`);
  }
}
