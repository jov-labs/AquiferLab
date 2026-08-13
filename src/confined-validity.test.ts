import { describe, expect, it } from "vitest";

import {
  CONFINED_VALIDITY_TOLERANCE_METERS,
  evaluateConfinedModelValidity,
} from "./confined-validity.js";
import {
  createDefaultModelInput,
  litersPerSecondToCubicMetersPerDay,
  solveGroundwater,
} from "./groundwater.js";
import { estimateWellHeadMeters } from "./well-correction.js";

describe("validez del modelo confinado", () => {
  it("es válida cuando todas las cargas de malla están sobre el techo", () => {
    const result = evaluateConfinedModelValidity({
      headsMeters: [[1, 2], [3, 4]],
      aquiferTopElevationMeters: 0,
    });

    expect(result.status).toBe("VALID_CONFINED");
    expect(result.minimumGridHeadMeters).toBe(1);
    expect(result.cellsBelowAquiferTop).toBe(0);
    expect(result.percentageCellsBelowAquiferTop).toBe(0);
  });

  it("considera válida una carga exactamente igual al techo", () => {
    const result = evaluateConfinedModelValidity({
      headsMeters: [[0]],
      aquiferTopElevationMeters: 0,
    });

    expect(result.status).toBe("VALID_CONFINED");
    expect(result.minimumMarginToAquiferTopMeters).toBe(0);
  });

  it("detecta una celda bajo el techo", () => {
    const result = evaluateConfinedModelValidity({
      headsMeters: [[1, -0.25], [2, 3]],
      aquiferTopElevationMeters: 0,
    });

    expect(result.status).toBe("OUTSIDE_CONFINED_RANGE");
    expect(result.cellsBelowAquiferTop).toBe(1);
  });

  it("calcula porcentaje y déficit máximo para varias celdas bajo el techo", () => {
    const result = evaluateConfinedModelValidity({
      headsMeters: [[-2, -1], [0, 3]],
      aquiferTopElevationMeters: 0,
    });

    expect(result.cellsBelowAquiferTop).toBe(2);
    expect(result.percentageCellsBelowAquiferTop).toBe(50);
    expect(result.maximumGridDeficitBelowAquiferTopMeters).toBe(2);
  });

  it("advierte si sólo la carga estimada del pozo está bajo el techo", () => {
    const result = evaluateConfinedModelValidity({
      headsMeters: [[2]],
      aquiferTopElevationMeters: 0,
      estimatedWellHeadsMeters: { wellA: -0.5, wellB: 1 },
    });

    expect(result.status).toBe("OUTSIDE_CONFINED_RANGE");
    expect(result.cellsBelowAquiferTop).toBe(0);
    expect(result.wellA.status).toBe("OUTSIDE_CONFINED_RANGE");
    expect(result.wellA.deficitBelowAquiferTopMeters).toBe(0.5);
  });

  it("evalúa A y B con estados distintos", () => {
    const result = evaluateConfinedModelValidity({
      headsMeters: [[1]],
      aquiferTopElevationMeters: 0,
      estimatedWellHeadsMeters: { wellA: 0, wellB: -1 },
    });

    expect(result.wellA.status).toBe("VALID_CONFINED");
    expect(result.wellB.status).toBe("OUTSIDE_CONFINED_RANGE");
  });

  it("admite una cota de techo negativa", () => {
    const result = evaluateConfinedModelValidity({
      headsMeters: [[-4, -3]],
      aquiferTopElevationMeters: -5,
    });

    expect(result.status).toBe("VALID_CONFINED");
  });

  it("rechaza una matriz vacía", () => {
    expect(() =>
      evaluateConfinedModelValidity({ headsMeters: [], aquiferTopElevationMeters: 0 }),
    ).toThrow(/no vacía/);
  });

  it("rechaza una matriz irregular", () => {
    expect(() =>
      evaluateConfinedModelValidity({ headsMeters: [[1], [1, 2]], aquiferTopElevationMeters: 0 }),
    ).toThrow(/rectangular/);
  });

  it("rechaza NaN e Infinity en cargas, techo y pozos", () => {
    expect(() =>
      evaluateConfinedModelValidity({ headsMeters: [[Number.NaN]], aquiferTopElevationMeters: 0 }),
    ).toThrow(/finito/);
    expect(() =>
      evaluateConfinedModelValidity({ headsMeters: [[1]], aquiferTopElevationMeters: Infinity }),
    ).toThrow(/finito/);
    expect(() =>
      evaluateConfinedModelValidity({
        headsMeters: [[1]],
        aquiferTopElevationMeters: 0,
        estimatedWellHeadsMeters: { wellA: Number.NEGATIVE_INFINITY },
      }),
    ).toThrow(/finito/);
  });

  it("no modifica las entradas recibidas", () => {
    const input = {
      headsMeters: [[1, -1], [2, 3]],
      aquiferTopElevationMeters: 0,
      estimatedWellHeadsMeters: { wellA: 1, wellB: -1 },
    };
    const before = structuredClone(input);

    evaluateConfinedModelValidity(input);

    expect(input).toEqual(before);
  });

  it("usa tolerancia sólo para ruido numérico", () => {
    const result = evaluateConfinedModelValidity({
      headsMeters: [[-CONFINED_VALIDITY_TOLERANCE_METERS / 2]],
      aquiferTopElevationMeters: 0,
    });

    expect(result.status).toBe("VALID_CONFINED");
  });

  it("clasifica los escenarios educativos sin bombeo y A=50 l/s con techo 0 m", () => {
    const base = createDefaultModelInput();
    const noPumpingInput = {
      ...base,
      wells: [
        { row: 20, column: 20, rateCubicMetersPerDay: 0 },
        { row: 28, column: 30, rateCubicMetersPerDay: 0 },
      ],
    };
    const pumpingInput = {
      ...noPumpingInput,
      wells: [
        {
          row: 20,
          column: 20,
          rateCubicMetersPerDay: litersPerSecondToCubicMetersPerDay(50),
        },
        { row: 28, column: 30, rateCubicMetersPerDay: 0 },
      ],
    };
    const noPumping = solveGroundwater(noPumpingInput);
    const pumping = solveGroundwater(pumpingInput);
    const wellParameters = (rateCubicMetersPerDay: number) => ({
      cellWidthMeters: base.widthMeters / base.columns,
      cellHeightMeters: base.heightMeters / base.rows,
      hydraulicConductivityMetersPerDay: base.hydraulicConductivityMetersPerDay,
      thicknessMeters: base.thicknessMeters,
      extractionRateCubicMetersPerDay: rateCubicMetersPerDay,
      wellRadiusMeters: 0.1,
    });
    const noPumpingValidity = evaluateConfinedModelValidity({
      headsMeters: noPumping.headsMeters,
      aquiferTopElevationMeters: 0,
      estimatedWellHeadsMeters: {
        wellA: estimateWellHeadMeters(noPumping.headsMeters[20][20], wellParameters(0)),
        wellB: estimateWellHeadMeters(noPumping.headsMeters[28][30], wellParameters(0)),
      },
    });
    const pumpingValidity = evaluateConfinedModelValidity({
      headsMeters: pumping.headsMeters,
      aquiferTopElevationMeters: 0,
      estimatedWellHeadsMeters: {
        wellA: estimateWellHeadMeters(
          pumping.headsMeters[20][20],
          wellParameters(pumpingInput.wells[0].rateCubicMetersPerDay),
        ),
        wellB: estimateWellHeadMeters(pumping.headsMeters[28][30], wellParameters(0)),
      },
    });

    expect(noPumping.converged).toBe(true);
    expect(noPumpingValidity.status).toBe("VALID_CONFINED");
    expect(pumping.converged).toBe(true);
    expect(pumpingValidity.status).toBe("OUTSIDE_CONFINED_RANGE");
    expect(pumpingValidity.wellA.status).toBe("OUTSIDE_CONFINED_RANGE");
    const pumpingIterations = pumping.iterations;
    evaluateConfinedModelValidity({
      headsMeters: pumping.headsMeters,
      aquiferTopElevationMeters: -400,
    });
    expect(pumping.iterations).toBe(pumpingIterations);
    console.log(
      "CONFINED_VALIDITY_SCENARIOS",
      JSON.stringify({
        noPumping: {
          minimumGridHeadMeters: noPumpingValidity.minimumGridHeadMeters,
          cellsBelowAquiferTop: noPumpingValidity.cellsBelowAquiferTop,
        },
        pumpingA50: {
          minimumGridHeadMeters: pumpingValidity.minimumGridHeadMeters,
          cellsBelowAquiferTop: pumpingValidity.cellsBelowAquiferTop,
          estimatedWellAHeadMeters: pumpingValidity.wellA.headMeters,
          wellADeficitBelowAquiferTopMeters: pumpingValidity.wellA.deficitBelowAquiferTopMeters,
        },
      }),
    );
  }, 20_000);
});
