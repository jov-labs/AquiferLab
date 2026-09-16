import { describe, expect, it } from "vitest";

import {
  createDefaultModelInput,
  type GroundwaterModelInput,
} from "./groundwater.js";
import { validateStationaryModel } from "./stationary-validity.js";

function model(overrides: Partial<GroundwaterModelInput> = {}): GroundwaterModelInput {
  return { ...createDefaultModelInput(), ...overrides };
}

describe("minimum steady-state model validation", () => {
  it("considers the default model valid", () => {
    expect(validateStationaryModel(createDefaultModelInput())).toEqual({
      valid: true,
      code: "VALID",
    });
  });

  it.each([
    ["without wells or recharge", { rechargeMetersPerDay: 0, wells: [] }],
    ["with positive recharge", { rechargeMetersPerDay: 1, wells: [] }],
    ["with pumping", { rechargeMetersPerDay: 0, wells: [{ row: 20, column: 20, rateCubicMetersPerDay: 1 }] }],
    [
      "with balanced recharge and extraction",
      { rechargeMetersPerDay: 1, wells: [{ row: 20, column: 20, rateCubicMetersPerDay: 1 }] },
    ],
  ])("rejects a model without a hydraulic reference (%s)", (_description, overrides) => {
    expect(
      validateStationaryModel(model({ ...overrides, fixedHeadCells: [] })),
    ).toEqual({ valid: false, code: "MISSING_HYDRAULIC_REFERENCE" });
  });

  it("rejects a fixed head outside the grid", () => {
    expect(
      validateStationaryModel(
        model({ fixedHeadCells: [{ row: 41, column: 0, headMeters: 100 }] }),
      ),
    ).toEqual({ valid: false, code: "INVALID_FIXED_HEAD" });
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "rejects a non-finite fixed head (%s)",
    (headMeters) => {
      expect(
        validateStationaryModel(
          model({ fixedHeadCells: [{ row: 0, column: 0, headMeters }] }),
        ),
      ).toEqual({ valid: false, code: "INVALID_FIXED_HEAD" });
    },
  );

  it("rejects a well on a fixed-head cell", () => {
    expect(
      validateStationaryModel(
        model({ wells: [{ row: 20, column: 0, rateCubicMetersPerDay: 1 }] }),
      ),
    ).toEqual({ valid: false, code: "WELL_ON_FIXED_HEAD" });
  });

  it("accepts a valid internal fixed head", () => {
    expect(
      validateStationaryModel(
        model({ fixedHeadCells: [{ row: 20, column: 20, headMeters: 100 }] }),
      ),
    ).toEqual({ valid: true, code: "VALID" });
  });

  it("accepts multiple fixed heads with different values", () => {
    expect(
      validateStationaryModel(
        model({
          fixedHeadCells: [
            { row: 0, column: 0, headMeters: 90 },
            { row: 1, column: 1, headMeters: 105 },
          ],
        }),
      ),
    ).toEqual({ valid: true, code: "VALID" });
  });

  it("does not mutate the input", () => {
    const input = model({
      fixedHeadCells: [
        { row: 0, column: 0, headMeters: 90 },
        { row: 1, column: 1, headMeters: 105 },
      ],
      wells: [{ row: 20, column: 20, rateCubicMetersPerDay: 1 }],
    });
    const before = structuredClone(input);

    validateStationaryModel(input);

    expect(input).toEqual(before);
  });
});
