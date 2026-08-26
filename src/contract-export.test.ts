import { describe, expect, it } from "vitest";

import type { GroundwaterModelInput } from "./groundwater.js";
import {
  ContractExportError,
  exportToHydroModel,
  serializeHydroModel,
} from "./contract-export.js";

/** Caso asimétrico comprobado en GDC-P1.3. */
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

describe("exportación hydro_model 0.1.0", () => {
  it("exporta el caso asimétrico con celdas de 100 m", () => {
    const input = asymmetricCase();
    const payload = exportToHydroModel(input);
    expect(payload.grid).toEqual({
      rows: 3,
      columns: 4,
      cell_size_x: 100,
      cell_size_y: 100,
    });
  });

  it("usa exactamente contract_version 0.1.0", () => {
    expect(exportToHydroModel(asymmetricCase()).contract_version).toBe("0.1.0");
  });

  it("usa exactamente unidades m/day", () => {
    const payload = exportToHydroModel(asymmetricCase());
    expect(payload.units).toEqual({ length: "m", time: "day" });
    expect(payload.model).toEqual({ confined: true, steady_state: true });
  });

  it("conserva posiciones y valores de CHD y pozos con extracción positiva", () => {
    const payload = exportToHydroModel(asymmetricCase());
    expect(payload.fixed_heads).toEqual([
      { row: 0, column: 0, head: 12 },
      { row: 2, column: 3, head: 8 },
    ]);
    expect(payload.extraction_wells).toEqual([
      { row: 0, column: 3, extraction_rate: 100 },
    ]);
  });

  it("no modifica la entrada", () => {
    const input = asymmetricCase();
    const copy = structuredClone(input);
    exportToHydroModel(input);
    expect(input).toEqual(copy);
  });

  it("es determinista para la misma entrada", () => {
    const first = serializeHydroModel(exportToHydroModel(asymmetricCase()));
    const second = serializeHydroModel(exportToHydroModel(asymmetricCase()));
    expect(first).toBe(second);
  });

  it("rechaza recarga distinta de cero en lugar de descartarla", () => {
    const input = asymmetricCase();
    input.rechargeMetersPerDay = 120 / 1000 / 365;
    expect(() => exportToHydroModel(input)).toThrow(ContractExportError);
  });

  it("no emite campos fuera del contrato", () => {
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
