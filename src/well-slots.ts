import type { ExtractionWell, GroundwaterModelInput } from "./groundwater.js";

/**
 * Wells in the visible interface, identified only by their position in the collection.
 * Returned references belong to the input and must be treated as read-only.
 */
export interface WellSlots {
  readonly a: Readonly<ExtractionWell>;
  readonly b: Readonly<ExtractionWell>;
}

/**
 * Exposes the two wells required by the visible interface: wells[0] is A and wells[1] is B.
 */
export function getWellSlots(input: GroundwaterModelInput): WellSlots {
  if (input.wells.length !== 2) {
    throw new Error("The visible simulation requires exactly two wells.");
  }

  return {
    a: input.wells[0]!,
    b: input.wells[1]!,
  };
}
