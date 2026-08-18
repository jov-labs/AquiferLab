export const SCENARIO_PARAMETER_COLUMN_WIDTH = 125;
export const SCENARIO_VALUE_COLUMN_MIN_WIDTH = 120;
export const SCENARIO_UNIT_COLUMN_WIDTH = 80;

export function getScenarioTableMinWidth(scenarioCount: number): number {
  const normalizedScenarioCount = Math.max(1, Math.floor(scenarioCount));
  return (
    SCENARIO_PARAMETER_COLUMN_WIDTH +
    normalizedScenarioCount * SCENARIO_VALUE_COLUMN_MIN_WIDTH +
    SCENARIO_UNIT_COLUMN_WIDTH
  );
}
