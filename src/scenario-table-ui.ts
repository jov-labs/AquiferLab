import type { GroundwaterModelInput } from "./groundwater.js";
import { t } from "./i18n.js";
import {
  MAX_SCENARIOS,
  HYDRAULIC_REFERENCE_OPTIONS,
  SCENARIO_TABLE_ROWS,
  addScenarioToTable,
  createInitialScenarioTableState,
  getScenarioTableValue,
  removeScenarioFromTable,
  renameScenarioInTable,
  scenarioTableBounds,
  setScenarioReferenceInTable,
  updateScenarioInTable,
  updateScenarioPositionInTable,
  type ScenarioTableState,
} from "./scenario-table.js";

export interface ScenarioTableInterface {
  render(): void;
}

/** Renderiza el editor de escenarios sin acoplarlo a la ejecución del simulador. */
export function createScenarioTableInterface(
  container: HTMLElement,
  parameters: GroundwaterModelInput,
): ScenarioTableInterface {
  let state = createInitialScenarioTableState(parameters);
  let positionError: "scenarioPositionOutsideDomain" | "scenarioPositionOnFixedHead" | null = null;

  function render(): void {
    const section = document.createElement("section");
    section.className = "scenario-comparator";
    const title = document.createElement("h2");
    title.textContent = t("scenarioComparatorTitle");
    section.append(title);

    const tableWrap = document.createElement("div");
    tableWrap.className = "scenario-table-wrap";
    const table = document.createElement("table");
    table.className = "scenario-table";
    table.append(createHeader(state, () => render()));
    table.append(createBody(state));
    tableWrap.append(table);
    section.append(tableWrap);

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

      const removeButton = document.createElement("button");
      removeButton.className = "scenario-remove-button";
      removeButton.type = "button";
      removeButton.textContent = t("removeScenario");
      removeButton.disabled = currentState.scenarios.length <= 1;
      removeButton.addEventListener("click", () => {
        const result = removeScenarioFromTable(state, scenario.id);
        if (result.ok) {
          state = result.state;
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
    for (const rowDefinition of SCENARIO_TABLE_ROWS) {
      const row = document.createElement("tr");
      const label = document.createElement("th");
      label.scope = "row";
      label.textContent = t(rowDefinition.labelKey);
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
        input.value = String(getScenarioTableValue(scenario, rowDefinition.field));
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
              input.value = String(getScenarioTableValue(scenario, rowDefinition.field));
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
    label.textContent = t("scenarioHydraulicReference");
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

  return { render };
}

function isPositionField(field: string): field is "wellAX" | "wellAY" | "wellBX" | "wellBY" {
  return field === "wellAX" || field === "wellAY" || field === "wellBX" || field === "wellBY";
}

function createHeaderCell(text: string): HTMLTableCellElement {
  const cell = document.createElement("th");
  cell.scope = "col";
  cell.textContent = text;
  return cell;
}
