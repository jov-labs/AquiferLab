/**
 * Exportación del modelo actual al contrato hidrogeológico hydro_model 0.1.0
 * alojado en GeoData Core. Transformación pura: nunca modifica la entrada y
 * rechaza explícitamente los estados que el contrato 0.1.0 no puede
 * representar sin pérdida.
 */

import type { GroundwaterModelInput } from "./groundwater.js";

export const HYDRO_MODEL_CONTRACT_VERSION = "0.1.0" as const;

export interface HydroModelPayload {
  contract_version: typeof HYDRO_MODEL_CONTRACT_VERSION;
  model: { confined: true; steady_state: true };
  units: { length: "m"; time: "day" };
  grid: {
    rows: number;
    columns: number;
    cell_size_x: number;
    cell_size_y: number;
  };
  aquifer: {
    hydraulic_conductivity: number;
    thickness: number;
  };
  fixed_heads: Array<{ row: number; column: number; head: number }>;
  extraction_wells: Array<{
    row: number;
    column: number;
    extraction_rate: number;
  }>;
  recharge: 0;
}

/** Error controlado cuando el modelo actual no es representable bajo hydro_model 0.1.0. */
export class ContractExportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContractExportError";
  }
}

export function exportToHydroModel(
  input: Readonly<GroundwaterModelInput>,
): HydroModelPayload {
  if (input.rechargeMetersPerDay !== 0) {
    throw new ContractExportError(
      "hydro_model 0.1.0 solo soporta recharge=0; el modelo tiene una recarga distinta de cero que no puede descartarse sin pérdida.",
    );
  }

  return {
    contract_version: HYDRO_MODEL_CONTRACT_VERSION,
    model: { confined: true, steady_state: true },
    units: { length: "m", time: "day" },
    grid: {
      rows: input.rows,
      columns: input.columns,
      cell_size_x: input.widthMeters / input.columns,
      cell_size_y: input.heightMeters / input.rows,
    },
    aquifer: {
      hydraulic_conductivity: input.hydraulicConductivityMetersPerDay,
      thickness: input.thicknessMeters,
    },
    fixed_heads: input.fixedHeadCells.map((cell) => ({
      row: cell.row,
      column: cell.column,
      head: cell.headMeters,
    })),
    extraction_wells: input.wells.map((well) => ({
      row: well.row,
      column: well.column,
      extraction_rate: well.rateCubicMetersPerDay,
    })),
    recharge: 0,
  };
}

export function serializeHydroModel(payload: Readonly<HydroModelPayload>): string {
  return JSON.stringify(payload);
}
