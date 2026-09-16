import type { ExtractionWell, GroundwaterModelInput } from "./groundwater.js";
import {
  estimateWellDrawdownMeters,
  estimateWellHeadMeters,
  type WellCorrectionParameters,
} from "./well-correction.js";
import { getWellSlots, type WellSlots } from "./well-slots.js";

export interface WellCellMetric {
  readonly headMeters: number;
  readonly drawdownMeters: number;
}

export interface WellCellMetrics {
  readonly a: WellCellMetric;
  readonly b: WellCellMetric;
}

export interface WellCorrectionRadiiMeters {
  readonly a: number;
  readonly b: number;
}

export interface WellEstimatedMetrics {
  readonly heads: { readonly wellA: number; readonly wellB: number };
  readonly drawdowns: { readonly wellA: number; readonly wellB: number };
}

/** Reads metrics from the cells occupied by A/B slots in the executed input. */
export function readWellCellMetrics(
  input: GroundwaterModelInput,
  headsMeters: readonly (readonly number[])[],
  drawdownMeters: readonly (readonly number[])[],
): WellCellMetrics {
  return readWellCellMetricsForSlots(getWellSlots(input), headsMeters, drawdownMeters);
}

/** Applies the Peaceman correction to cells occupied by A/B slots in the executed input. */
export function calculateEstimatedWellMetrics(
  input: GroundwaterModelInput,
  headsMeters: readonly (readonly number[])[],
  drawdownMeters: readonly (readonly number[])[],
  radiiMeters: WellCorrectionRadiiMeters,
): WellEstimatedMetrics {
  const slots = getWellSlots(input);
  const cellMetrics = readWellCellMetricsForSlots(slots, headsMeters, drawdownMeters);
  const parametersA = correctionParameters(input, slots.a, radiiMeters.a);
  const parametersB = correctionParameters(input, slots.b, radiiMeters.b);

  return {
    heads: {
      wellA: estimateWellHeadMeters(cellMetrics.a.headMeters, parametersA),
      wellB: estimateWellHeadMeters(cellMetrics.b.headMeters, parametersB),
    },
    drawdowns: {
      wellA: estimateWellDrawdownMeters(cellMetrics.a.drawdownMeters, parametersA),
      wellB: estimateWellDrawdownMeters(cellMetrics.b.drawdownMeters, parametersB),
    },
  };
}

function readWellCellMetricsForSlots(
  slots: WellSlots,
  headsMeters: readonly (readonly number[])[],
  drawdownMeters: readonly (readonly number[])[],
): WellCellMetrics {
  return {
    a: readWellCellMetric(slots.a, headsMeters, drawdownMeters),
    b: readWellCellMetric(slots.b, headsMeters, drawdownMeters),
  };
}

function readWellCellMetric(
  well: Readonly<ExtractionWell>,
  headsMeters: readonly (readonly number[])[],
  drawdownMeters: readonly (readonly number[])[],
): WellCellMetric {
  const headMeters = headsMeters[well.row]?.[well.column];
  const drawdown = drawdownMeters[well.row]?.[well.column];
  if (headMeters === undefined || drawdown === undefined) {
    throw new Error("Las métricas de pozo requieren matrices compatibles con la malla.");
  }
  return { headMeters, drawdownMeters: drawdown };
}

function correctionParameters(
  input: GroundwaterModelInput,
  well: Readonly<ExtractionWell>,
  wellRadiusMeters: number,
): WellCorrectionParameters {
  return {
    cellWidthMeters: input.widthMeters / input.columns,
    cellHeightMeters: input.heightMeters / input.rows,
    hydraulicConductivityMetersPerDay: input.hydraulicConductivityMetersPerDay,
    thicknessMeters: input.thicknessMeters,
    extractionRateCubicMetersPerDay: well.rateCubicMetersPerDay,
    wellRadiusMeters,
  };
}
