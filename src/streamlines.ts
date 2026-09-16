import type { DarcyFlowField, DarcyVector } from "./flow.js";

/** Physical point in the model plane; x increases eastward and z southward. */
export interface StreamlinePoint {
  xMeters: number;
  zMeters: number;
}

export interface StreamlineDomain {
  widthMeters: number;
  heightMeters: number;
  rows: number;
  columns: number;
}

export interface StreamlineTarget extends StreamlinePoint {
  kind: "fixedHead" | "well";
}

export type StreamlineTermination =
  | "outOfDomain"
  | "fixedHead"
  | "well"
  | "nearZeroFlow"
  | "maxLength"
  | "maxSteps"
  | "stagnation"
  | "repetition";

export interface StreamlineTrace {
  points: StreamlinePoint[];
  termination: StreamlineTermination;
  lengthMeters: number;
}

export interface QualitativeStreamline {
  seed: StreamlinePoint;
  points: StreamlinePoint[];
  forwardTermination: StreamlineTermination;
  backwardTermination: StreamlineTermination;
}

export interface StreamlineOptions {
  stepLengthMeters: number;
  maxSteps: number;
  maxLengthMeters: number;
  /** Explicit |q| threshold, in m/day, for stopping a trajectory. */
  nearZeroFlowMetersPerDay: number;
  /** Explicit capture distance for a fixed head or well, in m. */
  targetToleranceMeters: number;
  /** Distance below which an advance is considered stagnant, in m. */
  stagnationToleranceMeters: number;
  /** Distance for detecting that a trajectory returned to an already visited area, in m. */
  repetitionToleranceMeters: number;
}

export interface CalculateStreamlinesInput {
  domain: StreamlineDomain;
  field: DarcyFlowField;
  seeds: readonly StreamlinePoint[];
  targets: readonly StreamlineTarget[];
  options: StreamlineOptions;
}

export const DEFAULT_STREAMLINE_OPTIONS: StreamlineOptions = {
  stepLengthMeters: 22,
  maxSteps: 600,
  maxLengthMeters: 8_000,
  nearZeroFlowMetersPerDay: 1e-10,
  targetToleranceMeters: 38,
  stagnationToleranceMeters: 1e-6,
  repetitionToleranceMeters: 5,
};

/**
 * Generates evenly spaced interior seeds. It does not depend on the solver or Three.js.
 */
export function createStreamlineSeeds(
  domain: StreamlineDomain,
  columns: number,
  rows: number,
): StreamlinePoint[] {
  validateDomain(domain);
  if (!Number.isInteger(columns) || columns <= 0 || !Number.isInteger(rows) || rows <= 0) {
    throw new Error("The seed distribution must have positive integer dimensions.");
  }
  return Array.from({ length: rows }, (_, row) =>
    Array.from({ length: columns }, (_, column) => ({
      xMeters: ((column + 1) / (columns + 1)) * domain.widthMeters,
      zMeters: ((row + 1) / (rows + 1)) * domain.heightMeters,
    })),
  ).flat();
}

/**
 * Bilinearly interpolates q between available cell centers.
 * Near the edge, the nearest interior-cell value is extended so a continuous
 * exit from the domain can be detected and clipped.
 */
export function createDarcyInterpolator(
  domain: StreamlineDomain,
  field: DarcyFlowField,
): (point: StreamlinePoint) => { qxMetersPerDay: number; qzMetersPerDay: number; magnitudeMetersPerDay: number } {
  validateDomain(domain);
  const vectors = makeVectorGrid(field.vectors);
  const rows = [...new Set(field.vectors.map((vector) => vector.row))].sort((a, b) => a - b);
  const columns = [...new Set(field.vectors.map((vector) => vector.column))].sort((a, b) => a - b);
  if (rows.length === 0 || columns.length === 0) {
    throw new Error("The Darcy field contains no vectors to interpolate.");
  }
  for (const row of rows) {
    for (const column of columns) {
      if (!vectors.has(vectorKey(row, column))) {
        throw new Error("The Darcy field must cover a rectangular grid to be interpolated.");
      }
    }
  }
  const dx = domain.widthMeters / domain.columns;
  const dz = domain.heightMeters / domain.rows;

  return (point) => {
  assertFinitePoint(point, "Interpolation point");
    const gridColumn = clamp(point.xMeters / dx - 0.5, columns[0], columns[columns.length - 1]);
    const gridRow = clamp(point.zMeters / dz - 0.5, rows[0], rows[rows.length - 1]);
    const lowerColumn = Math.floor(gridColumn);
    const upperColumn = Math.ceil(gridColumn);
    const lowerRow = Math.floor(gridRow);
    const upperRow = Math.ceil(gridRow);
    const c0 = vectors.get(vectorKey(lowerRow, lowerColumn))!;
    const c1 = vectors.get(vectorKey(lowerRow, upperColumn))!;
    const c2 = vectors.get(vectorKey(upperRow, lowerColumn))!;
    const c3 = vectors.get(vectorKey(upperRow, upperColumn))!;
    const columnWeight = gridColumn - lowerColumn;
    const rowWeight = gridRow - lowerRow;
    const qxMetersPerDay = bilinear(c0.qxMetersPerDay, c1.qxMetersPerDay, c2.qxMetersPerDay, c3.qxMetersPerDay, columnWeight, rowWeight);
    const qzMetersPerDay = bilinear(c0.qzMetersPerDay, c1.qzMetersPerDay, c2.qzMetersPerDay, c3.qzMetersPerDay, columnWeight, rowWeight);
    const magnitudeMetersPerDay = Math.hypot(qxMetersPerDay, qzMetersPerDay);
    if (!Number.isFinite(qxMetersPerDay) || !Number.isFinite(qzMetersPerDay)) {
      throw new Error("Darcy field interpolation produced a non-finite value.");
    }
    return { qxMetersPerDay, qzMetersPerDay, magnitudeMetersPerDay };
  };
}

/** Integrates a trajectory in the given direction with RK4 over q / |q|. */
export function integrateStreamline(
  domain: StreamlineDomain,
  field: DarcyFlowField,
  seed: StreamlinePoint,
  targets: readonly StreamlineTarget[],
  options: StreamlineOptions,
  direction: 1 | -1,
): StreamlineTrace {
  validateDomain(domain);
  validateOptions(options);
  assertFinitePoint(seed, "Seed");
  if (!isInsideDomain(seed, domain)) {
    throw new Error("The seed must be inside the domain.");
  }
  const interpolate = createDarcyInterpolator(domain, field);
  const points = [{ ...seed }];
  let position = { ...seed };
  let lengthMeters = 0;

  for (let step = 0; step < options.maxSteps; step += 1) {
    const target = targetAt(position, targets, options.targetToleranceMeters);
    if (target) {
      return { points, termination: target.kind, lengthMeters };
    }
    const normalizedDirection = normalizedDarcyDirection(interpolate(position), direction, options.nearZeroFlowMetersPerDay);
    if (!normalizedDirection) {
      return { points, termination: "nearZeroFlow", lengthMeters };
    }
    const candidate = rk4Step(position, options.stepLengthMeters, (point) =>
      normalizedDarcyDirection(interpolate(point), direction, options.nearZeroFlowMetersPerDay),
    );
    if (!candidate) {
      return { points, termination: "nearZeroFlow", lengthMeters };
    }
    assertFinitePoint(candidate, "RK4 step");
    const segmentLength = distance(position, candidate);
    if (!Number.isFinite(segmentLength) || segmentLength <= options.stagnationToleranceMeters) {
      return { points, termination: "stagnation", lengthMeters };
    }
    if (!isInsideDomain(candidate, domain)) {
      const boundaryPoint = firstDomainExitIntersection(position, candidate, domain);
      const boundaryLength = distance(position, boundaryPoint);
      const remainingLength = options.maxLengthMeters - lengthMeters;
      if (remainingLength <= boundaryLength) {
        appendPointWithinDomain(
          points,
          advance(position, candidate, remainingLength / segmentLength),
          domain,
        );
        return { points, termination: "maxLength", lengthMeters: options.maxLengthMeters };
      }
      appendPointWithinDomain(points, boundaryPoint, domain);
      return { points, termination: "outOfDomain", lengthMeters: lengthMeters + boundaryLength };
    }
    const remainingLength = options.maxLengthMeters - lengthMeters;
    if (segmentLength >= remainingLength) {
      const end = advance(position, candidate, remainingLength / segmentLength);
      appendPointWithinDomain(points, end, domain);
      return { points, termination: "maxLength", lengthMeters: options.maxLengthMeters };
    }
    if (isRepeated(candidate, points, options.repetitionToleranceMeters)) {
      return { points, termination: "repetition", lengthMeters };
    }
    appendPointWithinDomain(points, candidate, domain);
    lengthMeters += segmentLength;
    position = candidate;
    const reachedTarget = targetAt(position, targets, options.targetToleranceMeters);
    if (reachedTarget) {
      return { points, termination: reachedTarget.kind, lengthMeters };
    }
  }
  return { points, termination: "maxSteps", lengthMeters };
}

/** Integrates each seed forward and backward and returns a continuous polyline. */
export function calculateQualitativeStreamlines(
  input: CalculateStreamlinesInput,
): QualitativeStreamline[] {
  return input.seeds.map((seed) => {
    const forward = integrateStreamline(input.domain, input.field, seed, input.targets, input.options, 1);
    const backward = integrateStreamline(input.domain, input.field, seed, input.targets, input.options, -1);
    return {
      seed: { ...seed },
      points: [...backward.points.slice(1).reverse(), ...forward.points],
      forwardTermination: forward.termination,
      backwardTermination: backward.termination,
    };
  });
}

function makeVectorGrid(vectors: readonly DarcyVector[]): Map<string, DarcyVector> {
  const grid = new Map<string, DarcyVector>();
  for (const vector of vectors) {
    if (!Number.isInteger(vector.row) || !Number.isInteger(vector.column)) {
      throw new Error("Darcy vector coordinates must be integers.");
    }
    if (!Number.isFinite(vector.qxMetersPerDay) || !Number.isFinite(vector.qzMetersPerDay)) {
      throw new Error("The Darcy field contains non-finite values.");
    }
    const key = vectorKey(vector.row, vector.column);
    if (grid.has(key)) {
      throw new Error("The Darcy field cannot contain duplicate vectors.");
    }
    grid.set(key, vector);
  }
  return grid;
}

function vectorKey(row: number, column: number): string {
  return `${row}:${column}`;
}

function normalizedDarcyDirection(
  vector: { qxMetersPerDay: number; qzMetersPerDay: number; magnitudeMetersPerDay: number },
  sign: 1 | -1,
  nearZeroFlowMetersPerDay: number,
): StreamlinePoint | null {
  if (vector.magnitudeMetersPerDay <= nearZeroFlowMetersPerDay) {
    return null;
  }
  return {
    xMeters: sign * vector.qxMetersPerDay / vector.magnitudeMetersPerDay,
    zMeters: sign * vector.qzMetersPerDay / vector.magnitudeMetersPerDay,
  };
}

function rk4Step(
  start: StreamlinePoint,
  stepLengthMeters: number,
  directionAt: (point: StreamlinePoint) => StreamlinePoint | null,
): StreamlinePoint | null {
  const k1 = directionAt(start);
  if (!k1) return null;
  const k2 = directionAt(addScaled(start, k1, stepLengthMeters / 2));
  if (!k2) return null;
  const k3 = directionAt(addScaled(start, k2, stepLengthMeters / 2));
  if (!k3) return null;
  const k4 = directionAt(addScaled(start, k3, stepLengthMeters));
  if (!k4) return null;
  return {
    xMeters: start.xMeters + stepLengthMeters * (k1.xMeters + 2 * k2.xMeters + 2 * k3.xMeters + k4.xMeters) / 6,
    zMeters: start.zMeters + stepLengthMeters * (k1.zMeters + 2 * k2.zMeters + 2 * k3.zMeters + k4.zMeters) / 6,
  };
}

function targetAt(
  point: StreamlinePoint,
  targets: readonly StreamlineTarget[],
  toleranceMeters: number,
): StreamlineTarget | undefined {
  return targets.find((target) => distance(point, target) <= toleranceMeters);
}

function isRepeated(
  point: StreamlinePoint,
  previousPoints: readonly StreamlinePoint[],
  toleranceMeters: number,
): boolean {
  return previousPoints.slice(0, -1).some((previous) => distance(point, previous) <= toleranceMeters);
}

function isInsideDomain(point: StreamlinePoint, domain: StreamlineDomain): boolean {
  return point.xMeters >= 0 && point.xMeters <= domain.widthMeters && point.zMeters >= 0 && point.zMeters <= domain.heightMeters;
}

/** Returns the first interior-to-exterior segment crossing exactly on the rectangle. */
function firstDomainExitIntersection(
  start: StreamlinePoint,
  end: StreamlinePoint,
  domain: StreamlineDomain,
): StreamlinePoint {
  const candidates: number[] = [];
  const dx = end.xMeters - start.xMeters;
  const dz = end.zMeters - start.zMeters;
  if (end.xMeters < 0 && dx !== 0) {
    candidates.push((0 - start.xMeters) / dx);
  } else if (end.xMeters > domain.widthMeters && dx !== 0) {
    candidates.push((domain.widthMeters - start.xMeters) / dx);
  }
  if (end.zMeters < 0 && dz !== 0) {
    candidates.push((0 - start.zMeters) / dz);
  } else if (end.zMeters > domain.heightMeters && dz !== 0) {
    candidates.push((domain.heightMeters - start.zMeters) / dz);
  }
  const fraction = candidates
    .filter((candidate) => candidate >= 0 && candidate <= 1)
    .sort((left, right) => left - right)
    .at(0);
  if (fraction === undefined) {
    throw new Error("The trajectory could not be clipped at the domain boundary.");
  }
  return clampPointToDomain(advance(start, end, fraction), domain);
}

function appendPointWithinDomain(
  points: StreamlinePoint[],
  point: StreamlinePoint,
  domain: StreamlineDomain,
): void {
  assertFinitePoint(point, "Trajectory point");
  points.push(clampPointToDomain(point, domain));
}

function clampPointToDomain(point: StreamlinePoint, domain: StreamlineDomain): StreamlinePoint {
  return {
    xMeters: clamp(point.xMeters, 0, domain.widthMeters),
    zMeters: clamp(point.zMeters, 0, domain.heightMeters),
  };
}

function advance(start: StreamlinePoint, end: StreamlinePoint, fraction: number): StreamlinePoint {
  return {
    xMeters: start.xMeters + (end.xMeters - start.xMeters) * fraction,
    zMeters: start.zMeters + (end.zMeters - start.zMeters) * fraction,
  };
}

function addScaled(point: StreamlinePoint, direction: StreamlinePoint, scale: number): StreamlinePoint {
  return { xMeters: point.xMeters + direction.xMeters * scale, zMeters: point.zMeters + direction.zMeters * scale };
}

function distance(left: StreamlinePoint, right: StreamlinePoint): number {
  return Math.hypot(left.xMeters - right.xMeters, left.zMeters - right.zMeters);
}

function bilinear(a: number, b: number, c: number, d: number, tx: number, tz: number): number {
  return (a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + d * tx) * tz;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function validateDomain(domain: StreamlineDomain): void {
  if (!Number.isFinite(domain.widthMeters) || domain.widthMeters <= 0 || !Number.isFinite(domain.heightMeters) || domain.heightMeters <= 0) {
    throw new Error("The streamline domain must have positive finite dimensions.");
  }
  if (!Number.isInteger(domain.rows) || domain.rows < 1 || !Number.isInteger(domain.columns) || domain.columns < 1) {
    throw new Error("The streamline grid must have positive integer dimensions.");
  }
}

function validateOptions(options: StreamlineOptions): void {
  for (const [label, value] of Object.entries(options)) {
    if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be a finite number greater than zero.`);
    }
  }
  if (!Number.isInteger(options.maxSteps)) {
    throw new Error("maxSteps must be a positive integer.");
  }
}

function assertFinitePoint(point: StreamlinePoint, label: string): void {
  if (!Number.isFinite(point.xMeters) || !Number.isFinite(point.zMeters)) {
    throw new Error(`${label} must have finite coordinates.`);
  }
}
