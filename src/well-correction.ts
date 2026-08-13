export interface WellCorrectionParameters {
  cellWidthMeters: number;
  cellHeightMeters: number;
  hydraulicConductivityMetersPerDay: number;
  thicknessMeters: number;
  extractionRateCubicMetersPerDay: number;
  wellRadiusMeters: number;
}

/** Radio equivalente de Peaceman para el modelo isotrópico actual. */
export function calculatePeacemanEquivalentRadiusMeters(
  cellWidthMeters: number,
  cellHeightMeters: number,
): number {
  assertPositiveFinite(cellWidthMeters, "Δx");
  assertPositiveFinite(cellHeightMeters, "Δz");
  const equivalentRadiusMeters = 0.14 * Math.hypot(cellWidthMeters, cellHeightMeters);
  assertPositiveFinite(equivalentRadiusMeters, "El radio equivalente de Peaceman");
  return equivalentRadiusMeters;
}

/** Pérdida logarítmica desde la carga representativa de celda hasta el radio del pozo. */
export function calculateCellToWellHeadLossMeters(
  parameters: Readonly<WellCorrectionParameters>,
): number {
  const equivalentRadiusMeters = calculatePeacemanEquivalentRadiusMeters(
    parameters.cellWidthMeters,
    parameters.cellHeightMeters,
  );
  assertPositiveFinite(
    parameters.hydraulicConductivityMetersPerDay,
    "La conductividad hidráulica",
  );
  assertPositiveFinite(parameters.thicknessMeters, "El espesor");
  assertNonNegativeFinite(parameters.extractionRateCubicMetersPerDay, "El bombeo");
  assertPositiveFinite(parameters.wellRadiusMeters, "El radio del pozo");
  if (parameters.wellRadiusMeters >= equivalentRadiusMeters) {
    throw new Error("El radio del pozo debe ser menor que el radio equivalente de Peaceman.");
  }

  const transmissivitySquareMetersPerDay =
    parameters.hydraulicConductivityMetersPerDay * parameters.thicknessMeters;
  assertPositiveFinite(transmissivitySquareMetersPerDay, "La transmisividad");
  if (parameters.extractionRateCubicMetersPerDay === 0) {
    return 0;
  }

  const headLossMeters =
    (parameters.extractionRateCubicMetersPerDay /
      (2 * Math.PI * transmissivitySquareMetersPerDay)) *
    Math.log(equivalentRadiusMeters / parameters.wellRadiusMeters);
  assertFinite(headLossMeters, "La pérdida celda-pozo");
  return headLossMeters;
}

export function estimateWellHeadMeters(
  cellHeadMeters: number,
  parameters: Readonly<WellCorrectionParameters>,
): number {
  assertFinite(cellHeadMeters, "La carga de la celda");
  const wellHeadMeters = cellHeadMeters - calculateCellToWellHeadLossMeters(parameters);
  assertFinite(wellHeadMeters, "La carga estimada del pozo");
  return wellHeadMeters;
}

export function estimateWellDrawdownMeters(
  cellDrawdownMeters: number,
  parameters: Readonly<WellCorrectionParameters>,
): number {
  assertFinite(cellDrawdownMeters, "El abatimiento de la celda");
  const wellDrawdownMeters = cellDrawdownMeters + calculateCellToWellHeadLossMeters(parameters);
  assertFinite(wellDrawdownMeters, "El abatimiento estimado del pozo");
  return wellDrawdownMeters;
}

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`${label} debe ser un número finito.`);
  }
}

function assertPositiveFinite(value: number, label: string): void {
  assertFinite(value, label);
  if (value <= 0) {
    throw new Error(`${label} debe ser mayor que cero.`);
  }
}

function assertNonNegativeFinite(value: number, label: string): void {
  assertFinite(value, label);
  if (value < 0) {
    throw new Error(`${label} no puede ser negativo.`);
  }
}
