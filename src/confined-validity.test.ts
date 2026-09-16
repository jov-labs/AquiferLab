import { describe, expect, it } from "vitest";

import {
  CONFINED_VALIDITY_TOLERANCE_METERS,
  evaluateConfinedModelValidity,
} from "./confined-validity.js";
import {
  litersPerSecondToCubicMetersPerDay,
  solveGroundwater,
  type GroundwaterModelInput,
} from "./groundwater.js";
import { estimateWellHeadMeters } from "./well-correction.js";

const EDUCATIONAL_ROWS = 41;
const EDUCATIONAL_COLUMNS = 41;
const EDUCATIONAL_WIDTH_METERS = 2_000;
const EDUCATIONAL_HEIGHT_METERS = 2_000;
const EDUCATIONAL_K_METERS_PER_DAY = 0.864;
const EDUCATIONAL_THICKNESS_METERS = 20;
const EDUCATIONAL_RECHARGE_METERS_PER_DAY = 120 / 1_000 / 365;
const EDUCATIONAL_RIVER_HEAD_METERS = 100;
const EDUCATIONAL_TOLERANCE = 1e-6;
const EDUCATIONAL_MAX_ITERATIONS = 20_000;
const WELL_A = { row: 20, column: 20 };
const WELL_B = { row: 28, column: 30 };

function fixedEducationalScenario(wellALitersPerSecond: number): GroundwaterModelInput {
  return {
    widthMeters: EDUCATIONAL_WIDTH_METERS,
    heightMeters: EDUCATIONAL_HEIGHT_METERS,
    rows: EDUCATIONAL_ROWS,
    columns: EDUCATIONAL_COLUMNS,
    hydraulicConductivityMetersPerDay: EDUCATIONAL_K_METERS_PER_DAY,
    thicknessMeters: EDUCATIONAL_THICKNESS_METERS,
    rechargeMetersPerDay: EDUCATIONAL_RECHARGE_METERS_PER_DAY,
    fixedHeadCells: Array.from({ length: EDUCATIONAL_ROWS }, (_, row) => ({
      row,
      column: 0,
      headMeters: EDUCATIONAL_RIVER_HEAD_METERS,
    })),
    wells: [
      {
        ...WELL_A,
        rateCubicMetersPerDay: litersPerSecondToCubicMetersPerDay(wellALitersPerSecond),
      },
      { ...WELL_B, rateCubicMetersPerDay: 0 },
    ],
    tolerance: EDUCATIONAL_TOLERANCE,
    maxIterations: EDUCATIONAL_MAX_ITERATIONS,
  };
}

function validityForFixedEducationalScenario(wellALitersPerSecond: number) {
  const input = fixedEducationalScenario(wellALitersPerSecond);
  const solution = solveGroundwater(input);
  const correctionParameters = (rateCubicMetersPerDay: number) => ({
    cellWidthMeters: EDUCATIONAL_WIDTH_METERS / EDUCATIONAL_COLUMNS,
    cellHeightMeters: EDUCATIONAL_HEIGHT_METERS / EDUCATIONAL_ROWS,
    hydraulicConductivityMetersPerDay: EDUCATIONAL_K_METERS_PER_DAY,
    thicknessMeters: EDUCATIONAL_THICKNESS_METERS,
    extractionRateCubicMetersPerDay: rateCubicMetersPerDay,
    wellRadiusMeters: 0.1,
  });
  const validity = evaluateConfinedModelValidity({
    headsMeters: solution.headsMeters,
    aquiferTopElevationMeters: 0,
    estimatedWellHeadsMeters: {
      wellA: estimateWellHeadMeters(
        solution.headsMeters[WELL_A.row][WELL_A.column],
        correctionParameters(input.wells[0].rateCubicMetersPerDay),
      ),
      wellB: estimateWellHeadMeters(
        solution.headsMeters[WELL_B.row][WELL_B.column],
        correctionParameters(0),
      ),
    },
  });
  return { input, solution, validity };
}

describe("confined-model validity", () => {
  it("is valid when all grid heads are above the top", () => {
    const result = evaluateConfinedModelValidity({
      headsMeters: [[1, 2], [3, 4]],
      aquiferTopElevationMeters: 0,
      estimatedWellHeadsMeters: { wellA: 1, wellB: 2 },
    });

    expect(result.level).toBe("valid");
    expect(result.status).toBe("VALID_CONFINED");
    expect(result.minimumGridHeadMeters).toBe(1);
    expect(result.cellsBelowAquiferTop).toBe(0);
    expect(result.percentageCellsBelowAquiferTop).toBe(0);
  });

  it("considers a head exactly equal to the top valid", () => {
    const result = evaluateConfinedModelValidity({
      headsMeters: [[0]],
      aquiferTopElevationMeters: 0,
    });

    expect(result.status).toBe("VALID_CONFINED");
    expect(result.minimumMarginToAquiferTopMeters).toBe(0);
  });

  it("detects a cell below the top", () => {
    const result = evaluateConfinedModelValidity({
      headsMeters: [[1, -0.25], [2, 3]],
      aquiferTopElevationMeters: 0,
    });

    expect(result.status).toBe("OUTSIDE_CONFINED_RANGE");
    expect(result.level).toBe("meshInvalid");
    expect(result.cellsBelowAquiferTop).toBe(1);
  });

  it("calculates percentage and maximum deficit for several cells below the top", () => {
    const result = evaluateConfinedModelValidity({
      headsMeters: [[-2, -1], [0, 3]],
      aquiferTopElevationMeters: 0,
    });

    expect(result.cellsBelowAquiferTop).toBe(2);
    expect(result.percentageCellsBelowAquiferTop).toBe(50);
    expect(result.maximumGridDeficitBelowAquiferTopMeters).toBe(2);
  });

  it("warns when only the estimated well head is below the top", () => {
    const result = evaluateConfinedModelValidity({
      headsMeters: [[2]],
      aquiferTopElevationMeters: 0,
      estimatedWellHeadsMeters: { wellA: -0.5, wellB: 1 },
    });

    expect(result.status).toBe("OUTSIDE_CONFINED_RANGE");
    expect(result.level).toBe("wellDegraded");
    expect(result.cellsBelowAquiferTop).toBe(0);
    expect(result.wellA.status).toBe("OUTSIDE_CONFINED_RANGE");
    expect(result.wellA.deficitBelowAquiferTopMeters).toBe(0.5);
  });

  it("evaluates A and B with different states", () => {
    const result = evaluateConfinedModelValidity({
      headsMeters: [[1]],
      aquiferTopElevationMeters: 0,
      estimatedWellHeadsMeters: { wellA: 0, wellB: -1 },
    });

    expect(result.wellA.status).toBe("VALID_CONFINED");
    expect(result.wellB.status).toBe("OUTSIDE_CONFINED_RANGE");
    expect(result.level).toBe("wellDegraded");
  });

  it("identifies both degraded wells without invalidating the grid", () => {
    const result = evaluateConfinedModelValidity({
      headsMeters: [[1, 2]],
      aquiferTopElevationMeters: 0,
      estimatedWellHeadsMeters: { wellA: -0.1, wellB: -0.2 },
    });

    expect(result.level).toBe("wellDegraded");
    expect(result.cellsBelowAquiferTop).toBe(0);
    expect(result.wellA.status).toBe("OUTSIDE_CONFINED_RANGE");
    expect(result.wellB.status).toBe("OUTSIDE_CONFINED_RANGE");
  });

  it("gives meshInvalid precedence even when both wells are out of range", () => {
    const result = evaluateConfinedModelValidity({
      headsMeters: [[-0.1, 1]],
      aquiferTopElevationMeters: 0,
      estimatedWellHeadsMeters: { wellA: -0.1, wellB: -0.2 },
    });

    expect(result.level).toBe("meshInvalid");
    expect(result.wellA.status).toBe("OUTSIDE_CONFINED_RANGE");
    expect(result.wellB.status).toBe("OUTSIDE_CONFINED_RANGE");
  });

  it("accepts a negative top elevation", () => {
    const result = evaluateConfinedModelValidity({
      headsMeters: [[-4, -3]],
      aquiferTopElevationMeters: -5,
    });

    expect(result.status).toBe("VALID_CONFINED");
    expect(result.level).toBe("valid");
  });

  it("rejects an empty matrix", () => {
    expect(() =>
      evaluateConfinedModelValidity({ headsMeters: [], aquiferTopElevationMeters: 0 }),
    ).toThrow(/non-empty/);
  });

  it("rejects an irregular matrix", () => {
    expect(() =>
      evaluateConfinedModelValidity({ headsMeters: [[1], [1, 2]], aquiferTopElevationMeters: 0 }),
    ).toThrow(/rectangular/);
  });

  it("rejects NaN and Infinity in heads, top, and wells", () => {
    expect(() =>
      evaluateConfinedModelValidity({ headsMeters: [[Number.NaN]], aquiferTopElevationMeters: 0 }),
    ).toThrow(/finite number/);
    expect(() =>
      evaluateConfinedModelValidity({ headsMeters: [[1]], aquiferTopElevationMeters: Infinity }),
    ).toThrow(/finite number/);
    expect(() =>
      evaluateConfinedModelValidity({
        headsMeters: [[1]],
        aquiferTopElevationMeters: 0,
        estimatedWellHeadsMeters: { wellA: Number.NEGATIVE_INFINITY },
      }),
    ).toThrow(/finite number/);
  });

  it("does not modify received inputs", () => {
    const input = {
      headsMeters: [[1, -1], [2, 3]],
      aquiferTopElevationMeters: 0,
      estimatedWellHeadsMeters: { wellA: 1, wellB: -1 },
    };
    const before = structuredClone(input);

    evaluateConfinedModelValidity(input);

    expect(input).toEqual(before);
  });

  it("uses tolerance only for numerical noise", () => {
    const result = evaluateConfinedModelValidity({
      headsMeters: [[-CONFINED_VALIDITY_TOLERANCE_METERS / 2]],
      aquiferTopElevationMeters: 0,
    });

    expect(result.status).toBe("VALID_CONFINED");
    expect(result.level).toBe("valid");
  });

  it("marks a difference greater than tolerance invalid", () => {
    const result = evaluateConfinedModelValidity({
      headsMeters: [[-CONFINED_VALIDITY_TOLERANCE_METERS * 1.01]],
      aquiferTopElevationMeters: 0,
    });

    expect(result.level).toBe("meshInvalid");
  });

  it("classifies 15 L/s as wellDegraded with explicit parameters", () => {
    const { solution, validity } = validityForFixedEducationalScenario(15);

    expect(solution.converged).toBe(true);
    expect(validity.level).toBe("wellDegraded");
    expect(validity.cellsBelowAquiferTop).toBe(0);
    expect(validity.wellA.status).toBe("OUTSIDE_CONFINED_RANGE");
    expect(validity.wellB.status).toBe("VALID_CONFINED");
    console.log(
      "CONFINED_VALIDITY_15_LPS",
      JSON.stringify({
        minimumGridHeadMeters: validity.minimumGridHeadMeters,
        cellsBelowAquiferTop: validity.cellsBelowAquiferTop,
        estimatedWellAHeadMeters: validity.wellA.headMeters,
      }),
    );
  }, 20_000);

  it("classifies the documented 50 L/s scenario as meshInvalid", () => {
    const { solution, validity } = validityForFixedEducationalScenario(50);

    expect(solution.converged).toBe(true);
    expect(validity.level).toBe("meshInvalid");
    expect(validity.cellsBelowAquiferTop).toBeGreaterThan(0);
    expect(validity.wellA.status).toBe("OUTSIDE_CONFINED_RANGE");
    expect(validity.wellB.status).toBe("VALID_CONFINED");
  }, 20_000);
});
