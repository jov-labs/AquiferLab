import {
  createDefaultModelInput,
  litersPerSecondToCubicMetersPerDay,
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

const baseInput = createDefaultModelInput();
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
  return {
    ...createDefaultModelInput(),
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
