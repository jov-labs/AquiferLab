import type { ExtractionWell, GroundwaterModelInput } from "./groundwater.js";

/**
 * Pozos de la interfaz visible, identificados únicamente por su posición en la colección.
 * Las referencias devueltas pertenecen al input y deben tratarse como solo lectura.
 */
export interface WellSlots {
  readonly a: Readonly<ExtractionWell>;
  readonly b: Readonly<ExtractionWell>;
}

/**
 * Expone los dos pozos que requiere la interfaz visible: wells[0] es A y wells[1] es B.
 */
export function getWellSlots(input: GroundwaterModelInput): WellSlots {
  if (input.wells.length !== 2) {
    throw new Error("La simulación visible requiere exactamente dos pozos.");
  }

  return {
    a: input.wells[0]!,
    b: input.wells[1]!,
  };
}
