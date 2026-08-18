import { describe, expect, it } from "vitest";

import { createDefaultModelInput, solveGroundwater } from "./groundwater.js";
import {
  createRegionalFixedHeadCells,
} from "./regional-reference.js";

const grid = { rows: 3, columns: 5 };
const headMeters = 107;

describe("referencia hidráulica regional", () => {
  it("reproduce exactamente la frontera histórica Oeste por defecto", () => {
    const input = createDefaultModelInput();
    const regionalInput = {
      ...input,
      fixedHeadCells: createRegionalFixedHeadCells(
        input,
        "west",
        input.fixedHeadCells[0].headMeters,
      ),
    };

    expect(regionalInput.fixedHeadCells).toEqual(input.fixedHeadCells);
    expect(solveGroundwater(regionalInput)).toEqual(solveGroundwater(input));
  });

  it.each([
    ["west", [{ row: 0, column: 0, headMeters }, { row: 1, column: 0, headMeters }, { row: 2, column: 0, headMeters }]],
    ["east", [{ row: 0, column: 4, headMeters }, { row: 1, column: 4, headMeters }, { row: 2, column: 4, headMeters }]],
    ["north", [{ row: 0, column: 0, headMeters }, { row: 0, column: 1, headMeters }, { row: 0, column: 2, headMeters }, { row: 0, column: 3, headMeters }, { row: 0, column: 4, headMeters }]],
    ["south", [{ row: 2, column: 0, headMeters }, { row: 2, column: 1, headMeters }, { row: 2, column: 2, headMeters }, { row: 2, column: 3, headMeters }, { row: 2, column: 4, headMeters }]],
  ] as const)("genera exactamente el borde %s", (side, expected) => {
    expect(createRegionalFixedHeadCells(grid, side, headMeters)).toEqual(expected);
  });

  it.each(["west", "east", "north", "south"] as const)(
    "no incluye celdas interiores al generar %s",
    (side) => {
      const cells = createRegionalFixedHeadCells(grid, side, headMeters);

      expect(cells).not.toContainEqual({ row: 1, column: 2, headMeters });
      expect(cells).toHaveLength(side === "west" || side === "east" ? grid.rows : grid.columns);
    },
  );

  it("incluye las esquinas como parte normal del borde seleccionado", () => {
    expect(createRegionalFixedHeadCells(grid, "west", headMeters)).toEqual(
      expect.arrayContaining([
        { row: 0, column: 0, headMeters },
        { row: grid.rows - 1, column: 0, headMeters },
      ]),
    );
    expect(createRegionalFixedHeadCells(grid, "north", headMeters)).toEqual(
      expect.arrayContaining([
        { row: 0, column: 0, headMeters },
        { row: 0, column: grid.columns - 1, headMeters },
      ]),
    );
  });

  it("cambiar de lado cambia la solución sin alterar el solver", () => {
    const base = {
      ...createDefaultModelInput(),
      rows: 5,
      columns: 7,
      wells: [{ row: 2, column: 4, rateCubicMetersPerDay: 25 }],
    };
    const west = solveGroundwater({
      ...base,
      fixedHeadCells: createRegionalFixedHeadCells(base, "west", 100),
    });
    const east = solveGroundwater({
      ...base,
      fixedHeadCells: createRegionalFixedHeadCells(base, "east", 100),
    });

    expect(west.converged).toBe(true);
    expect(east.converged).toBe(true);
    expect(east.headsMeters[2][0]).not.toBe(west.headsMeters[2][0]);
  });
});
