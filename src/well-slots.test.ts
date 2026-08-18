import { describe, expect, it } from "vitest";

import {
  createDefaultModelInput,
  type ExtractionWell,
  type GroundwaterModelInput,
} from "./groundwater.js";
import { getWellSlots } from "./well-slots.js";

const wellA: ExtractionWell = { row: 12, column: 7, rateCubicMetersPerDay: 18 };
const wellB: ExtractionWell = { row: 30, column: 25, rateCubicMetersPerDay: 42 };

function inputWithWells(wells: readonly ExtractionWell[]): GroundwaterModelInput {
  return { ...createDefaultModelInput(), wells };
}

describe("slots A/B de pozos visibles", () => {
  it("asocia wells[0] con A y wells[1] con B sin copiarlos", () => {
    const slots = getWellSlots(inputWithWells([wellA, wellB]));

    expect(slots.a).toBe(wellA);
    expect(slots.b).toBe(wellB);
    expect(slots.a).toEqual({ row: 12, column: 7, rateCubicMetersPerDay: 18 });
    expect(slots.b).toEqual({ row: 30, column: 25, rateCubicMetersPerDay: 42 });
  });

  it("no modifica el input ni sus pozos", () => {
    const input = inputWithWells([wellA, wellB]);
    const before = structuredClone(input);

    getWellSlots(input);

    expect(input).toEqual(before);
  });

  it("mantiene A y B distintos aunque compartan celda", () => {
    const sharedCellA: ExtractionWell = { row: 15, column: 18, rateCubicMetersPerDay: 10 };
    const sharedCellB: ExtractionWell = { row: 15, column: 18, rateCubicMetersPerDay: 25 };
    const slots = getWellSlots(inputWithWells([sharedCellA, sharedCellB]));

    expect(slots.a).toBe(sharedCellA);
    expect(slots.b).toBe(sharedCellB);
    expect(slots.a).not.toBe(slots.b);
  });

  it("intercambia los slots al intercambiar el orden de wells", () => {
    const slots = getWellSlots(inputWithWells([wellB, wellA]));

    expect(slots.a).toBe(wellB);
    expect(slots.b).toBe(wellA);
  });

  it.each([
    ["cero", []],
    ["uno", [wellA]],
    ["tres", [wellA, wellB, { row: 35, column: 10, rateCubicMetersPerDay: 5 }]],
  ] as const)("rechaza %s pozos", (_description, wells) => {
    expect(() => getWellSlots(inputWithWells(wells))).toThrow(
      "La simulación visible requiere exactamente dos pozos.",
    );
  });
});
