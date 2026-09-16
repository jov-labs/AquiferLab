/**
 * Steady-state 2D engine for a homogeneous, isotropic confined aquifer.
 * All properties received by the solver use internal SI-day units.
 */

export interface FixedHeadCell {
  row: number;
  column: number;
  headMeters: number;
}

export interface ExtractionWell {
  row: number;
  column: number;
  /** Extraction rate in m³/day. Must be greater than or equal to zero. */
  rateCubicMetersPerDay: number;
}

export interface GroundwaterModelInput {
  widthMeters: number;
  heightMeters: number;
  rows: number;
  columns: number;
  /** Hydraulic conductivity K, in m/day. */
  hydraulicConductivityMetersPerDay: number;
  /** Constant thickness b, in m. */
  thicknessMeters: number;
  /** Distributed recharge R, in m/day. */
  rechargeMetersPerDay: number;
  /** River cells or other fixed-head boundaries. */
  fixedHeadCells: readonly FixedHeadCell[];
  /** Up to two extraction wells. */
  wells: readonly ExtractionWell[];
  tolerance: number;
  maxIterations: number;
}

export interface GroundwaterResult {
  /** Hydraulic-head field in m, indexed as [row][column]. */
  headsMeters: number[][];
  converged: boolean;
  /** A non-convergent result is explicitly marked invalid. */
  isValid: boolean;
  iterations: number;
  /** Maximum absolute head change from the last iteration, in m. */
  residualMeters: number;
  minHeadMeters: number;
  maxHeadMeters: number;
}

const DAYS_PER_YEAR = 365;
const SECONDS_PER_DAY = 86_400;
const LITERS_PER_CUBIC_METER = 1_000;

/** Centralized K conversion: m/s to m/day. */
export function metersPerSecondToMetersPerDay(value: number): number {
  assertFinite(value, "La conductividad en m/s");
  return value * SECONDS_PER_DAY;
}

/** Centralized K conversion: m/day to m/s. */
export function metersPerDayToMetersPerSecond(value: number): number {
  assertFinite(value, "La conductividad en m/día");
  return value / SECONDS_PER_DAY;
}

/** Centralized recharge conversion: mm/year to m/day. */
export function millimetersPerYearToMetersPerDay(value: number): number {
  assertFinite(value, "La recarga en mm/año");
  return value / 1_000 / DAYS_PER_YEAR;
}

/** Centralized recharge conversion: m/day to mm/year. */
export function metersPerDayToMillimetersPerYear(value: number): number {
  assertFinite(value, "La recarga en m/día");
  return value * 1_000 * DAYS_PER_YEAR;
}

/** Centralized pumping conversion: L/s to m³/day. */
export function litersPerSecondToCubicMetersPerDay(value: number): number {
  assertFinite(value, "El bombeo en L/s");
  return (value / LITERS_PER_CUBIC_METER) * SECONDS_PER_DAY;
}

/** Returns a new configuration for a 2,000 m × 2,000 m domain. */
export function createDefaultModelInput(): GroundwaterModelInput {
  const rows = 41;
  const columns = 41;
  const defaultFixedHeadMeters = 100;

  return {
    widthMeters: 2_000,
    heightMeters: 2_000,
    rows,
    columns,
    hydraulicConductivityMetersPerDay: metersPerSecondToMetersPerDay(1e-4),
    thicknessMeters: 20,
    rechargeMetersPerDay: millimetersPerYearToMetersPerDay(120),
    fixedHeadCells: Array.from({ length: rows }, (_, row) => ({
      row,
      column: 0,
      headMeters: defaultFixedHeadMeters,
    })),
    wells: [],
    tolerance: 1e-6,
    maxIterations: 20_000,
  };
}

/**
 * Solves ∇·(T∇h) + R - Q = 0 with Gauss-Seidel on a cell grid.
 * Faces without a neighbour are no-flow boundaries; prescribed cells are fixed-head.
 */
export function solveGroundwater(input: GroundwaterModelInput): GroundwaterResult {
  validateInput(input);

  const dx = input.widthMeters / input.columns;
  const dy = input.heightMeters / input.rows;
  const cellArea = dx * dy;
  const transmissivity =
    input.hydraulicConductivityMetersPerDay * input.thicknessMeters;
  const xConductance = transmissivity / (dx * dx);
  const yConductance = transmissivity / (dy * dy);
  const fixedHeads = makeFixedHeadMap(input);
  const initialHead = averageFixedHeads(fixedHeads);
  const heads = makeMatrix(input.rows, input.columns, initialHead);
  const wellSinks = makeMatrix(input.rows, input.columns, 0);

  for (const [index, head] of fixedHeads) {
    heads[Math.floor(index / input.columns)][index % input.columns] = head;
  }
  for (const well of input.wells) {
    wellSinks[well.row][well.column] += well.rateCubicMetersPerDay / cellArea;
  }

  let residualMeters = Number.POSITIVE_INFINITY;
  for (let iteration = 1; iteration <= input.maxIterations; iteration += 1) {
    residualMeters = 0;

    for (let row = 0; row < input.rows; row += 1) {
      for (let column = 0; column < input.columns; column += 1) {
        const index = row * input.columns + column;
        if (fixedHeads.has(index)) {
          continue;
        }

        let conductanceSum = 0;
        let neighborContribution = 0;
        if (column > 0) {
          conductanceSum += xConductance;
          neighborContribution += xConductance * heads[row][column - 1];
        }
        if (column < input.columns - 1) {
          conductanceSum += xConductance;
          neighborContribution += xConductance * heads[row][column + 1];
        }
        if (row > 0) {
          conductanceSum += yConductance;
          neighborContribution += yConductance * heads[row - 1][column];
        }
        if (row < input.rows - 1) {
          conductanceSum += yConductance;
          neighborContribution += yConductance * heads[row + 1][column];
        }

        const nextHead =
          (neighborContribution + input.rechargeMetersPerDay - wellSinks[row][column]) /
          conductanceSum;
        if (!Number.isFinite(nextHead)) {
          throw new Error("El solver produjo NaN o Infinity.");
        }

        const change = Math.abs(nextHead - heads[row][column]);
        if (change > residualMeters) {
          residualMeters = change;
        }
        heads[row][column] = nextHead;
      }
    }

    if (residualMeters <= input.tolerance) {
      return makeResult(heads, true, iteration, residualMeters);
    }
  }

  return makeResult(heads, false, input.maxIterations, residualMeters);
}

function makeResult(
  headsMeters: number[][],
  converged: boolean,
  iterations: number,
  residualMeters: number,
): GroundwaterResult {
  let minHeadMeters = Number.POSITIVE_INFINITY;
  let maxHeadMeters = Number.NEGATIVE_INFINITY;
  for (const row of headsMeters) {
    for (const head of row) {
      if (!Number.isFinite(head)) {
        throw new Error("El resultado contiene NaN o Infinity.");
      }
      minHeadMeters = Math.min(minHeadMeters, head);
      maxHeadMeters = Math.max(maxHeadMeters, head);
    }
  }

  return {
    headsMeters,
    converged,
    isValid: converged,
    iterations,
    residualMeters,
    minHeadMeters,
    maxHeadMeters,
  };
}

function validateInput(input: GroundwaterModelInput): void {
  assertPositive(input.widthMeters, "El ancho del dominio");
  assertPositive(input.heightMeters, "El alto del dominio");
  assertGridSize(input.rows, "El número de filas");
  assertGridSize(input.columns, "El número de columnas");
  assertPositive(input.hydraulicConductivityMetersPerDay, "K");
  assertPositive(input.thicknessMeters, "El espesor");
  assertFinite(input.rechargeMetersPerDay, "La recarga");
  assertPositive(input.tolerance, "La tolerancia");
  if (!Number.isInteger(input.maxIterations) || input.maxIterations <= 0) {
    throw new Error("El máximo de iteraciones debe ser un entero positivo.");
  }
  if (input.fixedHeadCells.length === 0) {
    throw new Error(
      "Se requiere al menos una celda de carga fija para definir una referencia hidráulica.",
    );
  }
  if (input.wells.length > 2) {
    throw new Error("El modelo admite como máximo dos pozos de extracción.");
  }

  const occupiedFixedCells = new Set<number>();
  for (const cell of input.fixedHeadCells) {
    assertCell(cell.row, cell.column, input.rows, input.columns, "La celda de carga fija");
    assertFinite(cell.headMeters, "La carga fija");
    const index = cell.row * input.columns + cell.column;
    if (occupiedFixedCells.has(index)) {
      throw new Error("No se permiten celdas de carga fija duplicadas.");
    }
    occupiedFixedCells.add(index);
  }
  for (const well of input.wells) {
    assertCell(well.row, well.column, input.rows, input.columns, "El pozo");
    if (occupiedFixedCells.has(well.row * input.columns + well.column)) {
      throw new Error("Un pozo no puede ocupar una celda de carga fija.");
    }
    assertFinite(well.rateCubicMetersPerDay, "El bombeo");
    if (well.rateCubicMetersPerDay < 0) {
      throw new Error("El bombeo no puede ser negativo.");
    }
  }
}

function makeFixedHeadMap(input: GroundwaterModelInput): Map<number, number> {
  const fixedHeads = new Map<number, number>();
  for (const cell of input.fixedHeadCells) {
    fixedHeads.set(cell.row * input.columns + cell.column, cell.headMeters);
  }
  return fixedHeads;
}

function averageFixedHeads(fixedHeads: ReadonlyMap<number, number>): number {
  let sum = 0;
  for (const head of fixedHeads.values()) {
    sum += head;
  }
  return sum / fixedHeads.size;
}

function makeMatrix(rows: number, columns: number, value: number): number[][] {
  return Array.from({ length: rows }, () => Array.from({ length: columns }, () => value));
}

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`${label} debe ser un número finito.`);
  }
}

function assertPositive(value: number, label: string): void {
  assertFinite(value, label);
  if (value <= 0) {
    throw new Error(`${label} debe ser mayor que cero.`);
  }
}

function assertGridSize(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 2) {
    throw new Error(`${label} debe ser un entero de al menos 2.`);
  }
}

function assertCell(
  row: number,
  column: number,
  rows: number,
  columns: number,
  label: string,
): void {
  if (
    !Number.isInteger(row) ||
    !Number.isInteger(column) ||
    row < 0 ||
    row >= rows ||
    column < 0 ||
    column >= columns
  ) {
    throw new Error(`${label} está fuera de la malla.`);
  }
}
