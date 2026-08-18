import {
  metersPerDayToMetersPerSecond,
  metersPerDayToMillimetersPerYear,
  type GroundwaterModelInput,
} from "./groundwater.js";

export interface ModelInputControlValues {
  readonly hydraulicConductivityExponent: number;
  readonly rechargeMillimetersPerYear: number;
  readonly aquiferThicknessMeters: number;
  readonly referenceHeadMeters: number;
  readonly wellARateLitersPerSecond: number;
  readonly wellBRateLitersPerSecond: number;
}

/**
 * Convierte un input hidráulico a los valores que exponen los controles principales.
 * Requiere una carga fija uniforme porque la interfaz actual solo dispone de un control.
 */
export function projectModelInputToControlValues(
  input: GroundwaterModelInput,
): ModelInputControlValues {
  return {
    hydraulicConductivityExponent: Math.log10(
      metersPerDayToMetersPerSecond(input.hydraulicConductivityMetersPerDay),
    ),
    rechargeMillimetersPerYear: metersPerDayToMillimetersPerYear(input.rechargeMetersPerDay),
    aquiferThicknessMeters: input.thicknessMeters,
    referenceHeadMeters: uniformFixedHeadMeters(input),
    wellARateLitersPerSecond: cubicMetersPerDayToLitersPerSecond(
      input.wells[0]?.rateCubicMetersPerDay ?? 0,
    ),
    wellBRateLitersPerSecond: cubicMetersPerDayToLitersPerSecond(
      input.wells[1]?.rateCubicMetersPerDay ?? 0,
    ),
  };
}

function uniformFixedHeadMeters(input: GroundwaterModelInput): number {
  const firstFixedHead = input.fixedHeadCells[0];
  if (!firstFixedHead) {
    throw new Error("Los controles principales requieren al menos una carga fija.");
  }
  if (input.fixedHeadCells.some((cell) => cell.headMeters !== firstFixedHead.headMeters)) {
    throw new Error("Los controles principales requieren una carga fija uniforme.");
  }
  return firstFixedHead.headMeters;
}

function cubicMetersPerDayToLitersPerSecond(value: number): number {
  return (value * 1_000) / 86_400;
}
