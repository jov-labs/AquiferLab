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
import { calculateDarcyFlow } from "./flow.js";
import { createAquiferScene } from "./scene.js";

const REFERENCE_HEAD_METERS = 100;
const WELL_A = { row: 20, column: 20, label: "Pozo A" };
const WELL_B = { row: 28, column: 30, label: "Pozo B" };

const wellARate = getElement<HTMLInputElement>("well-a-rate");
const wellBRate = getElement<HTMLInputElement>("well-b-rate");
const wellAValue = getElement<HTMLOutputElement>("well-a-value");
const wellBValue = getElement<HTMLOutputElement>("well-b-value");
const status = getElement<HTMLElement>("result-status");
const iterations = getElement<HTMLElement>("result-iterations");
const minHead = getElement<HTMLElement>("result-min-head");
const maxHead = getElement<HTMLElement>("result-max-head");
const wellAHead = getElement<HTMLElement>("result-well-a-head");
const wellBHead = getElement<HTMLElement>("result-well-b-head");
const solverMessage = getElement<HTMLElement>("solver-message");
const darcyMax = getElement<HTMLElement>("result-darcy-max");
const darcyFlowToggle = getElement<HTMLInputElement>("show-darcy-flow");
const geologicalCutToggle = getElement<HTMLInputElement>("enable-geological-cut");
const cutPosition = getElement<HTMLInputElement>("cut-position");
const hydraulicConductivityExponent = getElement<HTMLInputElement>("hydraulic-conductivity-exponent");
const hydraulicConductivityValue = getElement<HTMLOutputElement>("hydraulic-conductivity-value");
const recharge = getElement<HTMLInputElement>("recharge");
const rechargeValue = getElement<HTMLOutputElement>("recharge-value");
const aquiferThickness = getElement<HTMLInputElement>("aquifer-thickness");
const aquiferThicknessValue = getElement<HTMLOutputElement>("aquifer-thickness-value");
const riverHead = getElement<HTMLInputElement>("river-head");
const riverHeadValue = getElement<HTMLOutputElement>("river-head-value");

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

function updateSliderLabels(): void {
  wellAValue.value = `${wellARate.value} L/s`;
  wellBValue.value = `${wellBRate.value} L/s`;
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
  const input = currentInput();
  let result: GroundwaterResult;
  try {
    result = solveGroundwater(input);
  } catch (error) {
    showNoConvergence(error instanceof Error ? error.message : "Error del solver.");
    return;
  }

  if (!result.converged || !result.isValid) {
    showNoConvergence("El campo nuevo no es válido; se conserva la última superficie válida.");
    return;
  }

  const darcyFlow = calculateDarcyFlow(input, result.headsMeters);
  scene.updatePiezometricSurface({
    headsMeters: result.headsMeters,
    referenceHeadMeters: REFERENCE_HEAD_METERS,
  });
  scene.updateDarcyFlow({
    field: darcyFlow,
    headsMeters: result.headsMeters,
    referenceHeadMeters: REFERENCE_HEAD_METERS,
  });
  showResult(result, darcyFlow.maxMagnitudeMetersPerDay);
}

function showResult(result: GroundwaterResult, maxDarcyMetersPerDay: number): void {
  status.textContent = "Convergió";
  status.dataset.status = "valid";
  iterations.textContent = String(result.iterations);
  minHead.textContent = formatMeters(result.minHeadMeters);
  maxHead.textContent = formatMeters(result.maxHeadMeters);
  wellAHead.textContent = formatMeters(result.headsMeters[WELL_A.row][WELL_A.column]);
  wellBHead.textContent = formatMeters(result.headsMeters[WELL_B.row][WELL_B.column]);
  darcyMax.textContent = formatMetersPerDay(maxDarcyMetersPerDay);
  solverMessage.textContent = "";
}

function showNoConvergence(message: string): void {
  status.textContent = "NO CONVERGIÓ";
  status.dataset.status = "invalid";
  iterations.textContent = "—";
  minHead.textContent = "—";
  maxHead.textContent = "—";
  wellAHead.textContent = "—";
  wellBHead.textContent = "—";
  darcyMax.textContent = "—";
  solverMessage.textContent = message;
}

function formatMeters(value: number): string {
  return `${value.toFixed(3)} m`;
}

function formatMetersPerDay(value: number): string {
  return `${value.toFixed(4)} m/día`;
}

for (const slider of [wellARate, wellBRate]) {
  slider.addEventListener("input", updateSliderLabels);
  // change se dispara al confirmar el valor, evitando solves por cada paso del arrastre.
  slider.addEventListener("change", recalculate);
}

for (const parameterControl of [
  hydraulicConductivityExponent,
  recharge,
  aquiferThickness,
  riverHead,
]) {
  parameterControl.addEventListener("input", updateParameterLabels);
  parameterControl.addEventListener("change", recalculate);
}

darcyFlowToggle.addEventListener("change", () => {
  scene.setDarcyFlowVisible(darcyFlowToggle.checked);
});

function updateGeologicalCut(): void {
  cutPosition.disabled = !geologicalCutToggle.checked;
  scene.setGeologicalCut(geologicalCutToggle.checked, Number(cutPosition.value));
}

geologicalCutToggle.addEventListener("change", updateGeologicalCut);
cutPosition.addEventListener("input", updateGeologicalCut);

updateSliderLabels();
scene.setDarcyFlowVisible(darcyFlowToggle.checked);
updateGeologicalCut();
recalculate();
