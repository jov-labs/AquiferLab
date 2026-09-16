import type { GroundwaterModelInput } from "./groundwater.js";
import { t, type TranslationKey } from "./i18n.js";
import { getScenarioTableMinWidth } from "./scenario-table-layout.js";
import {
  MAX_SCENARIOS,
  HYDRAULIC_REFERENCE_OPTIONS,
  REGIONAL_REFERENCE_SIDE_OPTIONS,
  SCENARIO_TABLE_ROWS,
  addScenarioToTable,
  createInitialScenarioTableState,
  getScenarioTableValue,
  removeScenarioFromTable,
  renameScenarioInTable,
  scenarioTableBounds,
  setScenarioReferenceInTable,
  setScenarioRegionalReferenceSideInTable,
  updateActiveScenarioTableValue,
  updateScenarioInTable,
  updateScenarioPositionInTable,
  type ScenarioTableHydraulicField,
  type ScenarioTableState,
} from "./scenario-table.js";
import type { Scenario } from "./scenarios.js";
import {
  createScenarioSelection,
  reconcileScenarioSelectionAfterRemoval,
  setActiveScenario,
  type ScenarioSelection,
} from "./scenario-selection.js";

const REGIONAL_REFERENCE_SIDE_LABEL_KEYS = {
  west: "regionalReferenceWest",
  east: "regionalReferenceEast",
  north: "regionalReferenceNorth",
  south: "regionalReferenceSouth",
} as const;

export interface ScenarioTableInterface {
  render(): void;
  getActiveScenario(): Scenario;
  updateActiveScenarioValue(field: ScenarioTableHydraulicField, value: number): Scenario;
}

export interface ScenarioTableOptions {
  readonly onActiveScenarioChange?: (scenario: Scenario) => void;
  readonly onScenarioActivated?: (scenario: Scenario) => void;
}

/** Renders the scenario editor and optionally notifies its active selection. */
export function createScenarioTableInterface(
  container: HTMLElement,
  parameters: GroundwaterModelInput,
  options: ScenarioTableOptions = {},
): ScenarioTableInterface {
  let state = createInitialScenarioTableState(parameters);
  let positionError: "scenarioPositionOutsideDomain" | "scenarioPositionOnFixedHead" | null = null;
  let selection: ScenarioSelection = createScenarioSelection(state.scenarios);

  function render(): void {
    const section = document.createElement("section");
    section.className = "scenario-comparator";

    const tableWrap = document.createElement("div");
    tableWrap.className = "scenario-table-wrap";
    const table = document.createElement("table");
    table.className = "scenario-table";
    table.style.minWidth = `${getScenarioTableMinWidth(state.scenarios.length)}px`;
    const columnGroup = document.createElement("colgroup");
    const parameterColumn = document.createElement("col");
    parameterColumn.className = "scenario-parameter-column";
    columnGroup.append(parameterColumn);
    for (const _scenario of state.scenarios) {
      const valueColumn = document.createElement("col");
      valueColumn.className = "scenario-value-column";
      columnGroup.append(valueColumn);
    }
    const unitColumn = document.createElement("col");
    unitColumn.className = "scenario-unit-column";
    columnGroup.append(unitColumn);
    table.append(columnGroup);
    table.append(createHeader(state, () => render()));
    table.append(createBody(state));
    tableWrap.append(table);
    section.append(tableWrap);

    const coordinateNote = document.createElement("p");
    coordinateNote.className = "scenario-coordinate-note";
    coordinateNote.textContent = t("scenarioCoordinatesNote");
    section.append(coordinateNote);

    if (positionError) {
      const error = document.createElement("p");
      error.className = "scenario-table-error";
      error.setAttribute("role", "alert");
      error.textContent = t(positionError);
      section.append(error);
    }

    const addButton = document.createElement("button");
    addButton.className = "scenario-add-button";
    addButton.type = "button";
    addButton.textContent = t("addScenario");
    addButton.disabled = state.scenarios.length >= MAX_SCENARIOS;
    addButton.addEventListener("click", () => {
      const result = addScenarioToTable(state);
      if (result.ok) {
        state = result.state;
        render();
      }
    });
    section.append(addButton);
    container.replaceChildren(section);
  }

  function createHeader(currentState: ScenarioTableState, refresh: () => void): HTMLTableSectionElement {
    const head = document.createElement("thead");
    const row = document.createElement("tr");
    row.append(createHeaderCell(t("parameter")));
    for (const scenario of currentState.scenarios) {
      const cell = document.createElement("th");
      cell.scope = "col";
      const name = document.createElement("input");
      name.className = "scenario-name-input";
      name.type = "text";
      name.value = scenario.name;
      name.setAttribute("aria-label", t("scenarioName"));
      name.addEventListener("change", () => {
        state = renameScenarioInTable(state, scenario.id, name.value);
      });
      cell.append(name);

      const activeButton = document.createElement("button");
      activeButton.className = "scenario-active-button";
      activeButton.type = "button";
      const isActive = selection.activeScenarioId === scenario.id;
      activeButton.textContent = isActive ? t("activeScenario") : t("useScenario");
      activeButton.setAttribute("aria-pressed", String(isActive));
      activeButton.addEventListener("click", () => {
        selection = setActiveScenario(selection, state.scenarios, scenario.id);
        notifyActiveScenarioChange();
        notifyScenarioActivated();
        refresh();
      });
      cell.append(activeButton);

      const removeButton = document.createElement("button");
      removeButton.className = "scenario-remove-button";
      removeButton.type = "button";
      removeButton.textContent = t("removeScenario");
      removeButton.disabled = currentState.scenarios.length <= 1;
      removeButton.addEventListener("click", () => {
        const activeScenarioIdBeforeRemoval = selection.activeScenarioId;
        const result = removeScenarioFromTable(state, scenario.id);
        if (result.ok) {
          selection = reconcileScenarioSelectionAfterRemoval(
            selection,
            state.scenarios,
            result.state.scenarios,
            scenario.id,
          );
          state = result.state;
          notifyActiveScenarioChange();
          if (selection.activeScenarioId !== activeScenarioIdBeforeRemoval) {
            notifyScenarioActivated();
          }
          refresh();
        }
      });
      cell.append(removeButton);
      row.append(cell);
    }
    row.append(createHeaderCell(t("unit")));
    head.append(row);
    return head;
  }

  function createBody(currentState: ScenarioTableState): HTMLTableSectionElement {
    const body = document.createElement("tbody");
    body.append(createReferenceRow(currentState));
    body.append(createRegionalReferenceSideRow(currentState));
    for (const rowDefinition of SCENARIO_TABLE_ROWS) {
      const row = document.createElement("tr");
      const label = document.createElement("th");
      label.scope = "row";
      setScenarioLabel(label, rowDefinition.labelKey);
      row.append(label);

      for (const scenario of currentState.scenarios) {
        const cell = document.createElement("td");
        const input = document.createElement("input");
        input.type = "number";
        input.className = "scenario-value-input";
        const bounds = scenarioTableBounds(scenario, rowDefinition.field);
        input.min = String(bounds.min);
        input.max = String(bounds.max);
        input.step = String(rowDefinition.step);
        input.value = formatScenarioInputValue(
          rowDefinition.field,
          getScenarioTableValue(scenario, rowDefinition.field),
        );
        input.readOnly = rowDefinition.readonly === true;
        input.setAttribute("aria-label", `${t(rowDefinition.labelKey)}: ${scenario.name}`);
        input.addEventListener("change", () => {
          if (rowDefinition.readonly) {
            return;
          }
          if (!input.validity.valid) {
            if (isPositionField(rowDefinition.field)) {
              positionError = "scenarioPositionOutsideDomain";
              render();
            } else {
              input.value = formatScenarioInputValue(
                rowDefinition.field,
                getScenarioTableValue(scenario, rowDefinition.field),
              );
            }
            return;
          }
          if (isPositionField(rowDefinition.field)) {
            const result = updateScenarioPositionInTable(
              state,
              scenario.id,
              rowDefinition.field,
              Number(input.value),
            );
            if (result.ok) {
              state = result.state;
              positionError = null;
            } else {
              positionError =
                result.reason === "POSITION_ON_FIXED_HEAD"
                  ? "scenarioPositionOnFixedHead"
                  : "scenarioPositionOutsideDomain";
            }
            render();
            return;
          }
          state = updateScenarioInTable(state, scenario.id, rowDefinition.field, Number(input.value));
        });
        cell.append(input);
        if (rowDefinition.field === "riverHead") {
          const note = document.createElement("small");
          note.className = "scenario-reference-note";
          note.textContent = t(
            scenario.boundary.referenceKind === "river" ? "river" : "scenarioRegional",
          );
          cell.append(note);
        }
        row.append(cell);
      }

      const unit = document.createElement("td");
      unit.className = "scenario-unit";
      unit.textContent = t(rowDefinition.unitKey);
      row.append(unit);
      body.append(row);
    }
    return body;
  }

  function createReferenceRow(currentState: ScenarioTableState): HTMLTableRowElement {
    const row = document.createElement("tr");
    const label = document.createElement("th");
    label.scope = "row";
    setScenarioLabel(label, "scenarioHydraulicReference");
    row.append(label);

    for (const scenario of currentState.scenarios) {
      const cell = document.createElement("td");
      const select = document.createElement("select");
      select.className = "scenario-reference-select";
      select.setAttribute("aria-label", `${t("scenarioHydraulicReference")}: ${scenario.name}`);
      for (const optionValue of HYDRAULIC_REFERENCE_OPTIONS) {
        const option = document.createElement("option");
        option.value = optionValue;
        option.textContent = t(optionValue === "river" ? "river" : "scenarioRegional");
        option.selected = optionValue === scenario.boundary.referenceKind;
        select.append(option);
      }
      select.addEventListener("change", () => {
        if (!HYDRAULIC_REFERENCE_OPTIONS.includes(select.value as typeof HYDRAULIC_REFERENCE_OPTIONS[number])) {
          select.value = scenario.boundary.referenceKind;
          return;
        }
        state = setScenarioReferenceInTable(
          state,
          scenario.id,
          select.value as typeof HYDRAULIC_REFERENCE_OPTIONS[number],
        );
        notifyActiveScenarioChange();
        render();
      });
      cell.append(select);
      row.append(cell);
    }

    const unit = document.createElement("td");
    unit.className = "scenario-unit";
    unit.textContent = t("noUnit");
    row.append(unit);
    return row;
  }

  function createRegionalReferenceSideRow(currentState: ScenarioTableState): HTMLTableRowElement {
    const row = document.createElement("tr");
    const label = document.createElement("th");
    label.scope = "row";
    setScenarioLabel(label, "scenarioRegionalReferenceSide");
    row.append(label);

    for (const scenario of currentState.scenarios) {
      const cell = document.createElement("td");
      if (scenario.boundary.referenceKind !== "regional") {
        cell.textContent = t("noUnit");
        row.append(cell);
        continue;
      }

      const select = document.createElement("select");
      select.className = "scenario-reference-select";
      select.setAttribute(
        "aria-label",
        `${t("scenarioRegionalReferenceSide")}: ${scenario.name}`,
      );
      for (const side of REGIONAL_REFERENCE_SIDE_OPTIONS) {
        const option = document.createElement("option");
        option.value = side;
        option.textContent = t(REGIONAL_REFERENCE_SIDE_LABEL_KEYS[side]);
        option.selected = side === scenario.boundary.regionalReferenceSide;
        select.append(option);
      }
      select.addEventListener("change", () => {
        if (!REGIONAL_REFERENCE_SIDE_OPTIONS.includes(select.value as typeof REGIONAL_REFERENCE_SIDE_OPTIONS[number])) {
          select.value = scenario.boundary.regionalReferenceSide;
          return;
        }
        state = setScenarioRegionalReferenceSideInTable(
          state,
          scenario.id,
          select.value as typeof REGIONAL_REFERENCE_SIDE_OPTIONS[number],
        );
        notifyActiveScenarioChange();
        render();
      });
      cell.append(select);
      row.append(cell);
    }

    const unit = document.createElement("td");
    unit.className = "scenario-unit";
    unit.textContent = t("noUnit");
    row.append(unit);
    return row;
  }

  function getActiveScenario(): Scenario {
    const activeScenario = state.scenarios.find(
      (scenario) => scenario.id === selection.activeScenarioId,
    );
    if (!activeScenario) {
      throw new Error("No valid active scenario exists.");
    }
    return activeScenario;
  }

  function notifyActiveScenarioChange(): void {
    options.onActiveScenarioChange?.(getActiveScenario());
  }

  function notifyScenarioActivated(): void {
    options.onScenarioActivated?.(getActiveScenario());
  }

  function updateActiveScenarioValue(
    field: ScenarioTableHydraulicField,
    value: number,
  ): Scenario {
    const result = updateActiveScenarioTableValue(
      state,
      selection.activeScenarioId,
      field,
      value,
    );
    state = result.state;
    render();
    return result.scenario;
  }

  return { render, getActiveScenario, updateActiveScenarioValue };
}

function isPositionField(field: string): field is "wellAX" | "wellAY" | "wellBX" | "wellBY" {
  return field === "wellAX" || field === "wellAY" || field === "wellBX" || field === "wellBY";
}

function formatScenarioInputValue(field: string, value: number): string {
  if (field === "wellAX" || field === "wellAY" || field === "wellBX" || field === "wellBY" || field === "wellDistance") {
    return String(Number(value.toFixed(1)));
  }
  return String(value);
}

function setScenarioLabel(label: HTMLElement, labelKey: TranslationKey): void {
  label.setAttribute("aria-label", String(t(labelKey)));
  let lineKey: "scenarioHydraulicReferenceLines" | "scenarioRegionalReferenceSideLines" | "scenarioReferenceHeadLines" | null = null;
  if (labelKey === "scenarioHydraulicReference") {
    lineKey = "scenarioHydraulicReferenceLines";
  } else if (labelKey === "scenarioRegionalReferenceSide") {
    lineKey = "scenarioRegionalReferenceSideLines";
  } else if (labelKey === "scenarioReferenceHead") {
    lineKey = "scenarioReferenceHeadLines";
  }
  if (lineKey === null) {
    label.textContent = String(t(labelKey));
    return;
  }
  label.replaceChildren(
    ...t(lineKey).map((line) => {
      const lineElement = document.createElement("span");
      lineElement.className = "scenario-label-line";
      lineElement.textContent = line;
      return lineElement;
    }),
  );
}

function createHeaderCell(text: string): HTMLTableCellElement {
  const cell = document.createElement("th");
  cell.scope = "col";
  cell.textContent = text;
  return cell;
}
