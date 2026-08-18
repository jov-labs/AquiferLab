import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  updateWellMarkerPositions,
  type SceneDomain,
  type WellMarkerPositionTarget,
} from "./scene.js";

const domain: SceneDomain = {
  widthMeters: 1_000,
  heightMeters: 800,
  rows: 4,
  columns: 5,
};

function markerTarget(): WellMarkerPositionTarget {
  return { marker: new THREE.Mesh(), label: {} };
}

describe("updateWellMarkerPositions", () => {
  it("places markers A and B at the centers of their respective well cells", () => {
    const markerA = markerTarget();
    const markerB = markerTarget();

    updateWellMarkerPositions(
      domain,
      [markerA, markerB],
      { row: 0, column: 0, rateCubicMetersPerDay: -10 },
      { row: 3, column: 4, rateCubicMetersPerDay: -20 },
    );

    expect(markerA.marker.position.toArray()).toEqual([-400, -2, -300]);
    expect(markerB.marker.position.toArray()).toEqual([400, -2, 300]);
  });

  it("moves each existing marker independently when its well position changes", () => {
    const markerA = markerTarget();
    const markerB = markerTarget();
    const wellA = { row: 0, column: 0, rateCubicMetersPerDay: -10 };
    const wellB = { row: 3, column: 4, rateCubicMetersPerDay: -20 };

    updateWellMarkerPositions(domain, [markerA, markerB], wellA, wellB);
    updateWellMarkerPositions(
      domain,
      [markerA, markerB],
      { ...wellA, row: 1, column: 3 },
      wellB,
    );

    expect(markerA.marker.position.toArray()).toEqual([200, -2, -100]);
    expect(markerB.marker.position.toArray()).toEqual([400, -2, 300]);

    updateWellMarkerPositions(
      domain,
      [markerA, markerB],
      { ...wellA, row: 1, column: 3 },
      { ...wellB, row: 2, column: 1 },
    );

    expect(markerA.marker.position.toArray()).toEqual([200, -2, -100]);
    expect(markerB.marker.position.toArray()).toEqual([-200, -2, 100]);
  });

  it("returns existing markers to the historical input positions without creating duplicates", () => {
    const historicalDomain: SceneDomain = {
      widthMeters: 2_000,
      heightMeters: 2_000,
      rows: 41,
      columns: 41,
    };
    const markerA = markerTarget();
    const markerB = markerTarget();
    const markers = [markerA, markerB];

    updateWellMarkerPositions(
      historicalDomain,
      markers,
      { row: 2, column: 3, rateCubicMetersPerDay: -10 },
      { row: 4, column: 5, rateCubicMetersPerDay: -20 },
    );
    updateWellMarkerPositions(
      historicalDomain,
      markers,
      { row: 20, column: 20, rateCubicMetersPerDay: -10 },
      { row: 28, column: 30, rateCubicMetersPerDay: -20 },
    );

    expect(markers).toHaveLength(2);
    expect(markers[0]).toBe(markerA);
    expect(markers[1]).toBe(markerB);
    expect(markers[0].label).toBe(markerA.label);
    expect(markers[1].label).toBe(markerB.label);
    expect(markerA.marker.position.toArray()).toEqual([0, -2, 0]);
    expect(markerB.marker.position.x).toBeCloseTo(487.8048780487805);
    expect(markerB.marker.position.y).toBe(-2);
    expect(markerB.marker.position.z).toBeCloseTo(390.2439024390244);
  });
});
