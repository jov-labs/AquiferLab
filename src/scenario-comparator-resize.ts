export const MIN_SCENARIO_COMPARATOR_WIDTH = 260;
export const MAX_SCENARIO_COMPARATOR_WIDTH = 700;

export function clampScenarioComparatorWidth(width: number): number {
  return Math.min(
    MAX_SCENARIO_COMPARATOR_WIDTH,
    Math.max(MIN_SCENARIO_COMPARATOR_WIDTH, width),
  );
}

export function scenarioComparatorWidthFromPointer(
  startX: number,
  startWidth: number,
  currentX: number,
): number {
  return clampScenarioComparatorWidth(startWidth + currentX - startX);
}
