import { describe, expect, it } from "vitest";

import { createDefaultModelInput } from "./groundwater.js";
import { getScenarioVisualState } from "./scenario-visual.js";
import { createScenario, setScenarioHydraulicReference } from "./scenarios.js";

describe("scenario reference visual visibility", () => {
  it("shows the river for a river reference and by default", () => {
    const scenario = createScenario({
      id: "scenario-1",
      name: "Scenario 1",
      parameters: createDefaultModelInput(),
    });

    expect(getScenarioVisualState(scenario.boundary.referenceKind)).toEqual({ showRiver: true });
  });

  it("hides the river for a regional reference without altering the model", () => {
    const parameters = createDefaultModelInput();
    const scenario = createScenario({ id: "scenario-1", name: "Scenario 1", parameters });
    const regional = setScenarioHydraulicReference(scenario, "regional");

    expect(getScenarioVisualState(regional.boundary.referenceKind)).toEqual({ showRiver: false });
    expect(regional.parameters).toEqual(scenario.parameters);
    expect(regional.parameters.fixedHeadCells).toEqual(parameters.fixedHeadCells);
    expect(regional.parameters.wells).toEqual(parameters.wells);
  });
});
