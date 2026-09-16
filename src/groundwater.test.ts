import { describe, expect, it } from "vitest";

import {
  createDefaultModelInput,
  litersPerSecondToCubicMetersPerDay,
  metersPerDayToMetersPerSecond,
  metersPerDayToMillimetersPerYear,
  metersPerSecondToMetersPerDay,
  millimetersPerYearToMetersPerDay,
  solveGroundwater,
  type GroundwaterModelInput,
} from "./groundwater.js";

function testModel(): GroundwaterModelInput {
  return {
    ...createDefaultModelInput(),
    tolerance: 1e-8,
    maxIterations: 20_000,
  };
}

describe("centralized conversions", () => {
  it("converts K from m/s to m/day", () => {
    expect(metersPerSecondToMetersPerDay(1e-5)).toBeCloseTo(0.864, 12);
  });

  it("converts recharge from mm/year to m/day", () => {
    expect(millimetersPerYearToMetersPerDay(365)).toBeCloseTo(0.001, 12);
  });

  it("converts pumping from L/s to m³/day", () => {
    expect(litersPerSecondToCubicMetersPerDay(1)).toBeCloseTo(86.4, 12);
  });

  it("correctly composes the inverse K conversion", () => {
    const metersPerDay = 0.864;
    expect(metersPerSecondToMetersPerDay(metersPerDayToMetersPerSecond(metersPerDay))).toBeCloseTo(
      metersPerDay,
      12,
    );
  });

  it("correctly composes the inverse recharge conversion", () => {
    const metersPerDay = 120 / 1_000 / 365;
    expect(millimetersPerYearToMetersPerDay(metersPerDayToMillimetersPerYear(metersPerDay))).toBeCloseTo(
      metersPerDay,
      16,
    );
  });
});

describe("model validation", () => {
  it("rejects a model without fixed head and diagnoses the missing hydraulic reference", () => {
    let error: unknown;
    try {
      solveGroundwater({ ...testModel(), fixedHeadCells: [] });
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe(
      "At least one fixed-head cell is required to define a hydraulic reference.",
    );
    expect((error as Error).message).not.toMatch(/river/i);
  });

  it("preserves the 41 default fixed heads in column zero", () => {
    const model = createDefaultModelInput();

    expect(model.fixedHeadCells).toHaveLength(41);
    expect(model.fixedHeadCells.every((cell) => cell.column === 0)).toBe(true);
  });

  it("rejects K less than or equal to zero", () => {
    expect(() =>
      solveGroundwater({ ...testModel(), hydraulicConductivityMetersPerDay: 0 }),
    ).toThrow(/K/);
  });

  it("rejects thickness less than or equal to zero", () => {
    expect(() => solveGroundwater({ ...testModel(), thicknessMeters: 0 })).toThrow(
      /Thickness/,
    );
  });

  it("rejects invalid grid dimensions", () => {
    expect(() => solveGroundwater({ ...testModel(), rows: 1 })).toThrow(/Row count/);
    expect(() => solveGroundwater({ ...testModel(), columns: 2.5 })).toThrow(/Column count/);
  });

  it("rejects a well located in a fixed-head cell", () => {
    expect(() =>
      solveGroundwater({
        ...testModel(),
        wells: [{ row: 20, column: 0, rateCubicMetersPerDay: 25 }],
      }),
    ).toThrow(/fixed-head cell/);
  });

  it("rejects Dirichlet cells outside the grid dimensions", () => {
    expect(() =>
      solveGroundwater({
        ...testModel(),
        fixedHeadCells: [{ row: 41, column: 0, headMeters: 100 }],
      }),
    ).toThrow(/outside the grid/);
  });

  it("rejects NaN or infinite Dirichlet heads", () => {
    for (const headMeters of [Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() =>
        solveGroundwater({
          ...testModel(),
          fixedHeadCells: [{ row: 0, column: 0, headMeters }],
        }),
      ).toThrow(/finite number/);
    }
  });
});

describe("confined flow solver", () => {
  it("preserves the prescribed heads exactly", () => {
    const model = testModel();
    const result = solveGroundwater(model);

    for (const cell of model.fixedHeadCells) {
      expect(result.headsMeters[cell.row][cell.column]).toBe(cell.headMeters);
    }
  });

  it("preserves a spatial Dirichlet field with different heads", () => {
    const model: GroundwaterModelInput = {
      ...testModel(),
      fixedHeadCells: [
        { row: 0, column: 0, headMeters: 91 },
        { row: 0, column: 1, headMeters: 97.5 },
        { row: 1, column: 0, headMeters: 104 },
      ],
      wells: [],
    };
    const before = structuredClone(model);
    const result = solveGroundwater(model);

    for (const cell of model.fixedHeadCells) {
      expect(result.headsMeters[cell.row][cell.column]).toBe(cell.headMeters);
    }
    expect(model).toEqual(before);
  });

  it("reproduces the 1D recharge benchmark with fixed head and a no-flow boundary", () => {
    const widthMeters = 1_000;
    const columns = 11;
    const rows = 5;
    const fixedHeadMeters = 50;
    const rechargeMetersPerDay = 0.001;
    const hydraulicConductivityMetersPerDay = 2;
    const thicknessMeters = 10;
    const model: GroundwaterModelInput = {
      widthMeters,
      heightMeters: 500,
      rows,
      columns,
      hydraulicConductivityMetersPerDay,
      thicknessMeters,
      rechargeMetersPerDay,
      fixedHeadCells: Array.from({ length: rows }, (_, row) => ({
        row,
        column: 0,
        headMeters: fixedHeadMeters,
      })),
      wells: [],
      tolerance: 1e-11,
      maxIterations: 20_000,
    };
    const result = solveGroundwater(model);
    const dx = widthMeters / columns;
    const fixedHeadCenterX = dx / 2;
    const transmissivity = hydraulicConductivityMetersPerDay * thicknessMeters;
    const representativeRow = 2;
    let maximumErrorMeters = 0;

    // The fixed head is at the center of the first cell (x = dx/2), and the
    // outer face of the last cell is at x = L with zero flow. For
    // T h'' + R = 0: h(x) = hD + (R/T)[(L-xD)(x-xD) - (x-xD)²/2].
    for (let column = 0; column < columns; column += 1) {
      const x = (column + 0.5) * dx;
      const distanceFromFixedHead = x - fixedHeadCenterX;
      const expectedHead =
        fixedHeadMeters +
        (rechargeMetersPerDay / transmissivity) *
          ((widthMeters - fixedHeadCenterX) * distanceFromFixedHead -
            (distanceFromFixedHead * distanceFromFixedHead) / 2);
      const errorMeters = Math.abs(result.headsMeters[representativeRow][column] - expectedHead);
      maximumErrorMeters = Math.max(maximumErrorMeters, errorMeters);
    }

    expect(result.converged).toBe(true);
    expect(maximumErrorMeters).toBeLessThanOrEqual(2e-7);
  });

  it("does not create an artificial cone for an inactive well", () => {
    const base = testModel();
    const withoutWell = solveGroundwater(base);
    const inactiveWell = solveGroundwater({
      ...base,
      wells: [{ row: 20, column: 20, rateCubicMetersPerDay: 0 }],
    });

    // Recharge and a fixed head create a gradient, but a zero-rate well
    // must not modify any node relative to the same case without a well.
    expect(inactiveWell.headsMeters).toEqual(withoutWell.headsMeters);
  });

  it("increasing pumping increases drawdown next to the well", () => {
    const base = testModel();
    const noPumping = solveGroundwater({
      ...base,
      wells: [{ row: 20, column: 20, rateCubicMetersPerDay: 0 }],
    });
    const pumping = solveGroundwater({
      ...base,
      wells: [{ row: 20, column: 20, rateCubicMetersPerDay: 25 }],
    });

    expect(pumping.converged).toBe(true);
    expect(pumping.headsMeters[20][20]).toBeLessThan(noPumping.headsMeters[20][20]);
  });

  it("converges with the default configuration at 50 L/s in well A", () => {
    const result = solveGroundwater({
      ...createDefaultModelInput(),
      wells: [
        {
          row: 20,
          column: 20,
          rateCubicMetersPerDay: litersPerSecondToCubicMetersPerDay(50),
        },
      ],
    });

    expect(result.converged).toBe(true);
    expect(result.isValid).toBe(true);
    expect(result.iterations).toBeLessThanOrEqual(20_000);
    expect(result.residualMeters).toBeLessThanOrEqual(1e-6);
    for (const row of result.headsMeters) {
      for (const head of row) {
        expect(Number.isFinite(head)).toBe(true);
      }
    }
  });

  it("is exactly deterministic for identical inputs", () => {
    const model: GroundwaterModelInput = {
      ...testModel(),
      wells: [{ row: 20, column: 20, rateCubicMetersPerDay: 25 }],
    };

    expect(solveGroundwater(model)).toEqual(solveGroundwater(model));
  });

  it("reports non-convergence when the maximum iteration count is insufficient", () => {
    const result = solveGroundwater({
      ...testModel(),
      tolerance: 1e-16,
      maxIterations: 1,
    });

    expect(result.converged).toBe(false);
    expect(result.isValid).toBe(false);
    expect(result.iterations).toBe(1);
  });

  it("contains no NaN or Infinity values in a converged result", () => {
    const result = solveGroundwater({
      ...testModel(),
      wells: [{ row: 20, column: 20, rateCubicMetersPerDay: 25 }],
    });

    expect(result.converged).toBe(true);
    for (const row of result.headsMeters) {
      for (const head of row) {
        expect(Number.isFinite(head)).toBe(true);
      }
    }
  });
});
