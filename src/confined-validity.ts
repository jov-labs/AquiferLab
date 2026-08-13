/** Tolerancia numérica para comparar cargas con la cota del techo, en m. */
export const CONFINED_VALIDITY_TOLERANCE_METERS = 1e-9;

export type ConfinedValidityStatus = "VALID_CONFINED" | "OUTSIDE_CONFINED_RANGE";

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
 * Evalúa si una solución de transmisividad constante permanece en el dominio
 * de un acuífero completamente confinado. No modifica las cargas recibidas.
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
  const status =
    cellsBelowAquiferTop > 0 ||
    wellA.status === "OUTSIDE_CONFINED_RANGE" ||
    wellB.status === "OUTSIDE_CONFINED_RANGE"
      ? "OUTSIDE_CONFINED_RANGE"
      : "VALID_CONFINED";

  return {
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
