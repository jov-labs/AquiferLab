import { describe, expect, it } from "vitest";

import {
  createDefaultModelInput,
  litersPerSecondToCubicMetersPerDay,
  metersPerSecondToMetersPerDay,
  millimetersPerYearToMetersPerDay,
} from "./groundwater.js";
import { projectModelInputToControlValues } from "./model-input-controls.js";

describe("proyección de GroundwaterModelInput a controles principales", () => {
  it("convierte K de m/día al exponente mostrado en m/s", () => {
    const values = projectModelInputToControlValues({
      ...createDefaultModelInput(),
      hydraulicConductivityMetersPerDay: metersPerSecondToMetersPerDay(1e-5),
    });

    expect(values.hydraulicConductivityExponent).toBeCloseTo(-5);
  });

  it("convierte recarga y caudales a las unidades de los controles", () => {
    const values = projectModelInputToControlValues({
      ...createDefaultModelInput(),
      rechargeMetersPerDay: millimetersPerYearToMetersPerDay(125),
      wells: [
        { row: 20, column: 20, rateCubicMetersPerDay: litersPerSecondToCubicMetersPerDay(15) },
        { row: 28, column: 30, rateCubicMetersPerDay: litersPerSecondToCubicMetersPerDay(22) },
      ],
    });

    expect(values.rechargeMillimetersPerYear).toBeCloseTo(125);
    expect(values.wellARateLitersPerSecond).toBeCloseTo(15);
    expect(values.wellBRateLitersPerSecond).toBeCloseTo(22);
  });

  it("conserva espesor y carga de referencia en metros", () => {
    const values = projectModelInputToControlValues({
      ...createDefaultModelInput(),
      thicknessMeters: 35,
      fixedHeadCells: [
        { row: 0, column: 0, headMeters: 107 },
        { row: 1, column: 0, headMeters: 107 },
      ],
    });

    expect(values.aquiferThicknessMeters).toBe(35);
    expect(values.referenceHeadMeters).toBe(107);
  });

  it("no muta el input fuente", () => {
    const input = {
      ...createDefaultModelInput(),
      wells: [{ row: 20, column: 20, rateCubicMetersPerDay: 12 }],
    };
    const before = structuredClone(input);

    projectModelInputToControlValues(input);

    expect(input).toEqual(before);
  });

  it("rechaza cargas fijas con valores distintos porque no hay un control equivalente", () => {
    expect(() =>
      projectModelInputToControlValues({
        ...createDefaultModelInput(),
        fixedHeadCells: [
          { row: 0, column: 0, headMeters: 100 },
          { row: 1, column: 0, headMeters: 101 },
        ],
      }),
    ).toThrow("carga fija uniforme");
  });
});
