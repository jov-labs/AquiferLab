import {
  createDefaultModelInput,
  litersPerSecondToCubicMetersPerDay,
  metersPerDayToMetersPerSecond,
  metersPerDayToMillimetersPerYear,
  metersPerSecondToMetersPerDay,
  millimetersPerYearToMetersPerDay,
  solveGroundwater,
  type GroundwaterModelInput,
  type GroundwaterResult,
} from "./groundwater.js";
import { calculateDrawdown, type DrawdownResult } from "./drawdown.js";
import { calculateDarcyFlow } from "./flow.js";
import { createAquiferScene, getPositiveDrawdownColor } from "./scene.js";
import {
  calculateQualitativeStreamlines,
  createStreamlineSeeds,
  DEFAULT_STREAMLINE_OPTIONS,
  type StreamlineTarget,
} from "./streamlines.js";
import {
  estimateWellDrawdownMeters,
  estimateWellHeadMeters,
  type WellCorrectionParameters,
} from "./well-correction.js";
import {
  evaluateConfinedModelValidity,
  type EstimatedWellHeadsMeters,
} from "./confined-validity.js";

const REFERENCE_HEAD_METERS = 100;
const WELL_A = { row: 20, column: 20, label: "Pozo A" };
const WELL_B = { row: 28, column: 30, label: "Pozo B" };

const wellARate = getElement<HTMLInputElement>("well-a-rate");
const wellBRate = getElement<HTMLInputElement>("well-b-rate");
const wellAValue = getElement<HTMLOutputElement>("well-a-value");
const wellBValue = getElement<HTMLOutputElement>("well-b-value");
const wellARadius = getElement<HTMLInputElement>("well-a-radius");
const wellBRadius = getElement<HTMLInputElement>("well-b-radius");
const wellARadiusValue = getElement<HTMLOutputElement>("well-a-radius-value");
const wellBRadiusValue = getElement<HTMLOutputElement>("well-b-radius-value");
const status = getElement<HTMLElement>("result-status");
const iterations = getElement<HTMLElement>("result-iterations");
const minHead = getElement<HTMLElement>("result-min-head");
const maxHead = getElement<HTMLElement>("result-max-head");
const wellAHead = getElement<HTMLElement>("result-well-a-head");
const wellBHead = getElement<HTMLElement>("result-well-b-head");
const estimatedWellAHead = getElement<HTMLElement>("result-estimated-well-a-head");
const estimatedWellBHead = getElement<HTMLElement>("result-estimated-well-b-head");
const solverMessage = getElement<HTMLElement>("solver-message");
const darcyMax = getElement<HTMLElement>("result-darcy-max");
const maxDrawdown = getElement<HTMLElement>("result-max-drawdown");
const wellADrawdown = getElement<HTMLElement>("result-well-a-drawdown");
const wellBDrawdown = getElement<HTMLElement>("result-well-b-drawdown");
const estimatedWellADrawdown = getElement<HTMLElement>("result-estimated-well-a-drawdown");
const estimatedWellBDrawdown = getElement<HTMLElement>("result-estimated-well-b-drawdown");
const confinedValidityStatus = getElement<HTMLElement>("confined-validity-status");
const confinedValiditySummary = getElement<HTMLElement>("confined-validity-summary");
const confinedValidityWarnings = getElement<HTMLElement>("confined-validity-warnings");
const confinedValidityExtrapolation = getElement<HTMLElement>("confined-validity-extrapolation");
const publicResultSummary = getElement<HTMLElement>("public-result-summary");
const publicWellADrawdown = getElement<HTMLElement>("public-well-a-drawdown");
const publicWellBDrawdown = getElement<HTMLElement>("public-well-b-drawdown");
const publicModelWarning = getElement<HTMLElement>("public-model-warning");
const drawdownLegendMinimum = getElement<HTMLElement>("drawdown-legend-minimum");
const drawdownLegendZero = getElement<HTMLElement>("drawdown-legend-zero");
const drawdownLegendMaximum = getElement<HTMLElement>("drawdown-legend-maximum");
const drawdownScale = getElement<HTMLElement>("drawdown-scale");
const qualitativeStreamlinesToggle = getElement<HTMLInputElement>("show-qualitative-streamlines");
const geologicalCutToggle = getElement<HTMLInputElement>("enable-geological-cut");
const cutPosition = getElement<HTMLInputElement>("cut-position");
const cutPositionValue = getElement<HTMLOutputElement>("cut-position-value");
const hydraulicConductivityExponent = getElement<HTMLInputElement>("hydraulic-conductivity-exponent");
const hydraulicConductivityValue = getElement<HTMLOutputElement>("hydraulic-conductivity-value");
const recharge = getElement<HTMLInputElement>("recharge");
const rechargeValue = getElement<HTMLOutputElement>("recharge-value");
const aquiferThickness = getElement<HTMLInputElement>("aquifer-thickness");
const aquiferThicknessValue = getElement<HTMLOutputElement>("aquifer-thickness-value");
const riverHead = getElement<HTMLInputElement>("river-head");
const riverHeadValue = getElement<HTMLOutputElement>("river-head-value");
const aquiferTopElevation = getElement<HTMLInputElement>("aquifer-top-elevation");
const welcomeDialog = getElement<HTMLDialogElement>("welcome-dialog");
const homeButton = getElement<HTMLButtonElement>("home-button");

homeButton.addEventListener("click", () => {
  welcomeDialog.show();
});

const baseInput = createDefaultModelInput();
initializeParameterControls(baseInput);
const scene = createAquiferScene(
  getElement<HTMLElement>("scene-container"),
  {
    widthMeters: baseInput.widthMeters,
    heightMeters: baseInput.heightMeters,
    rows: baseInput.rows,
    columns: baseInput.columns,
  },
  [WELL_A, WELL_B],
);

interface LastWellMetricState {
  input: GroundwaterModelInput;
  result: GroundwaterResult;
  drawdown: DrawdownResult;
}

let lastWellMetricState: LastWellMetricState | null = null;

function getElement<ElementType extends HTMLElement>(id: string): ElementType {
  const element = document.getElementById(id);
  if (!(element instanceof HTMLElement)) {
    throw new Error(`No se encontró el elemento de interfaz #${id}.`);
  }
  return element as ElementType;
}

function currentInput(): GroundwaterModelInput {
  const defaultInput = createDefaultModelInput();
  const hydraulicConductivityMetersPerSecond = 10 ** Number(hydraulicConductivityExponent.value);
  return {
    ...defaultInput,
    hydraulicConductivityMetersPerDay: metersPerSecondToMetersPerDay(
      hydraulicConductivityMetersPerSecond,
    ),
    rechargeMetersPerDay: millimetersPerYearToMetersPerDay(Number(recharge.value)),
    thicknessMeters: Number(aquiferThickness.value),
    fixedHeadCells: defaultInput.fixedHeadCells.map((cell) => ({
      ...cell,
      headMeters: Number(riverHead.value),
    })),
    wells: [
      {
        row: WELL_A.row,
        column: WELL_A.column,
        rateCubicMetersPerDay: litersPerSecondToCubicMetersPerDay(Number(wellARate.value)),
      },
      {
        row: WELL_B.row,
        column: WELL_B.column,
        rateCubicMetersPerDay: litersPerSecondToCubicMetersPerDay(Number(wellBRate.value)),
      },
    ],
  };
}

function referenceInput(actualInput: GroundwaterModelInput): GroundwaterModelInput {
  return {
    ...actualInput,
    wells: actualInput.wells.map((well) => ({
      ...well,
      rateCubicMetersPerDay: 0,
    })),
  };
}

function updateSliderLabels(): void {
  wellAValue.value = `${wellARate.value} l/s`;
  wellBValue.value = `${wellBRate.value} l/s`;
}

function updateWellRadiusLabels(): void {
  wellARadiusValue.value = `${Number(wellARadius.value).toFixed(2)} m`;
  wellBRadiusValue.value = `${Number(wellBRadius.value).toFixed(2)} m`;
}

function initializeParameterControls(defaultInput: GroundwaterModelInput): void {
  hydraulicConductivityExponent.value = String(
    Math.log10(metersPerDayToMetersPerSecond(defaultInput.hydraulicConductivityMetersPerDay)),
  );
  recharge.value = String(metersPerDayToMillimetersPerYear(defaultInput.rechargeMetersPerDay));
  aquiferThickness.value = String(defaultInput.thicknessMeters);
  riverHead.value = String(defaultInput.fixedHeadCells[0].headMeters);
  updateParameterLabels();
}

function updateParameterLabels(): void {
  const exponent = Number(hydraulicConductivityExponent.value);
  hydraulicConductivityValue.value = `K = ${formatScientific(10 ** exponent)} m/s`;
  rechargeValue.value = `${recharge.value} mm/año`;
  aquiferThicknessValue.value = `${aquiferThickness.value} m`;
  riverHeadValue.value = `${riverHead.value} m`;
}

function formatScientific(value: number): string {
  const exponent = Math.floor(Math.log10(value));
  const coefficient = value / 10 ** exponent;
  return `${coefficient.toFixed(2)} × 10${toSuperscript(exponent)}`;
}

function toSuperscript(value: number): string {
  const digits: Record<string, string> = {
    "-": "⁻",
    "0": "⁰",
    "1": "¹",
    "2": "²",
    "3": "³",
    "4": "⁴",
    "5": "⁵",
    "6": "⁶",
    "7": "⁷",
    "8": "⁸",
    "9": "⁹",
  };
  return String(value)
    .split("")
    .map((digit) => digits[digit])
    .join("");
}

function recalculate(): void {
  const actualInput = currentInput();
  const referenceInputForScenario = referenceInput(actualInput);
  let referenceResult: GroundwaterResult;
  let actualResult: GroundwaterResult;
  let drawdown: DrawdownResult;
  try {
    referenceResult = solveGroundwater(referenceInputForScenario);
    actualResult = solveGroundwater(actualInput);
    if (
      !referenceResult.converged ||
      !referenceResult.isValid ||
      !actualResult.converged ||
      !actualResult.isValid
    ) {
      showNoConvergence("El escenario de referencia o el actual no es válido; se conserva la última superficie válida.");
      return;
    }
    drawdown = calculateDrawdown(referenceResult.headsMeters, actualResult.headsMeters);
  } catch (error) {
    showNoConvergence(error instanceof Error ? error.message : "Error del solver.");
    return;
  }

  const darcyFlow = calculateDarcyFlow(actualInput, actualResult.headsMeters);
  const streamlineDomain = {
    widthMeters: actualInput.widthMeters,
    heightMeters: actualInput.heightMeters,
    rows: actualInput.rows,
    columns: actualInput.columns,
  };
  const qualitativeStreamlines = calculateQualitativeStreamlines({
    domain: streamlineDomain,
    field: darcyFlow,
    seeds: createStreamlineSeeds(streamlineDomain, 7, 7),
    targets: streamlineTargets(actualInput),
    options: DEFAULT_STREAMLINE_OPTIONS,
  });
  scene.updatePiezometricSurface({
    headsMeters: actualResult.headsMeters,
    drawdownMeters: drawdown.drawdownMeters,
    referenceHeadMeters: REFERENCE_HEAD_METERS,
  });
  scene.updateDarcyFlow({
    field: darcyFlow,
    headsMeters: actualResult.headsMeters,
    referenceHeadMeters: REFERENCE_HEAD_METERS,
  });
  scene.updateQualitativeStreamlines({
    lines: qualitativeStreamlines,
    headsMeters: actualResult.headsMeters,
    referenceHeadMeters: REFERENCE_HEAD_METERS,
  });
  showResult(actualInput, actualResult, darcyFlow.maxMagnitudeMetersPerDay, drawdown);
  updateDrawdownLegend(drawdown.drawdownMeters);
}

function streamlineTargets(input: GroundwaterModelInput): StreamlineTarget[] {
  const dx = input.widthMeters / input.columns;
  const dz = input.heightMeters / input.rows;
  const toPoint = (row: number, column: number) => ({
    xMeters: (column + 0.5) * dx,
    zMeters: (row + 0.5) * dz,
  });
  return [
    ...input.fixedHeadCells.map((cell) => ({ ...toPoint(cell.row, cell.column), kind: "river" as const })),
    ...input.wells
      .filter((well) => well.rateCubicMetersPerDay > 0)
      .map((well) => ({ ...toPoint(well.row, well.column), kind: "well" as const })),
  ];
}

function showResult(
  input: GroundwaterModelInput,
  result: GroundwaterResult,
  maxDarcyMetersPerDay: number,
  drawdown: DrawdownResult,
): void {
  status.textContent = "Convergió";
  status.dataset.status = "valid";
  iterations.textContent = String(result.iterations);
  minHead.textContent = formatMeters(result.minHeadMeters);
  maxHead.textContent = formatMeters(result.maxHeadMeters);
  wellAHead.textContent = formatMeters(result.headsMeters[WELL_A.row][WELL_A.column]);
  wellBHead.textContent = formatMeters(result.headsMeters[WELL_B.row][WELL_B.column]);
  darcyMax.textContent = formatMetersPerDay(maxDarcyMetersPerDay);
  maxDrawdown.textContent = formatDrawdownMeters(drawdown.maxDrawdownMeters);
  wellADrawdown.textContent = formatDrawdownMeters(drawdown.drawdownMeters[WELL_A.row][WELL_A.column]);
  wellBDrawdown.textContent = formatDrawdownMeters(drawdown.drawdownMeters[WELL_B.row][WELL_B.column]);
  lastWellMetricState = { input, result, drawdown };
  updateEstimatedWellMetrics();
  solverMessage.textContent = "";
}

function correctionParameters(
  input: GroundwaterModelInput,
  wellIndex: number,
  wellRadiusMeters: number,
): WellCorrectionParameters {
  return {
    cellWidthMeters: input.widthMeters / input.columns,
    cellHeightMeters: input.heightMeters / input.rows,
    hydraulicConductivityMetersPerDay: input.hydraulicConductivityMetersPerDay,
    thicknessMeters: input.thicknessMeters,
    extractionRateCubicMetersPerDay: input.wells[wellIndex].rateCubicMetersPerDay,
    wellRadiusMeters,
  };
}

function updateEstimatedWellMetrics(): void {
  if (!lastWellMetricState) {
    return;
  }
  const { input, result, drawdown } = lastWellMetricState;
  const estimatedHeads = calculateEstimatedWellHeads(input, result);
  const parametersA = correctionParameters(input, 0, Number(wellARadius.value));
  const parametersB = correctionParameters(input, 1, Number(wellBRadius.value));
  const estimatedDrawdownA = estimateWellDrawdownMeters(
    drawdown.drawdownMeters[WELL_A.row][WELL_A.column],
    parametersA,
  );
  const estimatedDrawdownB = estimateWellDrawdownMeters(
    drawdown.drawdownMeters[WELL_B.row][WELL_B.column],
    parametersB,
  );

  estimatedWellAHead.textContent = formatMeters(estimatedHeads.wellA);
  estimatedWellBHead.textContent = formatMeters(estimatedHeads.wellB);
  estimatedWellADrawdown.textContent = formatDrawdownMeters(estimatedDrawdownA);
  estimatedWellBDrawdown.textContent = formatDrawdownMeters(estimatedDrawdownB);

  publicWellADrawdown.textContent = `Descenso estimado: ${formatDrawdownMeters(estimatedDrawdownA)}`;
  publicWellBDrawdown.textContent = `Descenso estimado: ${formatDrawdownMeters(estimatedDrawdownB)}`;

  const hasPumping = input.wells.some((well) => well.rateCubicMetersPerDay > 0);
  publicResultSummary.textContent = hasPumping
    ? "El bombeo simulado hace descender el nivel del agua."
    : "No hay bombeo en este escenario, por lo que el nivel del agua no desciende por extracción.";

  updateConfinedValidity(estimatedHeads);
}

function calculateEstimatedWellHeads(
  input: GroundwaterModelInput,
  result: GroundwaterResult,
): Required<EstimatedWellHeadsMeters> {
  const parametersA = correctionParameters(input, 0, Number(wellARadius.value));
  const parametersB = correctionParameters(input, 1, Number(wellBRadius.value));
  return {
    wellA: estimateWellHeadMeters(result.headsMeters[WELL_A.row][WELL_A.column], parametersA),
    wellB: estimateWellHeadMeters(result.headsMeters[WELL_B.row][WELL_B.column], parametersB),
  };
}

function updateConfinedValidity(estimatedHeads?: Required<EstimatedWellHeadsMeters>): void {
  if (!lastWellMetricState) {
    return;
  }
  try {
    const { input, result } = lastWellMetricState;
    const validity = evaluateConfinedModelValidity({
      headsMeters: result.headsMeters,
      aquiferTopElevationMeters: aquiferTopElevation.valueAsNumber,
      estimatedWellHeadsMeters: estimatedHeads ?? calculateEstimatedWellHeads(input, result),
    });
    showConfinedValidity(validity);
  } catch (error) {
    confinedValidityStatus.textContent = "Cota inválida";
    confinedValidityStatus.dataset.status = "invalid";
    confinedValiditySummary.textContent =
      error instanceof Error ? error.message : "No se pudo evaluar la validez del modelo confinado.";
    confinedValidityWarnings.textContent = "";
    confinedValidityExtrapolation.hidden = true;
    publicModelWarning.textContent =
      "No se pudo comprobar si este escenario está dentro de los límites del modelo simple.";
  }
}

function showConfinedValidity(
  validity: ReturnType<typeof evaluateConfinedModelValidity>,
): void {
  const isValid = validity.status === "VALID_CONFINED";
  confinedValidityStatus.textContent = isValid ? "Válido" : "Fuera de rango";
  confinedValidityStatus.dataset.status = isValid ? "valid" : "invalid";
  confinedValidityExtrapolation.hidden = isValid;
  if (isValid) {
    confinedValiditySummary.textContent =
      "Todas las cargas de malla y las estimaciones dentro de los pozos permanecen sobre el techo del acuífero.";
    confinedValidityWarnings.textContent = "";
    publicModelWarning.textContent = "";
    return;
  }

  if (validity.cellsBelowAquiferTop > 0) {
    publicModelWarning.textContent =
      "⚠ Parte del acuífero modelado salió del rango que este modelo simple puede representar correctamente.";
  } else {
    const affectedWells = [
      validity.wellA.status === "OUTSIDE_CONFINED_RANGE" ? "A" : null,
      validity.wellB.status === "OUTSIDE_CONFINED_RANGE" ? "B" : null,
    ].filter((label): label is string => label !== null);

    publicModelWarning.textContent =
      affectedWells.length > 0
        ? `⚠ La estimación dentro del pozo ${affectedWells.join(
            " y ",
          )} queda fuera del rango que este modelo simple puede representar con fiabilidad. El acuífero mostrado alrededor todavía permanece dentro del rango confinado.`
        : "";
  }

  confinedValiditySummary.textContent =
    `El solver convergió, pero la carga cayó bajo el techo del acuífero. ` +
    `${validity.cellsBelowAquiferTop} celdas afectadas (${validity.percentageCellsBelowAquiferTop.toFixed(2)} %). ` +
    `Déficit máximo de malla: ${formatMeters(validity.maximumGridDeficitBelowAquiferTopMeters)}.`;
  const wellWarnings = [
    confinedWellWarning("A", validity.wellA),
    confinedWellWarning("B", validity.wellB),
  ].filter((warning): warning is string => warning !== null);
  confinedValidityWarnings.textContent = wellWarnings.join(" ");
}

function confinedWellWarning(
  label: string,
  well: ReturnType<typeof evaluateConfinedModelValidity>["wellA"],
): string | null {
  if (well.status !== "OUTSIDE_CONFINED_RANGE") {
    return null;
  }
  return (
    `Pozo ${label}: carga estimada ${formatMeters(well.headMeters!)}; ` +
    `déficit respecto al techo ${formatMeters(well.deficitBelowAquiferTopMeters!)}.`
  );
}

function clearEstimatedWellMetrics(): void {
  estimatedWellAHead.textContent = "—";
  estimatedWellBHead.textContent = "—";
  estimatedWellADrawdown.textContent = "—";
  estimatedWellBDrawdown.textContent = "—";
  publicWellADrawdown.textContent = "—";
  publicWellBDrawdown.textContent = "—";
}

function clearConfinedValidity(): void {
  confinedValidityStatus.textContent = "—";
  confinedValidityStatus.dataset.status = "pending";
  confinedValiditySummary.textContent = "";
  confinedValidityWarnings.textContent = "";
  confinedValidityExtrapolation.hidden = true;
}

function updateDrawdownLegend(drawdownMeters: readonly (readonly number[])[]): void {
  let minimumDrawdownMeters = Number.POSITIVE_INFINITY;
  let maximumDrawdownMeters = Number.NEGATIVE_INFINITY;
  for (const row of drawdownMeters) {
    for (const drawdown of row) {
      minimumDrawdownMeters = Math.min(minimumDrawdownMeters, drawdown);
      maximumDrawdownMeters = Math.max(maximumDrawdownMeters, drawdown);
    }
  }
  drawdownLegendMinimum.textContent = formatDrawdownMeters(minimumDrawdownMeters);
  drawdownLegendMaximum.textContent = formatDrawdownMeters(maximumDrawdownMeters);
  drawdownLegendZero.hidden = minimumDrawdownMeters >= 0;
  drawdownLegendZero.textContent = "0.0 m";
  if (minimumDrawdownMeters >= 0) {
    drawdownScale.style.background = positiveDrawdownLegendGradient(
      minimumDrawdownMeters,
      maximumDrawdownMeters,
    );
  }
}

function positiveDrawdownLegendGradient(
  minimumDrawdownMeters: number,
  maximumDrawdownMeters: number,
): string {
  const steps = 12;
  const stops: string[] = [];
  for (let index = 0; index <= steps; index += 1) {
    const normalized = index / steps;
    const color = getPositiveDrawdownColor(
      minimumDrawdownMeters + normalized * (maximumDrawdownMeters - minimumDrawdownMeters),
      minimumDrawdownMeters,
      maximumDrawdownMeters,
    );
    stops.push(`#${color.getHexString()} ${normalized * 100}%`);
  }
  return `linear-gradient(90deg, ${stops.join(", ")})`;
}

function showNoConvergence(message: string): void {
  lastWellMetricState = null;
  status.textContent = "NO CONVERGIÓ";
  status.dataset.status = "invalid";
  iterations.textContent = "—";
  minHead.textContent = "—";
  maxHead.textContent = "—";
  wellAHead.textContent = "—";
  wellBHead.textContent = "—";
  darcyMax.textContent = "—";
  maxDrawdown.textContent = "—";
  wellADrawdown.textContent = "—";
  wellBDrawdown.textContent = "—";
  clearEstimatedWellMetrics();
  clearConfinedValidity();
  publicResultSummary.textContent = "No se pudo calcular este escenario.";
  publicModelWarning.textContent =
    "Revisa los datos del escenario antes de interpretar los resultados.";
  drawdownLegendMinimum.textContent = "—";
  drawdownLegendMaximum.textContent = "—";
  drawdownLegendZero.hidden = true;
  solverMessage.textContent = message;
}

function formatMeters(value: number): string {
  return `${value.toFixed(3)} m`;
}

function formatDrawdownMeters(value: number): string {
  return `${value.toFixed(1)} m`;
}

function formatMetersPerDay(value: number): string {
  return `${value.toFixed(4)} m/día`;
}

for (const slider of [wellARate, wellBRate]) {
  slider.addEventListener("input", updateSliderLabels);
  // change se dispara al confirmar el valor, evitando solves por cada paso del arrastre.
  slider.addEventListener("change", recalculate);
}

for (const radiusControl of [wellARadius, wellBRadius]) {
  radiusControl.addEventListener("input", () => {
    updateWellRadiusLabels();
    updateEstimatedWellMetrics();
  });
}

aquiferTopElevation.addEventListener("input", () => {
  // La cota sólo reclasifica la última solución; no interviene en recalculate().
  updateConfinedValidity();
});

for (const parameterControl of [
  hydraulicConductivityExponent,
  recharge,
  aquiferThickness,
  riverHead,
]) {
  parameterControl.addEventListener("input", updateParameterLabels);
  parameterControl.addEventListener("change", recalculate);
}

qualitativeStreamlinesToggle.addEventListener("change", () => {
  scene.setQualitativeStreamlinesVisible(qualitativeStreamlinesToggle.checked);
});

function updateGeologicalCut(): void {
  cutPositionValue.value = `${cutPosition.value} %`;
  cutPosition.disabled = !geologicalCutToggle.checked;
  scene.setGeologicalCut(geologicalCutToggle.checked, Number(cutPosition.value));
}

geologicalCutToggle.addEventListener("change", updateGeologicalCut);
cutPosition.addEventListener("input", updateGeologicalCut);

updateSliderLabels();
updateWellRadiusLabels();
scene.setQualitativeStreamlinesVisible(qualitativeStreamlinesToggle.checked);
updateGeologicalCut();
recalculate();
