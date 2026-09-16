import { describe, expect, it } from "vitest";

import { calculateDrawdown } from "./drawdown.js";
import {
  createDefaultModelInput,
  solveGroundwater,
  type GroundwaterModelInput,
} from "./groundwater.js";

function withoutPumping(input: GroundwaterModelInput): GroundwaterModelInput {
  return {
    ...input,
    wells: input.wells.map((well) => ({ ...well, rateCubicMetersPerDay: 0 })),
  };
}

function withRiverHead(
  input: GroundwaterModelInput,
  headMeters: number,
): GroundwaterModelInput {
  return {
    ...input,
    fixedHeadCells: input.fixedHeadCells.map((cell) => ({ ...cell, headMeters })),
  };
}

describe("pure drawdown calculation", () => {
  it("returns zero for identical matrices", () => {
    const heads = [
      [100, 101],
      [102, 103],
    ];

    const result = calculateDrawdown(heads, heads);

    expect(result.drawdownMeters).toEqual([
      [0, 0],
      [0, 0],
    ]);
    expect(result.maxDrawdownMeters).toBe(0);
  });

  it("calculates 10 m for reference 100 and actual 90", () => {
    const result = calculateDrawdown([[100]], [[90]]);

    expect(result.drawdownMeters).toEqual([[10]]);
    expect(result.maxDrawdownMeters).toBe(10);
  });

  it("calculates differences and maximum for a variable matrix", () => {
    const result = calculateDrawdown(
      [
        [100, 90],
        [80, 70],
      ],
      [
        [95, 85],
        [75, 68],
      ],
    );

    expect(result.drawdownMeters).toEqual([
      [5, 5],
      [5, 2],
    ]);
    expect(result.maxDrawdownMeters).toBe(5);
  });

  it("preserves negative drawdown without clamping", () => {
    const result = calculateDrawdown([[90]], [[100]]);

    expect(result.drawdownMeters).toEqual([[-10]]);
    expect(result.maxDrawdownMeters).toBe(-10);
  });

  it("rejects incompatible dimensions", () => {
    expect(() => calculateDrawdown([[100, 100]], [[100], [100]])).toThrow(/same dimensions/);
  });

  it("rejects non-rectangular matrices", () => {
    expect(() => calculateDrawdown([[100], [100, 100]], [[100], [100]])).toThrow(
      /rectangular/,
    );
  });

  it("rejects empty matrices", () => {
    expect(() => calculateDrawdown([], [])).toThrow(/empty/);
  });

  it("rejects NaN", () => {
    expect(() => calculateDrawdown([[Number.NaN]], [[100]])).toThrow(/finite numbers/);
  });

  it("rejects Infinity", () => {
    expect(() => calculateDrawdown([[100]], [[Number.POSITIVE_INFINITY]])).toThrow(
      /finite numbers/,
    );
  });

  it("does not modify input matrices", () => {
    const reference = [
      [100, 90],
      [80, 70],
    ];
    const actual = [
      [95, 85],
      [75, 68],
    ];
    const referenceBefore = reference.map((row) => [...row]);
    const actualBefore = actual.map((row) => [...row]);

    calculateDrawdown(reference, actual);

    expect(reference).toEqual(referenceBefore);
    expect(actual).toEqual(actualBefore);
  });
});

describe("drawdown with the steady-state model", () => {
  it("is approximately zero in the real no-pumping scenario", () => {
    const input = createDefaultModelInput();
    const reference = solveGroundwater(withoutPumping(input));
    const actual = solveGroundwater(withoutPumping(input));
    const drawdown = calculateDrawdown(reference.headsMeters, actual.headsMeters);
    const maximumAbsoluteDrawdown = Math.max(
      ...drawdown.drawdownMeters.flat().map((value) => Math.abs(value)),
    );

    expect(reference.converged).toBe(true);
    expect(actual.converged).toBe(true);
    expect(maximumAbsoluteDrawdown).toBeLessThanOrEqual(1e-9);
  }, 20_000);

  it("produces positive drawdown near a real extraction well", () => {
    const actualInput: GroundwaterModelInput = {
      ...createDefaultModelInput(),
      wells: [{ row: 20, column: 20, rateCubicMetersPerDay: 25 }],
    };
    const reference = solveGroundwater(withoutPumping(actualInput));
    const actual = solveGroundwater(actualInput);
    const drawdown = calculateDrawdown(reference.headsMeters, actual.headsMeters);

    expect(reference.converged).toBe(true);
    expect(actual.converged).toBe(true);
    expect(drawdown.drawdownMeters[20][20]).toBeGreaterThan(0);
    expect(drawdown.maxDrawdownMeters).toBeGreaterThan(0);
  }, 20_000);

  it("preserves drawdown when moving the prescribed river head", () => {
    const base: GroundwaterModelInput = {
      ...createDefaultModelInput(),
      wells: [{ row: 20, column: 20, rateCubicMetersPerDay: 25 }],
    };
    const at100 = withRiverHead(base, 100);
    const at80 = withRiverHead(base, 80);
    const drawdownAt100 = calculateDrawdown(
      solveGroundwater(withoutPumping(at100)).headsMeters,
      solveGroundwater(at100).headsMeters,
    );
    const drawdownAt80 = calculateDrawdown(
      solveGroundwater(withoutPumping(at80)).headsMeters,
      solveGroundwater(at80).headsMeters,
    );

    for (let row = 0; row < drawdownAt100.drawdownMeters.length; row += 1) {
      for (let column = 0; column < drawdownAt100.drawdownMeters[row].length; column += 1) {
        expect(drawdownAt80.drawdownMeters[row][column]).toBeCloseTo(
          drawdownAt100.drawdownMeters[row][column],
          7,
        );
      }
    }
  }, 20_000);
});
