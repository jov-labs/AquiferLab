import { describe, expect, it } from "vitest";

import {
  createDefaultModelInput,
  litersPerSecondToCubicMetersPerDay,
  solveGroundwater,
  type FixedHeadCell,
  type GroundwaterModelInput,
  type GroundwaterResult,
} from "./groundwater.js";

const DOMAIN_METERS = 2_000;
const RADIAL_HEAD_REFERENCE_METERS = 100;
const RADIAL_REFERENCE_RADIUS_METERS = 1_000;
const RADIAL_K_METERS_PER_DAY = 1;
const RADIAL_THICKNESS_METERS = 10;
const RADIAL_Q_CUBIC_METERS_PER_DAY = 100;
const BENCHMARK_WELL_RADIUS_METERS = 0.1;
const OBSERVATION_RADII_METERS = [200, 400, 700] as const;
const OBSERVATION_ANGLES_RADIANS = [0, Math.PI / 4, Math.PI / 2] as const;
const GRID_SIZES = [21, 41, 81] as const;

interface TimedResult {
  result: GroundwaterResult;
  elapsedMilliseconds: number;
}

interface RadialStudyRow {
  grid: number;
  spacingMeters: number;
  equivalentRadiusMeters: number;
  cellHeadMeters: number;
  cellDrawdownMeters: number;
  estimatedWellHeadMeters: number;
  estimatedWellDrawdownMeters: number;
  analyticalWellHeadMeters: number;
  correctedWellAbsoluteErrorMeters: number;
  observationDrawdownByRadiusMeters: Record<string, number>;
  observationErrorByRadiusMeters: Record<string, number>;
  observationRmsErrorMeters: number;
  observationMaximumErrorMeters: number;
  iterations: number;
  elapsedMilliseconds: number;
}

interface CurrentScenarioRow {
  grid: number;
  spacingMeters: number;
  minHeadMeters: number;
  wellACellHeadMeters: number;
  maximumDrawdownMeters: number;
  wellACellDrawdownMeters: number;
  drawdownAtPhysicalBMeters: number;
  drawdownAtEastObservationMeters: number;
  drawdownAtNorthObservationMeters: number;
  referenceIterations: number;
  pumpingIterations: number;
  elapsedMilliseconds: number;
}

const radialCache = new Map<number, RadialStudyRow>();
const currentScenarioCache = new Map<number, CurrentScenarioRow>();

function cellSpacing(domainMeters: number, cells: number): number {
  return domainMeters / cells;
}

function cellCenter(coordinateIndex: number, cells: number, domainMeters: number): number {
  return (coordinateIndex + 0.5) * cellSpacing(domainMeters, cells) - domainMeters / 2;
}

function physicalCoordinateToCell(
  coordinateMeters: number,
  cells: number,
  domainMeters: number,
): number {
  const index = Math.floor((coordinateMeters + domainMeters / 2) / cellSpacing(domainMeters, cells));
  return Math.max(0, Math.min(cells - 1, index));
}

function thiemHeadMeters(radiusMeters: number): number {
  if (!(radiusMeters > 0) || !Number.isFinite(radiusMeters)) {
    throw new Error("The Thiem radius must be finite and greater than zero.");
  }
  const transmissivity = RADIAL_K_METERS_PER_DAY * RADIAL_THICKNESS_METERS;
  return (
    RADIAL_HEAD_REFERENCE_METERS +
    (RADIAL_Q_CUBIC_METERS_PER_DAY / (2 * Math.PI * transmissivity)) *
      Math.log(radiusMeters / RADIAL_REFERENCE_RADIUS_METERS)
  );
}

function radialBoundaryCells(grid: number): FixedHeadCell[] {
  const cells: FixedHeadCell[] = [];
  for (let row = 0; row < grid; row += 1) {
    for (let column = 0; column < grid; column += 1) {
      if (row !== 0 && row !== grid - 1 && column !== 0 && column !== grid - 1) {
        continue;
      }
      const x = cellCenter(column, grid, DOMAIN_METERS);
      const z = cellCenter(row, grid, DOMAIN_METERS);
      cells.push({ row, column, headMeters: thiemHeadMeters(Math.hypot(x, z)) });
    }
  }
  return cells;
}

function radialModel(grid: number): GroundwaterModelInput {
  const center = (grid - 1) / 2;
  return {
    widthMeters: DOMAIN_METERS,
    heightMeters: DOMAIN_METERS,
    rows: grid,
    columns: grid,
    hydraulicConductivityMetersPerDay: RADIAL_K_METERS_PER_DAY,
    thicknessMeters: RADIAL_THICKNESS_METERS,
    rechargeMetersPerDay: 0,
    fixedHeadCells: radialBoundaryCells(grid),
    wells: [
      {
        row: center,
        column: center,
        rateCubicMetersPerDay: RADIAL_Q_CUBIC_METERS_PER_DAY,
      },
    ],
    tolerance: 1e-9,
    maxIterations: 100_000,
  };
}

function timedSolve(input: GroundwaterModelInput): TimedResult {
  const started = performance.now();
  const result = solveGroundwater(input);
  return { result, elapsedMilliseconds: performance.now() - started };
}

function interpolateHead(
  headsMeters: readonly (readonly number[])[],
  xMeters: number,
  zMeters: number,
  widthMeters: number,
  heightMeters: number,
): number {
  const rows = headsMeters.length;
  const columns = headsMeters[0].length;
  const dx = widthMeters / columns;
  const dz = heightMeters / rows;
  const fractionalColumn = (xMeters + widthMeters / 2) / dx - 0.5;
  const fractionalRow = (zMeters + heightMeters / 2) / dz - 0.5;
  const left = Math.max(0, Math.min(columns - 1, Math.floor(fractionalColumn)));
  const right = Math.max(0, Math.min(columns - 1, left + 1));
  const top = Math.max(0, Math.min(rows - 1, Math.floor(fractionalRow)));
  const bottom = Math.max(0, Math.min(rows - 1, top + 1));
  const tx = Math.max(0, Math.min(1, fractionalColumn - left));
  const tz = Math.max(0, Math.min(1, fractionalRow - top));
  const atTop = headsMeters[top][left] * (1 - tx) + headsMeters[top][right] * tx;
  const atBottom = headsMeters[bottom][left] * (1 - tx) + headsMeters[bottom][right] * tx;
  return atTop * (1 - tz) + atBottom * tz;
}

function peacemanEquivalentRadius(dxMeters: number, dzMeters: number): number {
  return 0.14 * Math.sqrt(dxMeters * dxMeters + dzMeters * dzMeters);
}

function estimateWellHeadMeters(
  cellHeadMeters: number,
  extractionRateCubicMetersPerDay: number,
  transmissivitySquareMetersPerDay: number,
  equivalentRadiusMeters: number,
  wellRadiusMeters: number,
): number {
  return (
    cellHeadMeters -
    (extractionRateCubicMetersPerDay / (2 * Math.PI * transmissivitySquareMetersPerDay)) *
      Math.log(equivalentRadiusMeters / wellRadiusMeters)
  );
}

function radialStudy(grid: number): RadialStudyRow {
  const cached = radialCache.get(grid);
  if (cached) return cached;

  const input = radialModel(grid);
  const before = structuredClone(input);
  const { result, elapsedMilliseconds } = timedSolve(input);
  expect(input).toEqual(before);
  expect(result.converged).toBe(true);
  expect(result.isValid).toBe(true);

  const errors: number[] = [];
  const errorsByRadius = new Map<number, number[]>();
  const drawdownsByRadius = new Map<number, number[]>();
  for (const radius of OBSERVATION_RADII_METERS) {
    const radiusErrors: number[] = [];
    const radiusDrawdowns: number[] = [];
    for (const angle of OBSERVATION_ANGLES_RADIANS) {
      const x = radius * Math.cos(angle);
      const z = radius * Math.sin(angle);
      const numericalHead = interpolateHead(
        result.headsMeters,
        x,
        z,
        input.widthMeters,
        input.heightMeters,
      );
      const error = Math.abs(numericalHead - thiemHeadMeters(radius));
      errors.push(error);
      radiusErrors.push(error);
      radiusDrawdowns.push(RADIAL_HEAD_REFERENCE_METERS - numericalHead);
    }
    errorsByRadius.set(radius, radiusErrors);
    drawdownsByRadius.set(radius, radiusDrawdowns);
  }

  const center = (grid - 1) / 2;
  const spacingMeters = cellSpacing(DOMAIN_METERS, grid);
  const equivalentRadiusMeters = peacemanEquivalentRadius(spacingMeters, spacingMeters);
  const cellHeadMeters = result.headsMeters[center][center];
  const estimatedWellHeadMeters = estimateWellHeadMeters(
    cellHeadMeters,
    RADIAL_Q_CUBIC_METERS_PER_DAY,
    RADIAL_K_METERS_PER_DAY * RADIAL_THICKNESS_METERS,
    equivalentRadiusMeters,
    BENCHMARK_WELL_RADIUS_METERS,
  );
  const analyticalWellHeadMeters = thiemHeadMeters(BENCHMARK_WELL_RADIUS_METERS);
  const row: RadialStudyRow = {
    grid,
    spacingMeters,
    equivalentRadiusMeters,
    cellHeadMeters,
    cellDrawdownMeters: RADIAL_HEAD_REFERENCE_METERS - cellHeadMeters,
    estimatedWellHeadMeters,
    estimatedWellDrawdownMeters: RADIAL_HEAD_REFERENCE_METERS - estimatedWellHeadMeters,
    analyticalWellHeadMeters,
    correctedWellAbsoluteErrorMeters: Math.abs(estimatedWellHeadMeters - analyticalWellHeadMeters),
    observationDrawdownByRadiusMeters: Object.fromEntries(
      [...drawdownsByRadius].map(([radius, radiusDrawdowns]) => [
        String(radius),
        radiusDrawdowns.reduce((sum, drawdown) => sum + drawdown, 0) / radiusDrawdowns.length,
      ]),
    ),
    observationErrorByRadiusMeters: Object.fromEntries(
      [...errorsByRadius].map(([radius, radiusErrors]) => [
        String(radius),
        Math.sqrt(
          radiusErrors.reduce((sum, error) => sum + error * error, 0) / radiusErrors.length,
        ),
      ]),
    ),
    observationRmsErrorMeters: Math.sqrt(
      errors.reduce((sum, error) => sum + error * error, 0) / errors.length,
    ),
    observationMaximumErrorMeters: Math.max(...errors),
    iterations: result.iterations,
    elapsedMilliseconds,
  };
  radialCache.set(grid, row);
  return row;
}

function currentScenarioModel(grid: number, pumping: boolean): GroundwaterModelInput {
  const base = createDefaultModelInput();
  const center = (grid - 1) / 2;
  const physicalB = {
    x: cellCenter(30, 41, DOMAIN_METERS),
    z: cellCenter(28, 41, DOMAIN_METERS),
  };
  return {
    ...base,
    rows: grid,
    columns: grid,
    fixedHeadCells: Array.from({ length: grid }, (_, row) => ({
      row,
      column: 0,
      headMeters: 100,
    })),
    wells: [
      {
        row: center,
        column: center,
        rateCubicMetersPerDay: pumping ? litersPerSecondToCubicMetersPerDay(50) : 0,
      },
      {
        row: physicalCoordinateToCell(physicalB.z, grid, DOMAIN_METERS),
        column: physicalCoordinateToCell(physicalB.x, grid, DOMAIN_METERS),
        rateCubicMetersPerDay: 0,
      },
    ],
    maxIterations: 100_000,
  };
}

function currentScenarioStudy(grid: number): CurrentScenarioRow {
  const cached = currentScenarioCache.get(grid);
  if (cached) return cached;

  const started = performance.now();
  const reference = solveGroundwater(currentScenarioModel(grid, false));
  const pumping = solveGroundwater(currentScenarioModel(grid, true));
  const elapsedMilliseconds = performance.now() - started;
  expect(reference.converged).toBe(true);
  expect(pumping.converged).toBe(true);

  const drawdown = reference.headsMeters.map((row, rowIndex) =>
    row.map((head, column) => head - pumping.headsMeters[rowIndex][column]),
  );
  const center = (grid - 1) / 2;
  const physicalB = {
    x: cellCenter(30, 41, DOMAIN_METERS),
    z: cellCenter(28, 41, DOMAIN_METERS),
  };
  const drawdownAt = (x: number, z: number) =>
    interpolateHead(drawdown, x, z, DOMAIN_METERS, DOMAIN_METERS);
  const row: CurrentScenarioRow = {
    grid,
    spacingMeters: cellSpacing(DOMAIN_METERS, grid),
    minHeadMeters: pumping.minHeadMeters,
    wellACellHeadMeters: pumping.headsMeters[center][center],
    maximumDrawdownMeters: Math.max(...drawdown.flat()),
    wellACellDrawdownMeters: drawdown[center][center],
    drawdownAtPhysicalBMeters: drawdownAt(physicalB.x, physicalB.z),
    drawdownAtEastObservationMeters: drawdownAt(600, 0),
    drawdownAtNorthObservationMeters: drawdownAt(0, 600),
    referenceIterations: reference.iterations,
    pumpingIterations: pumping.iterations,
    elapsedMilliseconds,
  };
  currentScenarioCache.set(grid, row);
  return row;
}

describe("steady-state radial Thiem benchmark", () => {
  it("is reproducible and does not modify the input", () => {
    const input = radialModel(21);
    const before = structuredClone(input);
    const first = solveGroundwater(input);
    const second = solveGroundwater(input);

    expect(first).toEqual(second);
    expect(input).toEqual(before);
    expect(first.converged).toBe(true);
  }, 120_000);

  it("reduces observation error when refining 21 → 41 → 81", () => {
    const rows = GRID_SIZES.map(radialStudy);

    expect(rows[1].observationRmsErrorMeters).toBeLessThan(rows[0].observationRmsErrorMeters);
    expect(rows[2].observationRmsErrorMeters).toBeLessThan(rows[1].observationRmsErrorMeters);
    for (const radius of OBSERVATION_RADII_METERS) {
      expect(rows[1].observationErrorByRadiusMeters[radius]).toBeLessThan(
        rows[0].observationErrorByRadiusMeters[radius],
      );
      expect(rows[2].observationErrorByRadiusMeters[radius]).toBeLessThan(
        rows[1].observationErrorByRadiusMeters[radius],
      );
    }
    expect(rows.every((row) => Number.isFinite(row.cellHeadMeters))).toBe(true);
  }, 120_000);

  it("Peaceman correction stabilizes the estimate at rw without altering the solver", () => {
    const rows = GRID_SIZES.map(radialStudy);
    const rawCellRange =
      Math.max(...rows.map((row) => row.cellHeadMeters)) -
      Math.min(...rows.map((row) => row.cellHeadMeters));
    const correctedRange =
      Math.max(...rows.map((row) => row.estimatedWellHeadMeters)) -
      Math.min(...rows.map((row) => row.estimatedWellHeadMeters));

    expect(correctedRange).toBeLessThan(rawCellRange);
    expect(rows[2].correctedWellAbsoluteErrorMeters).toBeLessThan(
      rows[0].correctedWellAbsoluteErrorMeters,
    );
  }, 120_000);

  it("uses the requested equivalent radius for a square cell", () => {
    const spacingMeters = 10;
    expect(peacemanEquivalentRadius(spacingMeters, spacingMeters)).toBeCloseTo(
      0.14 * Math.sqrt(2) * spacingMeters,
      12,
    );
    expect(peacemanEquivalentRadius(spacingMeters, spacingMeters)).toBeCloseTo(
      0.198 * spacingMeters,
      2,
    );
  });

  it("keeps the current scenario convergent at 41×41 and 81×81", () => {
    const rows = [41, 81].map(currentScenarioStudy);

    expect(rows.every((row) => Number.isFinite(row.minHeadMeters))).toBe(true);
  }, 120_000);

  it("publishes results for the scientific audit", () => {
    console.log("THIEM_BENCHMARK", JSON.stringify(GRID_SIZES.map(radialStudy)));
    console.log("CURRENT_SCENARIO", JSON.stringify([41, 81].map(currentScenarioStudy)));
  }, 120_000);
});
