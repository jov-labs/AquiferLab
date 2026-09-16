export interface WellCorrectionParameters {
  cellWidthMeters: number;
  cellHeightMeters: number;
  hydraulicConductivityMetersPerDay: number;
  thicknessMeters: number;
  extractionRateCubicMetersPerDay: number;
  wellRadiusMeters: number;
}

/** Peaceman equivalent radius for the current isotropic model. */
export function calculatePeacemanEquivalentRadiusMeters(
  cellWidthMeters: number,
  cellHeightMeters: number,
): number {
  assertPositiveFinite(cellWidthMeters, "Δx");
  assertPositiveFinite(cellHeightMeters, "Δz");
  const equivalentRadiusMeters = 0.14 * Math.hypot(cellWidthMeters, cellHeightMeters);
  assertPositiveFinite(equivalentRadiusMeters, "Peaceman equivalent radius");
  return equivalentRadiusMeters;
}

/** Logarithmic loss from representative cell head to well radius. */
export function calculateCellToWellHeadLossMeters(
  parameters: Readonly<WellCorrectionParameters>,
): number {
  const equivalentRadiusMeters = calculatePeacemanEquivalentRadiusMeters(
    parameters.cellWidthMeters,
    parameters.cellHeightMeters,
  );
  assertPositiveFinite(
    parameters.hydraulicConductivityMetersPerDay,
    "Hydraulic conductivity",
  );
  assertPositiveFinite(parameters.thicknessMeters, "Thickness");
  assertNonNegativeFinite(parameters.extractionRateCubicMetersPerDay, "Pumping rate");
  assertPositiveFinite(parameters.wellRadiusMeters, "Well radius");
  if (parameters.wellRadiusMeters >= equivalentRadiusMeters) {
    throw new Error("Well radius must be smaller than the Peaceman equivalent radius.");
  }

  const transmissivitySquareMetersPerDay =
    parameters.hydraulicConductivityMetersPerDay * parameters.thicknessMeters;
  assertPositiveFinite(transmissivitySquareMetersPerDay, "Transmissivity");
  if (parameters.extractionRateCubicMetersPerDay === 0) {
    return 0;
  }

  const headLossMeters =
    (parameters.extractionRateCubicMetersPerDay /
      (2 * Math.PI * transmissivitySquareMetersPerDay)) *
    Math.log(equivalentRadiusMeters / parameters.wellRadiusMeters);
  assertFinite(headLossMeters, "Cell-to-well head loss");
  return headLossMeters;
}

export function estimateWellHeadMeters(
  cellHeadMeters: number,
  parameters: Readonly<WellCorrectionParameters>,
): number {
  assertFinite(cellHeadMeters, "Cell head");
  const wellHeadMeters = cellHeadMeters - calculateCellToWellHeadLossMeters(parameters);
  assertFinite(wellHeadMeters, "Estimated well head");
  return wellHeadMeters;
}

export function estimateWellDrawdownMeters(
  cellDrawdownMeters: number,
  parameters: Readonly<WellCorrectionParameters>,
): number {
  assertFinite(cellDrawdownMeters, "Cell drawdown");
  const wellDrawdownMeters = cellDrawdownMeters + calculateCellToWellHeadLossMeters(parameters);
  assertFinite(wellDrawdownMeters, "Estimated well drawdown");
  return wellDrawdownMeters;
}

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number.`);
  }
}

function assertPositiveFinite(value: number, label: string): void {
  assertFinite(value, label);
  if (value <= 0) {
    throw new Error(`${label} must be greater than zero.`);
  }
}

function assertNonNegativeFinite(value: number, label: string): void {
  assertFinite(value, label);
  if (value < 0) {
    throw new Error(`${label} cannot be negative.`);
  }
}
