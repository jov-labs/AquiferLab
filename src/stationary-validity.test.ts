import { describe, expect, it } from "vitest";

import {
  createDefaultModelInput,
  type GroundwaterModelInput,
} from "./groundwater.js";
import { validateStationaryModel } from "./stationary-validity.js";

function model(overrides: Partial<GroundwaterModelInput> = {}): GroundwaterModelInput {
  return { ...createDefaultModelInput(), ...overrides };
}

describe("validación mínima de modelos estacionarios", () => {
  it("considera válido el modelo predeterminado", () => {
    expect(validateStationaryModel(createDefaultModelInput())).toEqual({
      valid: true,
      code: "VALID",
    });
  });

  it.each([
    ["sin pozos y sin recarga", { rechargeMetersPerDay: 0, wells: [] }],
    ["con recarga positiva", { rechargeMetersPerDay: 1, wells: [] }],
    ["con bombeo", { rechargeMetersPerDay: 0, wells: [{ row: 20, column: 20, rateCubicMetersPerDay: 1 }] }],
    [
      "con recarga y extracción compensadas",
      { rechargeMetersPerDay: 1, wells: [{ row: 20, column: 20, rateCubicMetersPerDay: 1 }] },
    ],
  ])("rechaza un modelo sin referencia hidráulica (%s)", (_description, overrides) => {
    expect(
      validateStationaryModel(model({ ...overrides, fixedHeadCells: [] })),
    ).toEqual({ valid: false, code: "MISSING_HYDRAULIC_REFERENCE" });
  });

  it("rechaza una carga fija fuera de la malla", () => {
    expect(
      validateStationaryModel(
        model({ fixedHeadCells: [{ row: 41, column: 0, headMeters: 100 }] }),
      ),
    ).toEqual({ valid: false, code: "INVALID_FIXED_HEAD" });
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "rechaza una carga fija no finita (%s)",
    (headMeters) => {
      expect(
        validateStationaryModel(
          model({ fixedHeadCells: [{ row: 0, column: 0, headMeters }] }),
        ),
      ).toEqual({ valid: false, code: "INVALID_FIXED_HEAD" });
    },
  );

  it("rechaza un pozo sobre una carga fija", () => {
    expect(
      validateStationaryModel(
        model({ wells: [{ row: 20, column: 0, rateCubicMetersPerDay: 1 }] }),
      ),
    ).toEqual({ valid: false, code: "WELL_ON_FIXED_HEAD" });
  });

  it("acepta una carga fija interna válida", () => {
    expect(
      validateStationaryModel(
        model({ fixedHeadCells: [{ row: 20, column: 20, headMeters: 100 }] }),
      ),
    ).toEqual({ valid: true, code: "VALID" });
  });

  it("acepta múltiples cargas fijas con valores distintos", () => {
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

  it("no muta la entrada", () => {
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
