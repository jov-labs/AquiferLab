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
import { getConfinedPresentationState } from "./confined-presentation.js";
import { gridCellCenterMeters } from "./grid-coordinates.js";
import { createHelpInterface } from "./help-ui.js";
import { getLanguage, setLanguage, t } from "./i18n.js";
import {
  createScenarioTableInterface,
  type ScenarioTableInterface,
} from "./scenario-table-ui.js";
import { getScenarioVisualState } from "./scenario-visual.js";
import type { Scenario } from "./scenarios.js";

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
const meshInvalidCard = getElement<HTMLElement>("mesh-invalid-card");
const meshInvalidCardTitle = getElement<HTMLElement>("mesh-invalid-card-title");
const meshInvalidCardDescription = getElement<HTMLElement>("mesh-invalid-card-description");
const meshInvalidCardAction = getElement<HTMLElement>("mesh-invalid-card-action");
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
const riverLevelLegend = getElement<HTMLElement>("river-level-legend");
const aquiferTopElevation = getElement<HTMLInputElement>("aquifer-top-elevation");
const languageEs = getElement<HTMLButtonElement>("language-es");
const languageEn = getElement<HTMLButtonElement>("language-en");
const welcomeCopy = getElement<HTMLElement>("welcome-copy");
const welcomeStart = getElement<HTMLButtonElement>("welcome-start");
const welcomeDialog = getElement<HTMLDialogElement>("welcome-dialog");
const homeButton = getElement<HTMLButtonElement>("home-button");
const publicControlsCopy = getElement<HTMLElement>("public-controls-copy");
const publicPumpingA = getElement<HTMLElement>("public-pumping-a");
const publicPumpingB = getElement<HTMLElement>("public-pumping-b");
const publicDrawdownTitle = getElement<HTMLElement>("public-drawdown-title");
const technicalControlsSummary = getElement<HTMLElement>("technical-controls-summary");
const sceneHint = getElement<HTMLElement>("scene-hint");
const currentSolutionLabel = getElement<HTMLElement>("current-solution-label");
const resultsTitle = getElement<HTMLElement>("results-title");
const publicResultTitle = getElement<HTMLElement>("public-result-title");
const publicWellALabel = getElement<HTMLElement>("public-well-a-label");
const publicWellBLabel = getElement<HTMLElement>("public-well-b-label");
const publicWellNote = getElement<HTMLElement>("public-well-note");

homeButton.addEventListener("click", () => {
  welcomeDialog.show();
});

const qualitativeFlowLabel = getElement<HTMLElement>("qualitative-flow-label");
const geologicalCutLabel = getElement<HTMLElement>("geological-cut-label");
const cutPositionLabel = getElement<HTMLElement>("cut-position-label");
const parameterTitle = getElement<HTMLElement>("parameter-title");
const hydraulicConductivityLabel = getElement<HTMLElement>("hydraulic-conductivity-label");
const rechargeLabel = getElement<HTMLElement>("recharge-label");
const aquiferThicknessLabel = getElement<HTMLElement>("aquifer-thickness-label");
const riverHeadLabel = getElement<HTMLElement>("river-head-label");
const aquiferTopElevationLabel = getElement<HTMLElement>("aquifer-top-elevation-label");
const meshResolutionLabel = getElement<HTMLElement>("mesh-resolution-label");
const maximumIterationsLabel = getElement<HTMLElement>("maximum-iterations-label");
const solverToleranceLabel = getElement<HTMLElement>("solver-tolerance-label");

const hydraulicBlockNote = getElement<HTMLElement>("hydraulic-block-note");
const aquiferTopNote = getElement<HTMLElement>("aquifer-top-note");
const piezometricSurfaceLabel = getElement<HTMLElement>("piezometric-surface-label");
const qualitativeFlowLegend = getElement<HTMLElement>("qualitative-flow-legend");
const confinedAquiferLegend = getElement<HTMLElement>("confined-aquifer-legend");
const visualContextNote = getElement<HTMLElement>("visual-context-note");
const piezometricReference = getElement<HTMLElement>("piezometric-reference");
const arrowScaleNote = getElement<HTMLElement>("arrow-scale-note");
const darcyDirectionNote = getElement<HTMLElement>("darcy-direction-note");
const darcyArrowsLabel = getElement<HTMLElement>("darcy-arrows-label");
const geologicalCutNote = getElement<HTMLElement>("geological-cut-note");

const wellRadiusALabel = getElement<HTMLElement>("well-radius-a-label");
const wellRadiusBLabel = getElement<HTMLElement>("well-radius-b-label");
const technicalResultsSummary = getElement<HTMLElement>("technical-results-summary");
const metricStatusLabel = getElement<HTMLElement>("metric-status-label");
const metricIterationsLabel = getElement<HTMLElement>("metric-iterations-label");
const metricMinHeadLabel = getElement<HTMLElement>("metric-min-head-label");
const metricMaxHeadLabel = getElement<HTMLElement>("metric-max-head-label");
const metricHeadALabel = getElement<HTMLElement>("metric-head-a-label");
const metricHeadBLabel = getElement<HTMLElement>("metric-head-b-label");
const metricEstimatedHeadALabel = getElement<HTMLElement>("metric-estimated-head-a-label");
const metricEstimatedHeadBLabel = getElement<HTMLElement>("metric-estimated-head-b-label");
const metricDarcyLabel = getElement<HTMLElement>("metric-darcy-label");
const metricMaxDrawdownLabel = getElement<HTMLElement>("metric-max-drawdown-label");
const metricDrawdownALabel = getElement<HTMLElement>("metric-drawdown-a-label");
const metricDrawdownBLabel = getElement<HTMLElement>("metric-drawdown-b-label");
const metricEstimatedDrawdownALabel = getElement<HTMLElement>("metric-estimated-drawdown-a-label");
const metricEstimatedDrawdownBLabel = getElement<HTMLElement>("metric-estimated-drawdown-b-label");
const peacemanNote = getElement<HTMLElement>("peaceman-note");
const helpInterface = createHelpInterface();
let scenarioTableInterface: ScenarioTableInterface | null = null;

function updateLanguageToggle(): void {
  const language = getLanguage();
  setLanguage(language);
  languageEs.dataset.active = language === "es" ? "true" : "false";
  languageEn.dataset.active = language === "en" ? "true" : "false";
  welcomeCopy.textContent = `${t("intro")} ${t("noKnowledge")}`;
  welcomeStart.textContent = t("start");
  homeButton.textContent = t("home");
  publicControlsCopy.textContent = t("controlsIntro");
  publicPumpingA.textContent = t("pumpingA");
  publicPumpingB.textContent = t("pumpingB");
  publicDrawdownTitle.textContent = t("drawdownAquifer");
  technicalControlsSummary.textContent = t("technicalControls");
  sceneHint.textContent = t("sceneHint");
  currentSolutionLabel.textContent = t("currentSolution");
  resultsTitle.textContent = t("whatHappens");
  publicResultTitle.textContent = t("scenarioResult");
  publicWellALabel.textContent = t("wellA");
  publicWellBLabel.textContent = t("wellB");
  publicWellNote.textContent = t("insideWellNote");

  qualitativeFlowLabel.textContent = t("qualitativeFlow");
  geologicalCutLabel.textContent = t("geologicalCut");
  cutPositionLabel.textContent = t("cutPosition");
  parameterTitle.textContent = t("aquiferParameters");
  hydraulicConductivityLabel.textContent = t("hydraulicConductivity");
  rechargeLabel.textContent = t("recharge");
  aquiferThicknessLabel.textContent = t("aquiferThickness");
  riverHeadLabel.textContent = t("riverHead");
  aquiferTopElevationLabel.textContent = t("aquiferTopElevation");
  meshResolutionLabel.textContent = t("meshResolution");
  maximumIterationsLabel.textContent = t("maximumIterations");
  solverToleranceLabel.textContent = t("solverTolerance");
  hydraulicBlockNote.textContent = t("hydraulicBlockNote");
  aquiferTopNote.textContent = t("aquiferTopNote");
  setTextWithAtomicSuffix(
    riverLevelLegend,
    t("riverLevel")(riverHead.value),
    `${riverHead.value} m`,
  );
  piezometricSurfaceLabel.textContent = t("piezometricSurface");
  qualitativeFlowLegend.textContent = t("qualitativeFlowLegend");
  confinedAquiferLegend.textContent = t("confinedAquiferLegend");
  visualContextNote.textContent = t("visualContextNote");
  setTextWithAtomicSuffix(
    piezometricReference,
    t("piezometricReference"),
    "h = 100 m",
  );
  arrowScaleNote.textContent = t("arrowScaleNote");
  darcyDirectionNote.textContent = t("darcyDirectionNote");
  darcyArrowsLabel.textContent = t("darcyArrows");
  geologicalCutNote.textContent = t("geologicalCutNote");

  wellRadiusALabel.textContent = t("wellRadiusA");
  wellRadiusBLabel.textContent = t("wellRadiusB");
  technicalResultsSummary.textContent = t("technicalResults");
  metricStatusLabel.textContent = t("status");
  metricIterationsLabel.textContent = t("iterations");
  metricMinHeadLabel.textContent = t("minimumGridHead");
  metricMaxHeadLabel.textContent = t("maximumHead");
  metricHeadALabel.textContent = t("headCellA");
  metricHeadBLabel.textContent = t("headCellB");
  metricEstimatedHeadALabel.textContent = t("estimatedHeadA");
  metricEstimatedHeadBLabel.textContent = t("estimatedHeadB");
  metricDarcyLabel.textContent = t("maxDarcy");
  metricMaxDrawdownLabel.textContent = t("maximumGridDrawdown");
  metricDrawdownALabel.textContent = t("drawdownCellA");
  metricDrawdownBLabel.textContent = t("drawdownCellB");
  metricEstimatedDrawdownALabel.textContent = t("estimatedDrawdownA");
  metricEstimatedDrawdownBLabel.textContent = t("estimatedDrawdownB");
  peacemanNote.textContent = t("peacemanNote");
  scenarioTableInterface?.render();

  rechargeValue.value = `${recharge.value} ${t("rechargeUnit")}`;

  getElement<HTMLElement>("confined-validity-title").textContent =
    t("confinedValidityTitle");
  getElement<HTMLElement>("confined-validity-extrapolation").textContent =
    t("confinedExtrapolation");
  meshInvalidCardTitle.textContent = t("meshInvalidCardTitle");
  meshInvalidCardDescription.textContent = t("meshInvalidCardDescription");
  meshInvalidCardAction.textContent = t("meshInvalidCardAction");
  helpInterface.refreshLanguage();

  document.querySelector<HTMLElement>(".river-label")?.replaceChildren(t("river"));
}

languageEs.addEventListener("click", () => {
  setLanguage("es");
  updateLanguageToggle();
  updateEstimatedWellMetrics();
});

languageEn.addEventListener("click", () => {
  setLanguage("en");
  updateLanguageToggle();
  updateEstimatedWellMetrics();
});

updateLanguageToggle();

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

function updateActiveScenarioVisual(scenario: Scenario): void {
  const { showRiver } = getScenarioVisualState(scenario.boundary.referenceKind);
  scene.setRiverVisible(showRiver);
  riverLevelLegend.hidden = !showRiver;
}

scenarioTableInterface = createScenarioTableInterface(
  getElement<HTMLDivElement>("scenario-comparator-root"),
  currentInput(),
  { onActiveScenarioChange: updateActiveScenarioVisual },
);
scenarioTableInterface.render();
updateActiveScenarioVisual(scenarioTableInterface.getActiveScenario());

interface LastWellMetricState {
  input: GroundwaterModelInput;
  result: GroundwaterResult;
  drawdown: DrawdownResult;
}

interface EstimatedWellMetrics {
  heads: Required<EstimatedWellHeadsMeters>;
  drawdowns: { wellA: number; wellB: number };
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
  rechargeValue.value = `${recharge.value} ${t("rechargeUnit")}`;
  aquiferThicknessValue.value = `${aquiferThickness.value} m`;
  riverHeadValue.value = `${riverHead.value} m`;
  setTextWithAtomicSuffix(
    riverLevelLegend,
    t("riverLevel")(riverHead.value),
    `${riverHead.value} m`,
  );
}

function setTextWithAtomicSuffix(
  element: HTMLElement,
  text: string,
  suffix: string,
): void {
  const suffixIndex = text.lastIndexOf(suffix);
  if (suffixIndex === -1) {
    element.textContent = text;
    return;
  }

  const atomicSuffix = document.createElement("span");
  atomicSuffix.className = "atomic-expression";
  atomicSuffix.textContent = suffix;
  element.replaceChildren(
    text.slice(0, suffixIndex),
    atomicSuffix,
    text.slice(suffixIndex + suffix.length),
  );
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
  updateDrawdownLegend(drawdown.drawdownMeters);
  showResult(actualInput, actualResult, darcyFlow.maxMagnitudeMetersPerDay, drawdown);
}

function streamlineTargets(input: GroundwaterModelInput): StreamlineTarget[] {
  const toPoint = (row: number, column: number) => {
    const position = gridCellCenterMeters(input, row, column);
    return { xMeters: position.xMeters, zMeters: position.yMeters };
  };
  return [
    ...input.fixedHeadCells.map((cell) => ({ ...toPoint(cell.row, cell.column), kind: "fixedHead" as const })),
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
  status.textContent = t("converged");
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
  const { input } = lastWellMetricState;
  const estimatedMetrics = calculateEstimatedWellMetrics(lastWellMetricState);
  const { heads: estimatedHeads, drawdowns: estimatedDrawdowns } = estimatedMetrics;

  estimatedWellAHead.textContent = formatMeters(estimatedHeads.wellA);
  estimatedWellBHead.textContent = formatMeters(estimatedHeads.wellB);
  estimatedWellADrawdown.textContent = formatDrawdownMeters(estimatedDrawdowns.wellA);
  estimatedWellBDrawdown.textContent = formatDrawdownMeters(estimatedDrawdowns.wellB);

  publicWellADrawdown.textContent =
    `${t("estimatedDecline")}: ${formatDrawdownMeters(estimatedDrawdowns.wellA)}`;
  publicWellBDrawdown.textContent =
    `${t("estimatedDecline")}: ${formatDrawdownMeters(estimatedDrawdowns.wellB)}`;

  const hasPumping = input.wells.some((well) => well.rateCubicMetersPerDay > 0);
  publicResultSummary.textContent = hasPumping
    ? t("pumpingDecline")
    : t("noPumping");

  updateConfinedValidity(estimatedMetrics);
}

function calculateEstimatedWellMetrics(
  state: LastWellMetricState,
): EstimatedWellMetrics {
  const { input, result, drawdown } = state;
  const parametersA = correctionParameters(input, 0, Number(wellARadius.value));
  const parametersB = correctionParameters(input, 1, Number(wellBRadius.value));
  return {
    heads: {
      wellA: estimateWellHeadMeters(result.headsMeters[WELL_A.row][WELL_A.column], parametersA),
      wellB: estimateWellHeadMeters(result.headsMeters[WELL_B.row][WELL_B.column], parametersB),
    },
    drawdowns: {
      wellA: estimateWellDrawdownMeters(
        drawdown.drawdownMeters[WELL_A.row][WELL_A.column],
        parametersA,
      ),
      wellB: estimateWellDrawdownMeters(
        drawdown.drawdownMeters[WELL_B.row][WELL_B.column],
        parametersB,
      ),
    },
  };
}

function updateConfinedValidity(estimatedMetrics?: EstimatedWellMetrics): void {
  if (!lastWellMetricState) {
    return;
  }
  try {
    const { result } = lastWellMetricState;
    const metrics = estimatedMetrics ?? calculateEstimatedWellMetrics(lastWellMetricState);
    const validity = evaluateConfinedModelValidity({
      headsMeters: result.headsMeters,
      aquiferTopElevationMeters: aquiferTopElevation.valueAsNumber,
      estimatedWellHeadsMeters: metrics.heads,
    });
    showConfinedValidity(validity, metrics);
  } catch (error) {
    clearScientificOutputAudit();
    meshInvalidCard.hidden = true;
    confinedValidityStatus.textContent = t("invalidElevation");
    confinedValidityStatus.dataset.status = "invalid";
    confinedValiditySummary.textContent = t("confinedValidityEvaluationFailed");
    confinedValidityWarnings.textContent = "";
    confinedValidityExtrapolation.hidden = true;
    publicModelWarning.textContent = t("validityCheckFailed");
  }
}

function showConfinedValidity(
  validity: ReturnType<typeof evaluateConfinedModelValidity>,
  estimatedMetrics: EstimatedWellMetrics,
): void {
  const presentation = getConfinedPresentationState(validity);
  applyScientificOutputAudit(presentation, estimatedMetrics);
  meshInvalidCard.hidden = presentation.level !== "meshInvalid";
  if (presentation.level === "valid") {
    confinedValidityStatus.textContent = t("confinedValidityValidStatus");
    confinedValidityStatus.dataset.status = "valid";
    confinedValiditySummary.textContent = t("confinedValidityValidSummary");
    confinedValidityWarnings.textContent = "";
    confinedValidityExtrapolation.hidden = true;
    publicModelWarning.textContent = "";
    return;
  }

  if (presentation.level === "wellDegraded") {
    confinedValidityStatus.textContent = t("wellDegradedStatus");
    confinedValidityStatus.dataset.status = "well-degraded";
    confinedValiditySummary.textContent = t("wellDegradedSummary");
    confinedValidityExtrapolation.textContent = t("wellDegradedExtrapolation");
    confinedValidityExtrapolation.hidden = false;
    const affectedWells = [
      validity.wellA.status === "OUTSIDE_CONFINED_RANGE" ? "A" : null,
      validity.wellB.status === "OUTSIDE_CONFINED_RANGE" ? "B" : null,
    ].filter((label): label is string => label !== null);

    if (affectedWells.length > 0) {
      showWellRangeWarning(affectedWells.join(t("and")));
    } else {
      publicModelWarning.replaceChildren();
    }
    const wellWarnings = [
      confinedWellWarning("A", validity.wellA),
      confinedWellWarning("B", validity.wellB),
    ].filter((warning): warning is string => warning !== null);
    confinedValidityWarnings.textContent = wellWarnings.join(" ");
    return;
  }

  confinedValidityStatus.textContent = t("meshInvalidStatus");
  confinedValidityStatus.dataset.status = "mesh-invalid";
  confinedValiditySummary.textContent = t("meshInvalidSummary")(
    validity.cellsBelowAquiferTop,
    validity.percentageCellsBelowAquiferTop.toFixed(2),
    formatMeters(validity.maximumGridDeficitBelowAquiferTopMeters),
  );
  confinedValidityWarnings.textContent = [
    confinedWellWarning("A", validity.wellA),
    confinedWellWarning("B", validity.wellB),
  ].filter((warning): warning is string => warning !== null).join(" ");
  confinedValidityExtrapolation.textContent = t("confinedExtrapolation");
  confinedValidityExtrapolation.hidden = false;
  publicModelWarning.textContent = t("meshInvalidPublicWarning");
}

function showWellRangeWarning(wells: string): void {
  const title = document.createElement("h3");
  title.textContent = t("wellRangeWarningTitle")(wells);
  const estimate = document.createElement("p");
  estimate.textContent = t("wellRangeWarningEstimate");
  const grid = document.createElement("p");
  grid.textContent = t("wellRangeWarningGrid");
  publicModelWarning.replaceChildren(title, estimate, grid);
}

function confinedWellWarning(
  label: string,
  well: ReturnType<typeof evaluateConfinedModelValidity>["wellA"],
): string | null {
  if (well.status !== "OUTSIDE_CONFINED_RANGE") {
    return null;
  }
  return t("confinedWellWarning")(
    label,
    formatMeters(well.headMeters!),
    formatMeters(well.deficitBelowAquiferTopMeters!),
  );
}

interface ScientificOutput {
  element: HTMLElement;
  label: string;
  rawValue: string;
}

function applyScientificOutputAudit(
  presentation: ReturnType<typeof getConfinedPresentationState>,
  estimatedMetrics: EstimatedWellMetrics,
): void {
  if (!lastWellMetricState) {
    return;
  }
  const { result, drawdown } = lastWellMetricState;
  const meshOutputs: ScientificOutput[] = [
    { element: minHead, label: metricMinHeadLabel.textContent ?? "", rawValue: formatMeters(result.minHeadMeters) },
    { element: maxHead, label: metricMaxHeadLabel.textContent ?? "", rawValue: formatMeters(result.maxHeadMeters) },
    { element: wellAHead, label: metricHeadALabel.textContent ?? "", rawValue: formatMeters(result.headsMeters[WELL_A.row][WELL_A.column]) },
    { element: wellBHead, label: metricHeadBLabel.textContent ?? "", rawValue: formatMeters(result.headsMeters[WELL_B.row][WELL_B.column]) },
    { element: darcyMax, label: metricDarcyLabel.textContent ?? "", rawValue: darcyMax.textContent ?? "" },
    { element: maxDrawdown, label: metricMaxDrawdownLabel.textContent ?? "", rawValue: formatDrawdownMeters(drawdown.maxDrawdownMeters) },
    { element: wellADrawdown, label: metricDrawdownALabel.textContent ?? "", rawValue: formatDrawdownMeters(drawdown.drawdownMeters[WELL_A.row][WELL_A.column]) },
    { element: wellBDrawdown, label: metricDrawdownBLabel.textContent ?? "", rawValue: formatDrawdownMeters(drawdown.drawdownMeters[WELL_B.row][WELL_B.column]) },
    { element: drawdownLegendMinimum, label: publicDrawdownTitle.textContent ?? "", rawValue: drawdownLegendMinimum.textContent ?? "" },
    { element: drawdownLegendZero, label: publicDrawdownTitle.textContent ?? "", rawValue: drawdownLegendZero.textContent ?? "" },
    { element: drawdownLegendMaximum, label: publicDrawdownTitle.textContent ?? "", rawValue: drawdownLegendMaximum.textContent ?? "" },
  ];
  const wellAOutputs: ScientificOutput[] = [
    { element: estimatedWellAHead, label: metricEstimatedHeadALabel.textContent ?? "", rawValue: formatMeters(estimatedMetrics.heads.wellA) },
    { element: estimatedWellADrawdown, label: metricEstimatedDrawdownALabel.textContent ?? "", rawValue: formatDrawdownMeters(estimatedMetrics.drawdowns.wellA) },
    { element: publicWellADrawdown, label: publicWellALabel.textContent ?? "", rawValue: formatDrawdownMeters(estimatedMetrics.drawdowns.wellA) },
  ];
  const wellBOutputs: ScientificOutput[] = [
    { element: estimatedWellBHead, label: metricEstimatedHeadBLabel.textContent ?? "", rawValue: formatMeters(estimatedMetrics.heads.wellB) },
    { element: estimatedWellBDrawdown, label: metricEstimatedDrawdownBLabel.textContent ?? "", rawValue: formatDrawdownMeters(estimatedMetrics.drawdowns.wellB) },
    { element: publicWellBDrawdown, label: publicWellBLabel.textContent ?? "", rawValue: formatDrawdownMeters(estimatedMetrics.drawdowns.wellB) },
  ];

  for (const output of meshOutputs) {
    setScientificOutputAudit(output, presentation.meshOutputsDegraded);
  }
  for (const output of wellAOutputs) {
    setScientificOutputAudit(output, presentation.wellAOutputsDegraded);
  }
  for (const output of wellBOutputs) {
    setScientificOutputAudit(output, presentation.wellBOutputsDegraded);
  }
}

function setScientificOutputAudit(output: ScientificOutput, auditRequired: boolean): void {
  if (!auditRequired) {
    delete output.element.dataset.rawValue;
    output.element.removeAttribute("title");
    output.element.removeAttribute("aria-label");
    return;
  }
  output.element.dataset.rawValue = output.rawValue;
  output.element.title = output.rawValue;
  output.element.setAttribute(
    "aria-label",
    `${output.label}: ${output.rawValue}. ${t("outsideConfinedModel")}.`,
  );
}

function clearScientificOutputAudit(): void {
  const outputs = [
    minHead,
    maxHead,
    wellAHead,
    wellBHead,
    estimatedWellAHead,
    estimatedWellBHead,
    darcyMax,
    maxDrawdown,
    wellADrawdown,
    wellBDrawdown,
    estimatedWellADrawdown,
    estimatedWellBDrawdown,
    publicWellADrawdown,
    publicWellBDrawdown,
    drawdownLegendMinimum,
    drawdownLegendZero,
    drawdownLegendMaximum,
  ];
  for (const output of outputs) {
    delete output.dataset.rawValue;
    output.removeAttribute("title");
    output.removeAttribute("aria-label");
  }
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
  clearScientificOutputAudit();
  meshInvalidCard.hidden = true;
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
  publicResultSummary.textContent = t("calculationFailed");
  publicModelWarning.textContent = t("checkScenario");
  drawdownLegendMinimum.textContent = "—";
  drawdownLegendMaximum.textContent = "—";
  drawdownLegendZero.hidden = true;
  solverMessage.textContent = message;
}

function formatMeters(value: number): string {
  return `${value.toFixed(1)}\u00A0m`;
}

function formatDrawdownMeters(value: number): string {
  return `${value.toFixed(1)}\u00A0m`;
}

function formatMetersPerDay(value: number): string {
  return `${value.toFixed(2)}\u00A0${t("metersPerDayUnit")}`;
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
