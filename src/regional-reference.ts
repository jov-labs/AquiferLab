import type { FixedHeadCell } from "./groundwater.js";

export type RegionalReferenceSide = "west" | "east" | "north" | "south";

export const REGIONAL_REFERENCE_SIDES = ["west", "east", "north", "south"] as const;

export interface RegionalReferenceGrid {
  readonly rows: number;
  readonly columns: number;
}

/** Builds the complete fixed-head boundary for a regional reference. */
export function createRegionalFixedHeadCells(
  grid: RegionalReferenceGrid,
  side: RegionalReferenceSide,
  headMeters: number,
): readonly FixedHeadCell[] {
  switch (side) {
    case "west":
      return Array.from({ length: grid.rows }, (_, row) => ({ row, column: 0, headMeters }));
    case "east":
      return Array.from({ length: grid.rows }, (_, row) => ({
        row,
        column: grid.columns - 1,
        headMeters,
      }));
    case "north":
      return Array.from({ length: grid.columns }, (_, column) => ({ row: 0, column, headMeters }));
    case "south":
      return Array.from({ length: grid.columns }, (_, column) => ({
        row: grid.rows - 1,
        column,
        headMeters,
      }));
  }
}
