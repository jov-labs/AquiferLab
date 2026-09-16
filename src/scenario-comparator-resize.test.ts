import { describe, expect, it } from "vitest";
import {
  clampScenarioComparatorWidth,
  MAX_SCENARIO_COMPARATOR_WIDTH,
  MIN_SCENARIO_COMPARATOR_WIDTH,
  scenarioComparatorWidthFromPointer,
} from "./scenario-comparator-resize.js";

describe("comparator resizing", () => {
  it("clamps width to its bounds", () => {
    expect(clampScenarioComparatorWidth(MIN_SCENARIO_COMPARATOR_WIDTH - 1)).toBe(
      MIN_SCENARIO_COMPARATOR_WIDTH,
    );
    expect(clampScenarioComparatorWidth(MAX_SCENARIO_COMPARATOR_WIDTH + 1)).toBe(
      MAX_SCENARIO_COMPARATOR_WIDTH,
    );
  });

  it("calculates width from horizontal displacement", () => {
    expect(scenarioComparatorWidthFromPointer(100, 300, 450)).toBe(650);
    expect(scenarioComparatorWidthFromPointer(100, 300, -100)).toBe(
      MIN_SCENARIO_COMPARATOR_WIDTH,
    );
  });
});
