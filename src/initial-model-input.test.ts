import { describe, expect, it } from "vitest";

import {
  createDefaultModelInput,
  metersPerSecondToMetersPerDay,
  millimetersPerYearToMetersPerDay,
  solveGroundwater,
} from "./groundwater.js";
import {
  INITIAL_WELL_A,
  INITIAL_WELL_B,
  createInitialModelInput,
} from "./initial-model-input.js";
import { buildModelInput } from "./scenario-execution.js";
import { createInitialScenarioTableState } from "./scenario-table.js";

describe("visible initial hydraulic input", () => {
  it("reproduces historical defaults and materializes A/B wells without reading the DOM", () => {
    const defaults = createDefaultModelInput();
    const input = createInitialModelInput();

    expect(input.widthMeters).toBe(defaults.widthMeters);
    expect(input.heightMeters).toBe(defaults.heightMeters);
    expect(input.rows).toBe(defaults.rows);
    expect(input.columns).toBe(defaults.columns);
    expect(input.hydraulicConductivityMetersPerDay).toBeCloseTo(
      metersPerSecondToMetersPerDay(1e-4),
    );
    expect(input.rechargeMetersPerDay).toBeCloseTo(millimetersPerYearToMetersPerDay(120));
    expect(input.thicknessMeters).toBe(20);
    expect(input.tolerance).toBe(defaults.tolerance);
    expect(input.maxIterations).toBe(defaults.maxIterations);
    expect(input.fixedHeadCells).toEqual(defaults.fixedHeadCells);
    expect(input.fixedHeadCells).toHaveLength(41);
    expect(input.fixedHeadCells.every((cell) => cell.column === 0 && cell.headMeters === 100)).toBe(true);
    expect(input.wells).toEqual([INITIAL_WELL_A, INITIAL_WELL_B]);
  });

  it("creates equivalent runnable initial scenarios and preserves the historical solution", () => {
    const initialInput = createInitialModelInput();
    const [activeScenario] = createInitialScenarioTableState(initialInput).scenarios;
    const input = buildModelInput(activeScenario);
    const result = solveGroundwater(input);

    expect(input).toEqual(initialInput);
    expect(result).toMatchObject({ converged: true, isValid: true, minHeadMeters: 100 });
    expect(result.maxHeadMeters).toBeGreaterThan(100);
  });
});
