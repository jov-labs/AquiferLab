import type { GroundwaterModelInput } from "./groundwater.js";

export interface GridCoordinatesMeters {
  xMeters: number;
  yMeters: number;
}

export interface GridCell {
  row: number;
  column: number;
}

/** Converts a grid cell to its physical centre, in metres from the domain origin. */
export function gridCellCenterMeters(
  input: Pick<GroundwaterModelInput, "widthMeters" | "heightMeters" | "rows" | "columns">,
  row: number,
  column: number,
): GridCoordinatesMeters {
  return {
    xMeters: (column + 0.5) * (input.widthMeters / input.columns),
    yMeters: (row + 0.5) * (input.heightMeters / input.rows),
  };
}

/**
 * Locates the cell containing a physical coordinate. The upper boundary belongs to no cell.
 */
export function gridCellAtMeters(
  input: Pick<GroundwaterModelInput, "widthMeters" | "heightMeters" | "rows" | "columns">,
  xMeters: number,
  yMeters: number,
): GridCell | undefined {
  if (
    !Number.isFinite(xMeters) ||
    !Number.isFinite(yMeters) ||
    xMeters < 0 ||
    xMeters >= input.widthMeters ||
    yMeters < 0 ||
    yMeters >= input.heightMeters
  ) {
    return undefined;
  }

  return {
    row: Math.floor((yMeters / input.heightMeters) * input.rows),
    column: Math.floor((xMeters / input.widthMeters) * input.columns),
  };
}
