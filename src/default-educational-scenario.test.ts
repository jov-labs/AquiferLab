import { describe, expect, it } from "vitest";

import { evaluateConfinedModelValidity } from "./confined-validity.js";
import {
  litersPerSecondToCubicMetersPerDay,
  metersPerSecondToMetersPerDay,
  millimetersPerYearToMetersPerDay,
  solveGroundwater,
  type GroundwaterModelInput,
} from "./groundwater.js";
import { estimateWellHeadMeters } from "./well-correction.js";

const K_METERS_PER_SECOND = 1e-4;
const THICKNESS_METERS = 20;
const RECHARGE_MILLIMETERS_PER_YEAR = 120;
const RIVER_HEAD_METERS = 100;
const AQUIFER_TOP_METERS = 0;
const WELL_RADIUS_METERS = 0.1;
const WELL_A = { row: 20, column: 20 };
const WELL_B = { row: 28, column: 30 };

function worstCaseEducationalInput(): GroundwaterModelInput {
  return {
    widthMeters: 2_000,
    heightMeters: 2_000,
    rows: 41,
    columns: 41,
    hydraulicConductivityMetersPerDay: metersPerSecondToMetersPerDay(K_METERS_PER_SECOND),
    thicknessMeters: THICKNESS_METERS,
    rechargeMetersPerDay: millimetersPerYearToMetersPerDay(RECHARGE_MILLIMETERS_PER_YEAR),
    fixedHeadCells: Array.from({ length: 41 }, (_, row) => ({
      row,
      column: 0,
      headMeters: RIVER_HEAD_METERS,
    })),
    wells: [
      {
        ...WELL_A,
        rateCubicMetersPerDay: litersPerSecondToCubicMetersPerDay(50),
      },
      {
        ...WELL_B,
        rateCubicMetersPerDay: litersPerSecondToCubicMetersPerDay(50),
      },
    ],
    tolerance: 1e-6,
    maxIterations: 20_000,
  };
}

describe("default educational scenario", () => {
  it("keeps the 50 + 50 L/s worst pumping case valid", () => {
    const input = worstCaseEducationalInput();
    const solution = solveGroundwater(input);
    const correctionParameters = (wellIndex: 0 | 1) => ({
      cellWidthMeters: input.widthMeters / input.columns,
      cellHeightMeters: input.heightMeters / input.rows,
      hydraulicConductivityMetersPerDay: input.hydraulicConductivityMetersPerDay,
      thicknessMeters: input.thicknessMeters,
      extractionRateCubicMetersPerDay: input.wells[wellIndex].rateCubicMetersPerDay,
      wellRadiusMeters: WELL_RADIUS_METERS,
    });
    const estimatedWellAHead = estimateWellHeadMeters(
      solution.headsMeters[WELL_A.row][WELL_A.column],
      correctionParameters(0),
    );
    const estimatedWellBHead = estimateWellHeadMeters(
      solution.headsMeters[WELL_B.row][WELL_B.column],
      correctionParameters(1),
    );
    const validity = evaluateConfinedModelValidity({
      headsMeters: solution.headsMeters,
      aquiferTopElevationMeters: AQUIFER_TOP_METERS,
      estimatedWellHeadsMeters: { wellA: estimatedWellAHead, wellB: estimatedWellBHead },
    });
    const minimumMarginMeters = Math.min(
      validity.minimumMarginToAquiferTopMeters,
      estimatedWellAHead - AQUIFER_TOP_METERS,
      estimatedWellBHead - AQUIFER_TOP_METERS,
    );

    expect(solution.converged).toBe(true);
    expect(validity.level).toBe("valid");
    expect(validity.cellsBelowAquiferTop).toBe(0);
    expect(validity.wellA.status).toBe("VALID_CONFINED");
    expect(validity.wellB.status).toBe("VALID_CONFINED");
    expect(minimumMarginMeters).toBeGreaterThanOrEqual(10);
  }, 20_000);
});
