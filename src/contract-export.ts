/**
 * Exports the current model to the hydrogeological hydro_model 0.1.0 contract
 * hosted in GeoData Core. Pure transformation: it never modifies the input and
 * explicitly rejects states that the 0.1.0 contract cannot represent without loss.
 */

import type { GroundwaterModelInput } from "./groundwater.js";

export const HYDRO_MODEL_CONTRACT_VERSION = "0.1.0" as const;
export const HYDRO_MODEL_FILENAME = "hydro_model.json";

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

/** Controlled error when the current model is not representable under hydro_model 0.1.0. */
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
      "hydro_model 0.1.0 supports only recharge=0; the model has non-zero recharge that cannot be discarded without loss.",
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

/** Prepares the contract content that the interface provides as a download. */
export function prepareHydroModelDownload(
  input: Readonly<GroundwaterModelInput>,
): { filename: typeof HYDRO_MODEL_FILENAME; content: string } {
  return {
    filename: HYDRO_MODEL_FILENAME,
    content: serializeHydroModel(exportToHydroModel(input)),
  };
}
