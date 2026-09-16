/** Numerical tolerance for comparing heads with the aquifer-top elevation, in m. */
export const CONFINED_VALIDITY_TOLERANCE_METERS = 1e-9;

export type ConfinedValidityStatus = "VALID_CONFINED" | "OUTSIDE_CONFINED_RANGE";

/**
 * Validity level for presentation. The grid takes precedence because it
 * invalidates all derived outputs, whereas a well estimate affects only that
 * Peaceman post-processing.
 */
export type ConfinedValidityLevel = "valid" | "wellDegraded" | "meshInvalid";

export type WellConfinedValidityStatus = ConfinedValidityStatus | "NOT_EVALUATED";

export interface EstimatedWellHeadsMeters {
  wellA?: number;
  wellB?: number;
}

export interface ConfinedValidityInput {
  headsMeters: readonly (readonly number[])[];
  aquiferTopElevationMeters: number;
  estimatedWellHeadsMeters?: Readonly<EstimatedWellHeadsMeters>;
}

export interface WellConfinedValidity {
  status: WellConfinedValidityStatus;
  headMeters?: number;
  marginToAquiferTopMeters?: number;
  deficitBelowAquiferTopMeters?: number;
}

export interface ConfinedValidityResult {
  /** Classification precedence: meshInvalid > wellDegraded > valid. */
  level: ConfinedValidityLevel;
  /** Binary state retained for compatibility with existing consumers. */
  status: ConfinedValidityStatus;
  minimumGridHeadMeters: number;
  minimumMarginToAquiferTopMeters: number;
  cellsBelowAquiferTop: number;
  percentageCellsBelowAquiferTop: number;
  maximumGridDeficitBelowAquiferTopMeters: number;
  wellA: WellConfinedValidity;
  wellB: WellConfinedValidity;
}

/**
 * Evaluates whether a constant-transmissivity solution remains within the
 * domain of a fully confined aquifer. Does not modify received heads.
 */
export function evaluateConfinedModelValidity(
  input: Readonly<ConfinedValidityInput>,
): ConfinedValidityResult {
  const { headsMeters, aquiferTopElevationMeters, estimatedWellHeadsMeters } = input;
  assertFinite(aquiferTopElevationMeters, "La cota del techo del acuífero");
  validateHeadsMatrix(headsMeters);
  validateEstimatedWellHeads(estimatedWellHeadsMeters);

  let minimumGridHeadMeters = Number.POSITIVE_INFINITY;
  let cellsBelowAquiferTop = 0;
  let totalCells = 0;
  for (const row of headsMeters) {
    for (const headMeters of row) {
      totalCells += 1;
      minimumGridHeadMeters = Math.min(minimumGridHeadMeters, headMeters);
      if (isBelowAquiferTop(headMeters, aquiferTopElevationMeters)) {
        cellsBelowAquiferTop += 1;
      }
    }
  }

  const wellA = evaluateWell(estimatedWellHeadsMeters?.wellA, aquiferTopElevationMeters);
  const wellB = evaluateWell(estimatedWellHeadsMeters?.wellB, aquiferTopElevationMeters);
  const minimumMarginToAquiferTopMeters = minimumGridHeadMeters - aquiferTopElevationMeters;
  const maximumGridDeficitBelowAquiferTopMeters = Math.max(
    0,
    aquiferTopElevationMeters - minimumGridHeadMeters,
  );
  const level = classifyConfinedValidityLevel(cellsBelowAquiferTop, wellA, wellB);
  const status = level === "valid" ? "VALID_CONFINED" : "OUTSIDE_CONFINED_RANGE";

  return {
    level,
    status,
    minimumGridHeadMeters,
    minimumMarginToAquiferTopMeters,
    cellsBelowAquiferTop,
    percentageCellsBelowAquiferTop: (cellsBelowAquiferTop / totalCells) * 100,
    maximumGridDeficitBelowAquiferTopMeters,
    wellA,
    wellB,
  };
}

function classifyConfinedValidityLevel(
  cellsBelowAquiferTop: number,
  wellA: WellConfinedValidity,
  wellB: WellConfinedValidity,
): ConfinedValidityLevel {
  if (cellsBelowAquiferTop > 0) {
    return "meshInvalid";
  }
  if (
    wellA.status === "OUTSIDE_CONFINED_RANGE" ||
    wellB.status === "OUTSIDE_CONFINED_RANGE"
  ) {
    return "wellDegraded";
  }
  return "valid";
}

function evaluateWell(
  headMeters: number | undefined,
  aquiferTopElevationMeters: number,
): WellConfinedValidity {
  if (headMeters === undefined) {
    return { status: "NOT_EVALUATED" };
  }

  const marginToAquiferTopMeters = headMeters - aquiferTopElevationMeters;
  return {
    status: isBelowAquiferTop(headMeters, aquiferTopElevationMeters)
      ? "OUTSIDE_CONFINED_RANGE"
      : "VALID_CONFINED",
    headMeters,
    marginToAquiferTopMeters,
    deficitBelowAquiferTopMeters: Math.max(0, -marginToAquiferTopMeters),
  };
}

function isBelowAquiferTop(headMeters: number, aquiferTopElevationMeters: number): boolean {
  return headMeters < aquiferTopElevationMeters - CONFINED_VALIDITY_TOLERANCE_METERS;
}

function validateHeadsMatrix(headsMeters: readonly (readonly number[])[]): void {
  if (headsMeters.length === 0 || headsMeters[0].length === 0) {
    throw new Error("La matriz de cargas debe ser rectangular y no vacía.");
  }
  const columns = headsMeters[0].length;
  for (const row of headsMeters) {
    if (row.length !== columns) {
      throw new Error("La matriz de cargas debe ser rectangular.");
    }
    for (const headMeters of row) {
      assertFinite(headMeters, "Cada carga de la malla");
    }
  }
}

function validateEstimatedWellHeads(
  estimatedWellHeadsMeters: Readonly<EstimatedWellHeadsMeters> | undefined,
): void {
  if (!estimatedWellHeadsMeters) {
    return;
  }
  if (estimatedWellHeadsMeters.wellA !== undefined) {
    assertFinite(estimatedWellHeadsMeters.wellA, "La carga estimada del pozo A");
  }
  if (estimatedWellHeadsMeters.wellB !== undefined) {
    assertFinite(estimatedWellHeadsMeters.wellB, "La carga estimada del pozo B");
  }
}

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`${label} debe ser un número finito.`);
  }
}
