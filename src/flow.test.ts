import { describe, expect, it } from "vitest";

import { calculateDarcyFlow } from "./flow.js";
import type { GroundwaterModelInput } from "./groundwater.js";

function flowInput(): GroundwaterModelInput {
  return {
    widthMeters: 600,
    heightMeters: 500,
    rows: 5,
    columns: 6,
    hydraulicConductivityMetersPerDay: 3,
    thicknessMeters: 10,
    rechargeMetersPerDay: 0,
    fixedHeadCells: [{ row: 0, column: 0, headMeters: 100 }],
    wells: [],
    tolerance: 1e-8,
    maxIterations: 100,
  };
}

function analyticalHeads(
  input: GroundwaterModelInput,
  valueAtCenter: (xMeters: number, zMeters: number) => number,
): number[][] {
  const dx = input.widthMeters / input.columns;
  const dz = input.heightMeters / input.rows;
  return Array.from({ length: input.rows }, (_, row) =>
    Array.from({ length: input.columns }, (_, column) =>
      valueAtCenter((column + 0.5) * dx, (row + 0.5) * dz),
    ),
  );
}

describe("Darcy specific-discharge field", () => {
  it("returns zero flow for a constant head", () => {
    const input = flowInput();
    const field = calculateDarcyFlow(input, analyticalHeads(input, () => 100));

    expect(field.maxMagnitudeMetersPerDay).toBe(0);
    for (const vector of field.vectors) {
      expect(vector.qxMetersPerDay).toBe(0);
      expect(vector.qzMetersPerDay).toBe(0);
      expect(vector.magnitudeMetersPerDay).toBe(0);
    }
  });

  it("calculates qx for a linear gradient only in X", () => {
    const input = flowInput();
    const slopeX = 0.02;
    const field = calculateDarcyFlow(
      input,
      analyticalHeads(input, (xMeters) => 120 - slopeX * xMeters),
    );

    for (const vector of field.vectors) {
      expect(vector.qxMetersPerDay).toBeCloseTo(input.hydraulicConductivityMetersPerDay * slopeX, 12);
      expect(vector.qzMetersPerDay).toBeCloseTo(0, 12);
    }
  });

  it("calculates qz for a linear gradient only in Z", () => {
    const input = flowInput();
    const slopeZ = 0.015;
    const field = calculateDarcyFlow(
      input,
      analyticalHeads(input, (_xMeters, zMeters) => 120 - slopeZ * zMeters),
    );

    for (const vector of field.vectors) {
      expect(vector.qxMetersPerDay).toBeCloseTo(0, 12);
      expect(vector.qzMetersPerDay).toBeCloseTo(input.hydraulicConductivityMetersPerDay * slopeZ, 12);
    }
  });

  it("calculates magnitude for a combined linear gradient", () => {
    const input = flowInput();
    const slopeX = 0.01;
    const slopeZ = 0.015;
    const field = calculateDarcyFlow(
      input,
      analyticalHeads(input, (xMeters, zMeters) => 120 - slopeX * xMeters - slopeZ * zMeters),
    );
    const expectedMagnitude = input.hydraulicConductivityMetersPerDay * Math.hypot(slopeX, slopeZ);

    for (const vector of field.vectors) {
      expect(vector.magnitudeMetersPerDay).toBeCloseTo(expectedMagnitude, 12);
    }
  });

  it("rejects incompatible headsMeters dimensions", () => {
    const input = flowInput();
    expect(() => calculateDarcyFlow(input, [[100]])).toThrow(/row count/);
    expect(() =>
      calculateDarcyFlow(input, Array.from({ length: input.rows }, () => [100])),
    ).toThrow(/rectangular/);
  });

  it("rejects NaN and Infinity", () => {
    const input = flowInput();
    const headsWithNaN = analyticalHeads(input, () => 100);
    headsWithNaN[2][2] = Number.NaN;
    expect(() => calculateDarcyFlow(input, headsWithNaN)).toThrow(/NaN or Infinity/);

    const headsWithInfinity = analyticalHeads(input, () => 100);
    headsWithInfinity[2][2] = Number.POSITIVE_INFINITY;
    expect(() => calculateDarcyFlow(input, headsWithInfinity)).toThrow(/NaN or Infinity/);
  });
});
