import { describe, expect, it } from "vitest";

import type { GroundwaterModelInput } from "./groundwater.js";
import {
  ContractExportError,
  exportToHydroModel,
  HYDRO_MODEL_FILENAME,
  prepareHydroModelDownload,
  serializeHydroModel,
} from "./contract-export.js";

/** Asymmetric case verified in GDC-P1.3. */
function asymmetricCase(): GroundwaterModelInput {
  return {
    widthMeters: 400,
    heightMeters: 300,
    rows: 3,
    columns: 4,
    hydraulicConductivityMetersPerDay: 1,
    thicknessMeters: 10,
    rechargeMetersPerDay: 0,
    fixedHeadCells: [
      { row: 0, column: 0, headMeters: 12 },
      { row: 2, column: 3, headMeters: 8 },
    ],
    wells: [{ row: 0, column: 3, rateCubicMetersPerDay: 100 }],
    tolerance: 1e-8,
    maxIterations: 50000,
  };
}

describe("hydro_model 0.1.0 export", () => {
  it("exports the asymmetric case with 100 m cells", () => {
    const input = asymmetricCase();
    const payload = exportToHydroModel(input);
    expect(payload.grid).toEqual({
      rows: 3,
      columns: 4,
      cell_size_x: 100,
      cell_size_y: 100,
    });
  });

  it("uses contract_version 0.1.0 exactly", () => {
    expect(exportToHydroModel(asymmetricCase()).contract_version).toBe("0.1.0");
  });

  it("uses m/day units exactly", () => {
    const payload = exportToHydroModel(asymmetricCase());
    expect(payload.units).toEqual({ length: "m", time: "day" });
    expect(payload.model).toEqual({ confined: true, steady_state: true });
  });

  it("preserves CHD positions and values and wells with positive extraction", () => {
    const payload = exportToHydroModel(asymmetricCase());
    expect(payload.fixed_heads).toEqual([
      { row: 0, column: 0, head: 12 },
      { row: 2, column: 3, head: 8 },
    ]);
    expect(payload.extraction_wells).toEqual([
      { row: 0, column: 3, extraction_rate: 100 },
    ]);
  });

  it("does not modify the input", () => {
    const input = asymmetricCase();
    const copy = structuredClone(input);
    exportToHydroModel(input);
    expect(input).toEqual(copy);
  });

  it("is deterministic for the same input", () => {
    const first = serializeHydroModel(exportToHydroModel(asymmetricCase()));
    const second = serializeHydroModel(exportToHydroModel(asymmetricCase()));
    expect(first).toBe(second);
  });

  it("prepares hydro_model.json from contract serialization", () => {
    const input = asymmetricCase();
    const copy = structuredClone(input);
    const download = prepareHydroModelDownload(input);

    expect(download.filename).toBe(HYDRO_MODEL_FILENAME);
    expect(download.filename).toBe("hydro_model.json");
    expect(download.content).toBe(serializeHydroModel(exportToHydroModel(input)));
    expect(JSON.parse(download.content).contract_version).toBe("0.1.0");
    expect(input).toEqual(copy);
  });

  it("rejects non-zero recharge rather than discarding it", () => {
    const input = asymmetricCase();
    input.rechargeMetersPerDay = 120 / 1000 / 365;
    expect(() => exportToHydroModel(input)).toThrow(ContractExportError);
    expect(() => prepareHydroModelDownload(input)).toThrow(ContractExportError);
    expect(() => exportToHydroModel(input)).toThrow(
      "hydro_model 0.1.0 supports only recharge=0",
    );
  });

  it("does not emit fields outside the contract", () => {
    const payload = exportToHydroModel(asymmetricCase());
    expect(Object.keys(payload).sort()).toEqual(
      [
        "aquifer",
        "contract_version",
        "extraction_wells",
        "fixed_heads",
        "grid",
        "model",
        "recharge",
        "units",
      ].sort(),
    );
    expect(Object.hasOwn(payload, "tolerance")).toBe(false);
    expect(Object.hasOwn(payload, "maxIterations")).toBe(false);
  });
});
