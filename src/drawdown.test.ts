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

describe("cálculo puro de abatimiento", () => {
  it("devuelve cero para matrices idénticas", () => {
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

  it("calcula 10 m para referencia 100 y actual 90", () => {
    const result = calculateDrawdown([[100]], [[90]]);

    expect(result.drawdownMeters).toEqual([[10]]);
    expect(result.maxDrawdownMeters).toBe(10);
  });

  it("calcula diferencias y máximo para una matriz variable", () => {
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

  it("preserva abatimiento negativo sin clamping", () => {
    const result = calculateDrawdown([[90]], [[100]]);

    expect(result.drawdownMeters).toEqual([[-10]]);
    expect(result.maxDrawdownMeters).toBe(-10);
  });

  it("rechaza dimensiones incompatibles", () => {
    expect(() => calculateDrawdown([[100, 100]], [[100], [100]])).toThrow(/dimensiones/);
  });

  it("rechaza matrices no rectangulares", () => {
    expect(() => calculateDrawdown([[100], [100, 100]], [[100], [100]])).toThrow(
      /rectangular/,
    );
  });

  it("rechaza matrices vacías", () => {
    expect(() => calculateDrawdown([], [])).toThrow(/vacía/);
  });

  it("rechaza NaN", () => {
    expect(() => calculateDrawdown([[Number.NaN]], [[100]])).toThrow(/finitos/);
  });

  it("rechaza Infinity", () => {
    expect(() => calculateDrawdown([[100]], [[Number.POSITIVE_INFINITY]])).toThrow(
      /finitos/,
    );
  });

  it("no modifica las matrices de entrada", () => {
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

describe("abatimiento con el modelo estacionario", () => {
  it("es aproximadamente nulo en el escenario real sin bombeo", () => {
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

  it("produce abatimiento positivo cerca de un pozo de extracción real", () => {
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

  it("mantiene el abatimiento al trasladar la carga prescrita del río", () => {
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
