import { describe, expect, it } from "vitest";

import type { DarcyFlowField } from "./flow.js";
import {
  calculateQualitativeStreamlines,
  createStreamlineSeeds,
  integrateStreamline,
  type StreamlineDomain,
  type StreamlineOptions,
} from "./streamlines.js";

const domain: StreamlineDomain = {
  widthMeters: 100,
  heightMeters: 100,
  rows: 5,
  columns: 5,
};

const options: StreamlineOptions = {
  stepLengthMeters: 5,
  maxSteps: 100,
  maxLengthMeters: 1_000,
  nearZeroFlowMetersPerDay: 1e-9,
  targetToleranceMeters: 4,
  stagnationToleranceMeters: 1e-8,
  repetitionToleranceMeters: 1,
};

function fieldFrom(
  vectorAt: (xMeters: number, zMeters: number) => { qxMetersPerDay: number; qzMetersPerDay: number },
): DarcyFlowField {
  const vectors = Array.from({ length: domain.rows }, (_, row) =>
    Array.from({ length: domain.columns }, (_, column) => {
      const vector = vectorAt((column + 0.5) * 20, (row + 0.5) * 20);
      return {
        row,
        column,
        ...vector,
        magnitudeMetersPerDay: Math.hypot(vector.qxMetersPerDay, vector.qzMetersPerDay),
      };
    }),
  ).flat();
  return {
    vectors,
    maxMagnitudeMetersPerDay: Math.max(...vectors.map((vector) => vector.magnitudeMetersPerDay)),
  };
}

describe("líneas de flujo cualitativas", () => {
  it("en un campo uniforme genera líneas rectas con la dirección esperada", () => {
    const trace = integrateStreamline(
      domain,
      fieldFrom(() => ({ qxMetersPerDay: 2, qzMetersPerDay: 0 })),
      { xMeters: 15, zMeters: 45 },
      [],
      options,
      1,
    );

    expect(trace.termination).toBe("outOfDomain");
    expect(trace.points.at(-1)).toEqual({ xMeters: 100, zMeters: 45 });
    for (const point of trace.points) {
      expect(point.zMeters).toBeCloseTo(45, 12);
    }
  });

  it("en un campo radial hacia un pozo las líneas se aproximan al pozo", () => {
    const well = { xMeters: 50, zMeters: 50, kind: "well" as const };
    const trace = integrateStreamline(
      domain,
      fieldFrom((xMeters, zMeters) => {
        const distance = Math.hypot(well.xMeters - xMeters, well.zMeters - zMeters);
        return distance === 0
          ? { qxMetersPerDay: 0, qzMetersPerDay: 0 }
          : {
              qxMetersPerDay: (well.xMeters - xMeters) / distance,
              qzMetersPerDay: (well.zMeters - zMeters) / distance,
            };
      }),
      { xMeters: 15, zMeters: 30 },
      [well],
      options,
      1,
    );

    const lastPoint = trace.points.at(-1)!;
    expect(trace.termination).toBe("well");
    expect(Math.hypot(lastPoint.xMeters - well.xMeters, lastPoint.zMeters - well.zMeters)).toBeLessThanOrEqual(options.targetToleranceMeters);
  });

  it("termina de forma segura en una región de flujo prácticamente nulo", () => {
    const trace = integrateStreamline(
      domain,
      fieldFrom(() => ({ qxMetersPerDay: 1e-12, qzMetersPerDay: 0 })),
      { xMeters: 50, zMeters: 50 },
      [],
      options,
      1,
    );

    expect(trace.termination).toBe("nearZeroFlow");
    expect(trace.points).toHaveLength(1);
  });

  it("recorta la trayectoria cuando sale del dominio", () => {
    const trace = integrateStreamline(
      domain,
      fieldFrom(() => ({ qxMetersPerDay: -1, qzMetersPerDay: 0 })),
      { xMeters: 7, zMeters: 50 },
      [],
      options,
      1,
    );

    expect(trace.termination).toBe("outOfDomain");
    expect(trace.points.at(-1)).toEqual({ xMeters: 0, zMeters: 50 });
  });

  it("termina exactamente en el primer borde incluso con un paso grande", () => {
    const trace = integrateStreamline(
      domain,
      fieldFrom(() => ({ qxMetersPerDay: 3, qzMetersPerDay: 4 })),
      { xMeters: 10, zMeters: 20 },
      [],
      { ...options, stepLengthMeters: 250 },
      1,
    );

    expect(trace.termination).toBe("outOfDomain");
    expect(trace.points).toEqual([{ xMeters: 10, zMeters: 20 }, { xMeters: 70, zMeters: 100 }]);
  });

  it("respeta el límite máximo de pasos", () => {
    const trace = integrateStreamline(
      domain,
      fieldFrom(() => ({ qxMetersPerDay: 1, qzMetersPerDay: 0 })),
      { xMeters: 20, zMeters: 50 },
      [],
      { ...options, maxSteps: 3 },
      1,
    );

    expect(trace.termination).toBe("maxSteps");
    expect(trace.points).toHaveLength(4);
  });

  it("no genera NaN ni infinito", () => {
    const field = fieldFrom((xMeters, zMeters) => ({
      qxMetersPerDay: 50 - zMeters,
      qzMetersPerDay: xMeters - 50,
    }));
    const lines = calculateQualitativeStreamlines({
      domain,
      field,
      seeds: createStreamlineSeeds(domain, 3, 3),
      targets: [],
      options: { ...options, maxSteps: 30 },
    });

    for (const line of lines) {
      for (const point of line.points) {
        expect(Number.isFinite(point.xMeters)).toBe(true);
        expect(Number.isFinite(point.zMeters)).toBe(true);
        expect(point.xMeters).toBeGreaterThanOrEqual(0);
        expect(point.xMeters).toBeLessThanOrEqual(domain.widthMeters);
        expect(point.zMeters).toBeGreaterThanOrEqual(0);
        expect(point.zMeters).toBeLessThanOrEqual(domain.heightMeters);
      }
    }
  });

  it("no cambia la dirección al multiplicar q por una constante positiva", () => {
    const unitField = fieldFrom(() => ({ qxMetersPerDay: 3, qzMetersPerDay: 4 }));
    const scaledField = fieldFrom(() => ({ qxMetersPerDay: 21, qzMetersPerDay: 28 }));
    const seed = { xMeters: 20, zMeters: 20 };
    const unitTrace = integrateStreamline(domain, unitField, seed, [], options, 1);
    const scaledTrace = integrateStreamline(domain, scaledField, seed, [], options, 1);

    expect(scaledTrace.termination).toBe(unitTrace.termination);
    expect(scaledTrace.points).toHaveLength(unitTrace.points.length);
    for (const [index, point] of unitTrace.points.entries()) {
      expect(scaledTrace.points[index].xMeters).toBeCloseTo(point.xMeters, 12);
      expect(scaledTrace.points[index].zMeters).toBeCloseTo(point.zMeters, 12);
    }
  });
});
