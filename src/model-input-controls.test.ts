import { describe, expect, it } from "vitest";

import {
  createDefaultModelInput,
  litersPerSecondToCubicMetersPerDay,
  metersPerSecondToMetersPerDay,
  millimetersPerYearToMetersPerDay,
} from "./groundwater.js";
import { projectModelInputToControlValues } from "./model-input-controls.js";

describe("GroundwaterModelInput projection to main controls", () => {
  it("converts K from m/day to the displayed exponent in m/s", () => {
    const values = projectModelInputToControlValues({
      ...createDefaultModelInput(),
      hydraulicConductivityMetersPerDay: metersPerSecondToMetersPerDay(1e-5),
    });

    expect(values.hydraulicConductivityExponent).toBeCloseTo(-5);
  });

  it("converts recharge and rates to control units", () => {
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

  it("preserves thickness and reference head in metres", () => {
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

  it("does not mutate the source input", () => {
    const input = {
      ...createDefaultModelInput(),
      wells: [{ row: 20, column: 20, rateCubicMetersPerDay: 12 }],
    };
    const before = structuredClone(input);

    projectModelInputToControlValues(input);

    expect(input).toEqual(before);
  });

  it("rejects fixed heads with different values because no equivalent control exists", () => {
    expect(() =>
      projectModelInputToControlValues({
        ...createDefaultModelInput(),
        fixedHeadCells: [
          { row: 0, column: 0, headMeters: 100 },
          { row: 1, column: 0, headMeters: 101 },
        ],
      }),
    ).toThrow("uniform fixed head");
  });
});
