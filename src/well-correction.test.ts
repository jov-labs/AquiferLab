import { describe, expect, it } from "vitest";

import { calculateDrawdown } from "./drawdown.js";
import {
  createDefaultModelInput,
  litersPerSecondToCubicMetersPerDay,
  solveGroundwater,
} from "./groundwater.js";
import {
  calculateCellToWellHeadLossMeters,
  calculatePeacemanEquivalentRadiusMeters,
  estimateWellDrawdownMeters,
  estimateWellHeadMeters,
  type WellCorrectionParameters,
} from "./well-correction.js";

function validParameters(
  overrides: Partial<WellCorrectionParameters> = {},
): WellCorrectionParameters {
  return {
    cellWidthMeters: 2_000 / 41,
    cellHeightMeters: 2_000 / 41,
    hydraulicConductivityMetersPerDay: 1,
    thicknessMeters: 10,
    extractionRateCubicMetersPerDay: 100,
    wellRadiusMeters: 0.1,
    ...overrides,
  };
}

describe("corrección de pozo de Peaceman", () => {
  it("calcula el radio equivalente isotrópico", () => {
    expect(calculatePeacemanEquivalentRadiusMeters(10, 20)).toBeCloseTo(
      0.14 * Math.sqrt(10 ** 2 + 20 ** 2),
      12,
    );
  });

  it("reproduce la estabilidad corregida del benchmark 21×21, 41×41 y 81×81", () => {
    const benchmark = [
      { grid: 21, cellHeadMeters: 93.68459601748835, expectedWellHeadMeters: 85.34579078961622 },
      { grid: 41, cellHeadMeters: 92.61949892294881, expectedWellHeadMeters: 85.34551925133775 },
      { grid: 81, cellHeadMeters: 91.53578337274533, expectedWellHeadMeters: 85.3454532430157 },
    ];
    const estimatedHeads = benchmark.map(({ grid, cellHeadMeters, expectedWellHeadMeters }) => {
      const estimatedHead = estimateWellHeadMeters(
        cellHeadMeters,
        validParameters({
          cellWidthMeters: 2_000 / grid,
          cellHeightMeters: 2_000 / grid,
        }),
      );
      expect(estimatedHead).toBeCloseTo(expectedWellHeadMeters, 10);
      return estimatedHead;
    });

    expect(Math.max(...estimatedHeads) - Math.min(...estimatedHeads)).toBeLessThan(0.001);
  });

  it("con bombeo cero conserva carga y abatimiento de celda", () => {
    const parameters = validParameters({ extractionRateCubicMetersPerDay: 0 });

    expect(calculateCellToWellHeadLossMeters(parameters)).toBe(0);
    expect(estimateWellHeadMeters(95, parameters)).toBe(95);
    expect(estimateWellDrawdownMeters(5, parameters)).toBe(5);
  });

  it("con bombeo positivo reduce carga y aumenta abatimiento", () => {
    const parameters = validParameters();
    const loss = calculateCellToWellHeadLossMeters(parameters);

    expect(loss).toBeGreaterThan(0);
    expect(estimateWellHeadMeters(95, parameters)).toBeCloseTo(95 - loss, 12);
    expect(estimateWellDrawdownMeters(5, parameters)).toBeCloseTo(5 + loss, 12);
  });

  it("acepta un radio positivo cercano pero menor que el radio equivalente", () => {
    const base = validParameters();
    const equivalentRadius = calculatePeacemanEquivalentRadiusMeters(
      base.cellWidthMeters,
      base.cellHeightMeters,
    );
    const loss = calculateCellToWellHeadLossMeters({
      ...base,
      wellRadiusMeters: equivalentRadius * (1 - 1e-12),
    });

    expect(loss).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(loss)).toBe(true);
  });

  it("rechaza radio cero o radio mayor o igual que re", () => {
    const base = validParameters();
    const equivalentRadius = calculatePeacemanEquivalentRadiusMeters(
      base.cellWidthMeters,
      base.cellHeightMeters,
    );

    expect(() => calculateCellToWellHeadLossMeters({ ...base, wellRadiusMeters: 0 })).toThrow(
      /mayor que cero/,
    );
    expect(() =>
      calculateCellToWellHeadLossMeters({ ...base, wellRadiusMeters: equivalentRadius }),
    ).toThrow(/menor que el radio equivalente/);
    expect(() =>
      calculateCellToWellHeadLossMeters({ ...base, wellRadiusMeters: equivalentRadius + 1 }),
    ).toThrow(/menor que el radio equivalente/);
  });

  it("rechaza K, espesor o bombeo fuera de dominio", () => {
    expect(() =>
      calculateCellToWellHeadLossMeters(validParameters({ hydraulicConductivityMetersPerDay: 0 })),
    ).toThrow(/conductividad/);
    expect(() =>
      calculateCellToWellHeadLossMeters(validParameters({ thicknessMeters: -1 })),
    ).toThrow(/espesor/);
    expect(() =>
      calculateCellToWellHeadLossMeters(
        validParameters({ extractionRateCubicMetersPerDay: -1 }),
      ),
    ).toThrow(/negativo/);
  });

  it("rechaza dimensiones de celda no positivas", () => {
    expect(() =>
      calculateCellToWellHeadLossMeters(validParameters({ cellWidthMeters: 0 })),
    ).toThrow(/Δx/);
    expect(() =>
      calculateCellToWellHeadLossMeters(validParameters({ cellHeightMeters: -1 })),
    ).toThrow(/Δz/);
  });

  it("rechaza NaN e Infinity en todas las entradas", () => {
    const base = validParameters();
    for (const key of Object.keys(base) as (keyof WellCorrectionParameters)[]) {
      for (const invalidValue of [Number.NaN, Number.POSITIVE_INFINITY]) {
        expect(() =>
          calculateCellToWellHeadLossMeters({ ...base, [key]: invalidValue }),
        ).toThrow(/finito/);
      }
    }
    for (const invalidValue of [Number.NaN, Number.NEGATIVE_INFINITY]) {
      expect(() => estimateWellHeadMeters(invalidValue, base)).toThrow(/finito/);
      expect(() => estimateWellDrawdownMeters(invalidValue, base)).toThrow(/finito/);
    }
    expect(() =>
      calculatePeacemanEquivalentRadiusMeters(Number.MAX_VALUE, Number.MAX_VALUE),
    ).toThrow(/finito/);
    expect(() =>
      calculateCellToWellHeadLossMeters(
        validParameters({
          hydraulicConductivityMetersPerDay: Number.MIN_VALUE,
          extractionRateCubicMetersPerDay: Number.MAX_VALUE,
        }),
      ),
    ).toThrow();
  });

  it("no modifica los parámetros recibidos", () => {
    const parameters = validParameters();
    const before = structuredClone(parameters);

    calculateCellToWellHeadLossMeters(parameters);
    estimateWellHeadMeters(95, parameters);
    estimateWellDrawdownMeters(5, parameters);

    expect(parameters).toEqual(before);
  });

  it("corrige dos pozos únicamente con su propio bombeo y radio", () => {
    const wellA = validParameters({ extractionRateCubicMetersPerDay: 200, wellRadiusMeters: 0.1 });
    const wellB = validParameters({ extractionRateCubicMetersPerDay: 50, wellRadiusMeters: 0.4 });
    const lossA = calculateCellToWellHeadLossMeters(wellA);
    const lossB = calculateCellToWellHeadLossMeters(wellB);

    expect(lossA).toBeGreaterThan(lossB);
    expect(estimateWellHeadMeters(90, wellA)).toBeCloseTo(90 - lossA, 12);
    expect(estimateWellHeadMeters(90, wellB)).toBeCloseTo(90 - lossB, 12);
  });

  it("calcula el escenario A=50 L/s, B=0 L/s y rw=0.10 m", () => {
    const base = createDefaultModelInput();
    const actualInput = {
      ...base,
      wells: [
        { row: 20, column: 20, rateCubicMetersPerDay: litersPerSecondToCubicMetersPerDay(50) },
        { row: 28, column: 30, rateCubicMetersPerDay: 0 },
      ],
    };
    const referenceInput = {
      ...actualInput,
      wells: actualInput.wells.map((well) => ({ ...well, rateCubicMetersPerDay: 0 })),
    };
    const reference = solveGroundwater(referenceInput);
    const actual = solveGroundwater(actualInput);
    const drawdown = calculateDrawdown(reference.headsMeters, actual.headsMeters);
    const commonParameters = {
      cellWidthMeters: actualInput.widthMeters / actualInput.columns,
      cellHeightMeters: actualInput.heightMeters / actualInput.rows,
      hydraulicConductivityMetersPerDay: actualInput.hydraulicConductivityMetersPerDay,
      thicknessMeters: actualInput.thicknessMeters,
      wellRadiusMeters: 0.1,
    };
    const parametersA = {
      ...commonParameters,
      extractionRateCubicMetersPerDay: actualInput.wells[0].rateCubicMetersPerDay,
    };
    const parametersB = {
      ...commonParameters,
      extractionRateCubicMetersPerDay: actualInput.wells[1].rateCubicMetersPerDay,
    };
    const scenario = {
      cellHeadA: actual.headsMeters[20][20],
      estimatedHeadA: estimateWellHeadMeters(actual.headsMeters[20][20], parametersA),
      cellDrawdownA: drawdown.drawdownMeters[20][20],
      estimatedDrawdownA: estimateWellDrawdownMeters(
        drawdown.drawdownMeters[20][20],
        parametersA,
      ),
      cellHeadB: actual.headsMeters[28][30],
      estimatedHeadB: estimateWellHeadMeters(actual.headsMeters[28][30], parametersB),
      cellDrawdownB: drawdown.drawdownMeters[28][30],
      estimatedDrawdownB: estimateWellDrawdownMeters(
        drawdown.drawdownMeters[28][30],
        parametersB,
      ),
    };

    expect(reference.converged).toBe(true);
    expect(actual.converged).toBe(true);
    expect(scenario.estimatedHeadA).toBeLessThan(scenario.cellHeadA);
    expect(scenario.estimatedDrawdownA).toBeGreaterThan(scenario.cellDrawdownA);
    expect(scenario.estimatedHeadB).toBe(scenario.cellHeadB);
    expect(scenario.estimatedDrawdownB).toBe(scenario.cellDrawdownB);
    console.log("PEACEMAN_SCENARIO", JSON.stringify(scenario));
  }, 20_000);
});
