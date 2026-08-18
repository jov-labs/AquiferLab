import { describe, expect, it } from "vitest";

import {
  createDefaultModelInput,
  type ExtractionWell,
  type GroundwaterModelInput,
} from "./groundwater.js";
import { calculateCellToWellHeadLossMeters } from "./well-correction.js";
import {
  calculateEstimatedWellMetrics,
  readWellCellMetrics,
} from "./well-metrics.js";

function matrix(valueAt: (row: number, column: number) => number): number[][] {
  return Array.from({ length: 41 }, (_, row) =>
    Array.from({ length: 41 }, (_, column) => valueAt(row, column)),
  );
}

function inputWithWells(a: ExtractionWell, b: ExtractionWell): GroundwaterModelInput {
  return { ...createDefaultModelInput(), wells: [a, b] };
}

function correctionLoss(
  input: GroundwaterModelInput,
  well: ExtractionWell,
  radiusMeters: number,
): number {
  return calculateCellToWellHeadLossMeters({
    cellWidthMeters: input.widthMeters / input.columns,
    cellHeightMeters: input.heightMeters / input.rows,
    hydraulicConductivityMetersPerDay: input.hydraulicConductivityMetersPerDay,
    thicknessMeters: input.thicknessMeters,
    extractionRateCubicMetersPerDay: well.rateCubicMetersPerDay,
    wellRadiusMeters: radiusMeters,
  });
}

describe("métricas de pozos del input ejecutado", () => {
  const headsMeters = matrix((row, column) => row * 100 + column);
  const drawdownMeters = matrix((row, column) => row + column / 100);

  it("lee la carga y el abatimiento de A desde su celda desplazada", () => {
    const input = inputWithWells(
      { row: 3, column: 4, rateCubicMetersPerDay: 120 },
      { row: 28, column: 30, rateCubicMetersPerDay: 0 },
    );
    const metrics = readWellCellMetrics(input, headsMeters, drawdownMeters);

    expect(metrics.a).toEqual({ headMeters: 304, drawdownMeters: 3.04 });
    expect(metrics.a.headMeters).not.toBe(headsMeters[20][20]);
  });

  it("lee la carga y el abatimiento de B desde su celda desplazada", () => {
    const input = inputWithWells(
      { row: 20, column: 20, rateCubicMetersPerDay: 0 },
      { row: 7, column: 9, rateCubicMetersPerDay: 60 },
    );
    const metrics = readWellCellMetrics(input, headsMeters, drawdownMeters);

    expect(metrics.b).toEqual({ headMeters: 709, drawdownMeters: 7.09 });
    expect(metrics.b.headMeters).not.toBe(headsMeters[28][30]);
  });

  it("corrige cada slot con su propio caudal, celda y radio", () => {
    const wellA = { row: 3, column: 4, rateCubicMetersPerDay: 120 };
    const wellB = { row: 7, column: 9, rateCubicMetersPerDay: 40 };
    const input = inputWithWells(wellA, wellB);
    const metrics = calculateEstimatedWellMetrics(input, headsMeters, drawdownMeters, {
      a: 0.1,
      b: 0.4,
    });
    const lossA = correctionLoss(input, wellA, 0.1);
    const lossB = correctionLoss(input, wellB, 0.4);

    expect(metrics.heads.wellA).toBeCloseTo(304 - lossA);
    expect(metrics.drawdowns.wellA).toBeCloseTo(3.04 + lossA);
    expect(metrics.heads.wellB).toBeCloseTo(709 - lossB);
    expect(metrics.drawdowns.wellB).toBeCloseTo(7.09 + lossB);
  });

  it("intercambia semánticamente A/B al intercambiar wells", () => {
    const wellA = { row: 3, column: 4, rateCubicMetersPerDay: 120 };
    const wellB = { row: 7, column: 9, rateCubicMetersPerDay: 40 };
    const metrics = readWellCellMetrics(
      inputWithWells(wellB, wellA),
      headsMeters,
      drawdownMeters,
    );

    expect(metrics.a).toEqual({ headMeters: 709, drawdownMeters: 7.09 });
    expect(metrics.b).toEqual({ headMeters: 304, drawdownMeters: 3.04 });
  });

  it("conserva las métricas históricas cuando las posiciones históricas se mantienen", () => {
    const input = inputWithWells(
      { row: 20, column: 20, rateCubicMetersPerDay: 10 },
      { row: 28, column: 30, rateCubicMetersPerDay: 20 },
    );

    expect(readWellCellMetrics(input, headsMeters, drawdownMeters)).toEqual({
      a: { headMeters: headsMeters[20][20], drawdownMeters: drawdownMeters[20][20] },
      b: { headMeters: headsMeters[28][30], drawdownMeters: drawdownMeters[28][30] },
    });
  });

  it("no modifica el input fuente", () => {
    const input = inputWithWells(
      { row: 3, column: 4, rateCubicMetersPerDay: 120 },
      { row: 7, column: 9, rateCubicMetersPerDay: 40 },
    );
    const before = structuredClone(input);

    calculateEstimatedWellMetrics(input, headsMeters, drawdownMeters, { a: 0.1, b: 0.4 });

    expect(input).toEqual(before);
  });
});
