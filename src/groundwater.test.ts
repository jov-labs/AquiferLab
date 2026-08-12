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

describe("conversiones centralizadas", () => {
  it("convierte K de m/s a m/día", () => {
    expect(metersPerSecondToMetersPerDay(1e-5)).toBeCloseTo(0.864, 12);
  });

  it("convierte recarga de mm/año a m/día", () => {
    expect(millimetersPerYearToMetersPerDay(365)).toBeCloseTo(0.001, 12);
  });

  it("convierte bombeo de L/s a m³/día", () => {
    expect(litersPerSecondToCubicMetersPerDay(1)).toBeCloseTo(86.4, 12);
  });

  it("compone correctamente la conversión inversa de K", () => {
    const metersPerDay = 0.864;
    expect(metersPerSecondToMetersPerDay(metersPerDayToMetersPerSecond(metersPerDay))).toBeCloseTo(
      metersPerDay,
      12,
    );
  });

  it("compone correctamente la conversión inversa de recarga", () => {
    const metersPerDay = 120 / 1_000 / 365;
    expect(millimetersPerYearToMetersPerDay(metersPerDayToMillimetersPerYear(metersPerDay))).toBeCloseTo(
      metersPerDay,
      16,
    );
  });
});

describe("validación del modelo", () => {
  it("rechaza K menor o igual que cero", () => {
    expect(() =>
      solveGroundwater({ ...testModel(), hydraulicConductivityMetersPerDay: 0 }),
    ).toThrow(/K/);
  });

  it("rechaza espesor menor o igual que cero", () => {
    expect(() => solveGroundwater({ ...testModel(), thicknessMeters: 0 })).toThrow(
      /espesor/,
    );
  });

  it("rechaza dimensiones de malla inválidas", () => {
    expect(() => solveGroundwater({ ...testModel(), rows: 1 })).toThrow(/filas/);
    expect(() => solveGroundwater({ ...testModel(), columns: 2.5 })).toThrow(/columnas/);
  });

  it("rechaza un pozo situado en una celda de carga fija", () => {
    expect(() =>
      solveGroundwater({
        ...testModel(),
        wells: [{ row: 20, column: 0, rateCubicMetersPerDay: 25 }],
      }),
    ).toThrow(/carga fija/);
  });
});

describe("solver de flujo confinado", () => {
  it("mantiene exactamente las cargas prescritas del río", () => {
    const model = testModel();
    const result = solveGroundwater(model);

    for (const cell of model.fixedHeadCells) {
      expect(result.headsMeters[cell.row][cell.column]).toBe(cell.headMeters);
    }
  });

  it("reproduce el benchmark 1D de recarga con río y límite de no flujo", () => {
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

    // La carga fija está en el centro de la primera celda (x = dx/2) y la
    // cara exterior de la última celda está en x = L con flujo nulo. Para
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

  it("no crea un cono artificial para un pozo inactivo", () => {
    const base = testModel();
    const withoutWell = solveGroundwater(base);
    const inactiveWell = solveGroundwater({
      ...base,
      wells: [{ row: 20, column: 20, rateCubicMetersPerDay: 0 }],
    });

    // Hay recarga y un río de carga fija: existe gradiente, pero el pozo a cero
    // no debe modificar ningún nodo respecto al mismo caso sin pozo.
    expect(inactiveWell.headsMeters).toEqual(withoutWell.headsMeters);
  });

  it("incrementar el bombeo aumenta el abatimiento junto al pozo", () => {
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

  it("converge con la configuración por defecto a 50 L/s en el pozo A", () => {
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

  it("es exactamente determinista para entradas idénticas", () => {
    const model: GroundwaterModelInput = {
      ...testModel(),
      wells: [{ row: 20, column: 20, rateCubicMetersPerDay: 25 }],
    };

    expect(solveGroundwater(model)).toEqual(solveGroundwater(model));
  });

  it("reporta no convergencia cuando el máximo de iteraciones es insuficiente", () => {
    const result = solveGroundwater({
      ...testModel(),
      tolerance: 1e-16,
      maxIterations: 1,
    });

    expect(result.converged).toBe(false);
    expect(result.isValid).toBe(false);
    expect(result.iterations).toBe(1);
  });

  it("no contiene NaN ni Infinity en un resultado convergente", () => {
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
