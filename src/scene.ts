import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { LineSegments2 } from "three/addons/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";
import type { DarcyFlowField } from "./flow.js";
import type { QualitativeStreamline } from "./streamlines.js";

const SURFACE_GRID_INTERVAL = 3;
const OVERLAY_SURFACE_MARGIN_METERS = 8;
const GRID_OVERLAY_OFFSET_METERS = 0.75;
const DARCY_OVERLAY_OFFSET_METERS = 16;
const DARCY_VISUAL_SAMPLE_INTERVAL = 7;
const DARCY_MAX_ARROW_LENGTH = 480;
const DARCY_DOMAIN_MARGIN = 32;
const MIN_DARCY_ARROW_LENGTH = 24;
const STREAMLINE_OVERLAY_OFFSET_METERS = 20;
const CUT_LABEL_PLANE_TOLERANCE_METERS = 1e-6;

/** Escala visual pura del abatimiento no negativo usando el rango real visible. */
export function getPositiveDrawdownColor(
  drawdownMeters: number,
  minimumDrawdownMeters: number,
  maximumDrawdownMeters: number,
): THREE.Color {
  const minimumColor = new THREE.Color(0xffffff);
  if (maximumDrawdownMeters === minimumDrawdownMeters) {
    return minimumColor;
  }
  const normalized = THREE.MathUtils.clamp(
    (drawdownMeters - minimumDrawdownMeters) /
      (maximumDrawdownMeters - minimumDrawdownMeters),
    0,
    1,
  );
  const visualT = Math.pow(normalized, 0.70);
  const [start, end, segmentT] = visualT <= 0.5
    ? [[255, 255, 255], [31, 122, 58], visualT / 0.5]
    : [[31, 122, 58], [255, 0, 0], Math.min(1, (visualT - 0.5) / 0.3)];
  const red = THREE.MathUtils.lerp(start[0], end[0], segmentT);
  const green = THREE.MathUtils.lerp(start[1], end[1], segmentT);
  const blue = THREE.MathUtils.lerp(start[2], end[2], segmentT);
  return new THREE.Color().setRGB(
    red / 255,
    green / 255,
    blue / 255,
    THREE.SRGBColorSpace,
  );
}

export interface SceneDomain {
  widthMeters: number;
  heightMeters: number;
  rows: number;
  columns: number;
}

export interface WellMarker {
  row: number;
  column: number;
  label: string;
}

export interface PiezometricSurfaceData {
  headsMeters: readonly (readonly number[])[];
  drawdownMeters: readonly (readonly number[])[];
  referenceHeadMeters: number;
}

export interface DarcyOverlayData {
  field: DarcyFlowField;
  headsMeters: readonly (readonly number[])[];
  referenceHeadMeters: number;
}

export interface QualitativeStreamlineOverlayData {
  lines: readonly QualitativeStreamline[];
  headsMeters: readonly (readonly number[])[];
  referenceHeadMeters: number;
}

export interface SceneVisualOptions {
  readonly showRiver?: boolean;
}

export interface AquiferScene {
  updatePiezometricSurface(data: PiezometricSurfaceData): void;
  updateDarcyFlow(data: DarcyOverlayData): void;
  updateQualitativeStreamlines(data: QualitativeStreamlineOverlayData): void;
  setRiverVisible(visible: boolean): void;
  setDarcyFlowVisible(visible: boolean): void;
  setQualitativeStreamlinesVisible(visible: boolean): void;
  setGeologicalCut(enabled: boolean, positionPercent: number): void;
}

/** Representación Three.js: recibe campos ya resueltos, sin cálculo hidrogeológico. */
export function createAquiferScene(
  container: HTMLElement,
  domain: SceneDomain,
  wells: readonly WellMarker[],
  options: SceneVisualOptions = {},
): AquiferScene {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x09111f);

  const camera = new THREE.PerspectiveCamera(42, 1, 1, 40_000);
  camera.position.set(1_700, 1_450, 1_700);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.localClippingEnabled = true;
  container.append(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, -10, 0);
  controls.enableDamping = true;
  controls.minDistance = 500;
  controls.maxDistance = 20_000;

  scene.add(new THREE.HemisphereLight(0xb9d8ff, 0x152033, 2.2));
  const keyLight = new THREE.DirectionalLight(0xffffff, 2.4);
  keyLight.position.set(900, 1_500, 600);
  scene.add(keyLight);
  const cutPlane = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0);
  const clippingPlanes = [cutPlane];
  const clippingMaterials: THREE.Material[] = [];

  addGeologicalContext(scene, domain, clippingMaterials);
  let riverLabel = options.showRiver === false
    ? null
    : addRiver(scene, container, domain, clippingMaterials);
  const wellLabels = wells.map((well) =>
    addWellMarker(scene, container, domain, well, clippingMaterials),
  );

  const surfaceGeometry = createSurfaceGeometry(domain);
  const surfaceMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    vertexColors: true,
    transparent: false,
    opacity: 1,
    side: THREE.DoubleSide,
  });
  clippingMaterials.push(surfaceMaterial);
  const surface = new THREE.Mesh(surfaceGeometry, surfaceMaterial);
  surface.name = "Superficie piezométrica curvada (oculta en modo abatimiento)";
  surface.visible = false;
  surface.renderOrder = 2;
  scene.add(surface);
  const drawdownPlaneGeometry = createSurfaceGeometry(domain);
  const drawdownPlaneMaterial = surfaceMaterial.clone();
  clippingMaterials.push(drawdownPlaneMaterial);
  const drawdownPlane = new THREE.Mesh(drawdownPlaneGeometry, drawdownPlaneMaterial);
  drawdownPlane.name = "Mapa horizontal de abatimiento";
  drawdownPlane.renderOrder = 2;
  scene.add(drawdownPlane);
  const surfaceGridGeometry = new LineSegmentsGeometry();
  const surfaceGridMaterial = new LineMaterial({
    color: 0x000000,
    linewidth: 1.3,
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
  });
  clippingMaterials.push(surfaceGridMaterial);
  const surfaceGrid = new LineSegments2(surfaceGridGeometry, surfaceGridMaterial);
  surfaceGrid.name = "Cuadrícula de superficie piezométrica";
  surfaceGrid.renderOrder = 3;
  surfaceGrid.frustumCulled = false;
  scene.add(surfaceGrid);
  const darcyGroup = new THREE.Group();
  darcyGroup.name = "Campo de descarga específica de Darcy";
  darcyGroup.renderOrder = 4;
  scene.add(darcyGroup);
  const darcyArrows: THREE.Group[] = [];
  const streamlineGroup = new THREE.Group();
  streamlineGroup.name = "Líneas de flujo cualitativas";
  streamlineGroup.renderOrder = 5;
  scene.add(streamlineGroup);
  const streamlines: THREE.Line[] = [];
  let overlayY = 0;
  let cutEnabled = false;
  let cutX = domain.widthMeters / 2;
  let lastWidth = 0;
  let lastHeight = 0;
  let resizeFrame = 0;
  const wellWorldPosition = new THREE.Vector3();
  const wellLabelWorldPosition = new THREE.Vector3();
  const riverLabelWorldPosition = new THREE.Vector3();

  const resize = () => {
    resizeFrame = 0;
    const { width, height } = container.getBoundingClientRect();
    if (width <= 0 || height <= 0 || (width === lastWidth && height === lastHeight)) {
      return;
    }
    lastWidth = width;
    lastHeight = height;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    surfaceGridMaterial.resolution.set(width, height);
  };
  const scheduleResize = () => {
    if (resizeFrame === 0) {
      resizeFrame = window.requestAnimationFrame(resize);
    }
  };
  resize();
  new ResizeObserver(scheduleResize).observe(container);

  const render = () => {
    controls.update();
    scene.updateMatrixWorld(true);
    camera.updateMatrixWorld();
    updateWellLabelPositions(
      camera,
      container,
      wellLabels,
      cutEnabled,
      cutPlane,
      wellWorldPosition,
      wellLabelWorldPosition,
    );
    if (riverLabel) {
      updateRiverLabelPosition(camera, container, riverLabel, riverLabelWorldPosition);
    }
    renderer.render(scene, camera);
    window.requestAnimationFrame(render);
  };
  render();

  return {
    updatePiezometricSurface(data: PiezometricSurfaceData): void {
      updateSurfaceVertices(surfaceGeometry, domain, data);
      overlayY = surfaceMaximumY(data.headsMeters, data.referenceHeadMeters) + OVERLAY_SURFACE_MARGIN_METERS;
      updateSurfaceVertices(drawdownPlaneGeometry, domain, data, overlayY);
      updateSurfaceGrid(surfaceGridGeometry, domain, overlayY + GRID_OVERLAY_OFFSET_METERS);
    },
    updateDarcyFlow(data: DarcyOverlayData): void {
      updateDarcyArrows(darcyGroup, darcyArrows, domain, data, overlayY, cutEnabled, cutX);
    },
    updateQualitativeStreamlines(data: QualitativeStreamlineOverlayData): void {
      updateStreamlineLines(streamlineGroup, streamlines, domain, data);
    },
    setDarcyFlowVisible(visible: boolean): void {
      darcyGroup.visible = visible;
    },
    setQualitativeStreamlinesVisible(visible: boolean): void {
      streamlineGroup.visible = visible;
    },
    setRiverVisible(visible: boolean): void {
      if (visible && !riverLabel) {
        riverLabel = addRiver(scene, container, domain, clippingMaterials);
      } else if (!visible && riverLabel) {
        scene.remove(riverLabel.marker);
        riverLabel.label.remove();
        riverLabel = null;
      }
    },
    setGeologicalCut(enabled: boolean, positionPercent: number): void {
      const clampedPercent = THREE.MathUtils.clamp(positionPercent, 0, 100);
      cutX = -domain.widthMeters / 2 + (clampedPercent / 100) * domain.widthMeters;
      cutPlane.constant = cutX;
      if (cutEnabled !== enabled) {
        for (const material of clippingMaterials) {
          material.clippingPlanes = enabled ? clippingPlanes : [];
          material.needsUpdate = true;
        }
        cutEnabled = enabled;
      }
      for (const arrow of darcyArrows) {
        arrow.visible = isRetainedByCut(arrow.userData.originX as number, cutEnabled, cutX);
      }
    },
  };
}

function addGeologicalContext(
  scene: THREE.Scene,
  domain: SceneDomain,
  clippingMaterials: THREE.Material[],
): void {
  const layers = [
    { name: "Unidad superior (contexto)", y: -12, color: 0x9d805f },
    { name: "Acuífero confinado", y: -25, color: 0x2d8d9b },
    { name: "Unidad basal (contexto)", y: -38, color: 0x5c6174 },
  ];

  for (const layer of layers) {
    const geometry = createGeologicalContextGeometry(domain);
    const material = new THREE.MeshStandardMaterial({
      color: layer.color,
      transparent: true,
      opacity: 0.38,
      roughness: 0.8,
      depthWrite: false,
    });
    clippingMaterials.push(material);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = layer.name;
    mesh.position.y = layer.y;
    mesh.renderOrder = 1;
    scene.add(mesh);
  }
}

function createGeologicalContextGeometry(domain: SceneDomain): THREE.BoxGeometry {
  const geometry = new THREE.BoxGeometry(domain.widthMeters, 10, domain.heightMeters);
  // BoxGeometry asigna el grupo 2 a la cara superior. Se conserva el resto del bloque como contexto lateral.
  const sideAndBottomGroups = geometry.groups.filter((group) => group.materialIndex !== 2);
  geometry.clearGroups();
  for (const group of sideAndBottomGroups) {
    geometry.addGroup(group.start, group.count, group.materialIndex);
  }
  return geometry;
}

function addRiver(
  scene: THREE.Scene,
  container: HTMLElement,
  domain: SceneDomain,
  clippingMaterials: THREE.Material[],
): { marker: THREE.Mesh; label: HTMLDivElement } {
  const geometry = new THREE.BoxGeometry(24, 5, domain.heightMeters);
  const material = new THREE.MeshStandardMaterial({
    color: 0x287fd1,
    emissive: 0x0a315d,
    roughness: 0.25,
  });
  clippingMaterials.push(material);
  const river = new THREE.Mesh(geometry, material);
  // column = 0 está en el borde occidental del dominio visual.
  river.position.set(-domain.widthMeters / 2, 1, 0);
  river.name = "Nivel del agua del río: 100 m";
  scene.add(river);

  const label = document.createElement("div");
  label.className = "river-label";
  label.textContent =
    document.documentElement.lang === "en" ? "River" : "Río";
  container.append(label);

  return { marker: river, label };
}

function addWellMarker(
  scene: THREE.Scene,
  container: HTMLElement,
  domain: SceneDomain,
  well: WellMarker,
  clippingMaterials: THREE.Material[],
): { marker: THREE.Mesh; label: HTMLDivElement } {
  const geometry = new THREE.CylinderGeometry(18, 18, 72, 20);
  const material = new THREE.MeshStandardMaterial({
    color: 0xf3c760,
    emissive: 0x5a3d00,
    roughness: 0.45,
  });
  clippingMaterials.push(material);
  const marker = new THREE.Mesh(geometry, material);
  const position = cellCenterPosition(domain, well.row, well.column);
  marker.position.set(position.x, -2, position.z);
  marker.name = well.label;
  scene.add(marker);

  const label = document.createElement("div");
  label.className = "well-label";
  label.textContent = well.label.slice(-1);
  label.setAttribute("aria-label", well.label);
  container.append(label);
  return { marker, label };
}

function createSurfaceGeometry(domain: SceneDomain): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(domain.rows * domain.columns * 3);
  const colors = new Float32Array(domain.rows * domain.columns * 3);
  const indices: number[] = [];

  for (let row = 0; row < domain.rows - 1; row += 1) {
    for (let column = 0; column < domain.columns - 1; column += 1) {
      const topLeft = row * domain.columns + column;
      const topRight = topLeft + 1;
      const bottomLeft = (row + 1) * domain.columns + column;
      const bottomRight = bottomLeft + 1;
      indices.push(topLeft, bottomLeft, topRight, topRight, bottomLeft, bottomRight);
    }
  }

  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  return geometry;
}

function updateSurfaceVertices(
  geometry: THREE.BufferGeometry,
  domain: SceneDomain,
  data: PiezometricSurfaceData,
  flatY: number | undefined = undefined,
): void {
  const positions = geometry.getAttribute("position") as THREE.BufferAttribute;
  const colors = geometry.getAttribute("color") as THREE.BufferAttribute;
  const { minimumDrawdownMeters, maximumDrawdownMeters } = drawdownRange(data.drawdownMeters);
  const hasNegativeDrawdown = minimumDrawdownMeters < 0;
  const zeroColor = new THREE.Color(0xffffff);
  const divergentPositiveColor = new THREE.Color(0x001a4d);
  const negativeColor = new THREE.Color(0x3155d9);
  const vertexColor = new THREE.Color();
  for (let row = 0; row < domain.rows; row += 1) {
    for (let column = 0; column < domain.columns; column += 1) {
      const index = row * domain.columns + column;
      const position = cellCenterPosition(domain, row, column);
      positions.setXYZ(
        index,
        position.x,
        flatY ?? data.headsMeters[row][column] - data.referenceHeadMeters,
        position.z,
      );
      setDrawdownColor(
        vertexColor,
        data.drawdownMeters[row][column],
        minimumDrawdownMeters,
        maximumDrawdownMeters,
        hasNegativeDrawdown,
        negativeColor,
        zeroColor,
        divergentPositiveColor,
      );
      colors.setXYZ(index, vertexColor.r, vertexColor.g, vertexColor.b);
    }
  }
  positions.needsUpdate = true;
  colors.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
}

function updateSurfaceGrid(
  geometry: LineSegmentsGeometry,
  domain: SceneDomain,
  overlayY: number,
): void {
  const positions: number[] = [];
  const rows = gridLineIndices(domain.rows);
  const columns = gridLineIndices(domain.columns);
  for (const row of rows) {
    for (let index = 0; index < columns.length - 1; index += 1) {
      addSurfaceGridSegment(
        positions,
        domain,
        row,
        columns[index],
        row,
        columns[index + 1],
        overlayY,
      );
    }
  }
  for (const column of columns) {
    for (let index = 0; index < rows.length - 1; index += 1) {
      addSurfaceGridSegment(
        positions,
        domain,
        rows[index],
        column,
        rows[index + 1],
        column,
        overlayY,
      );
    }
  }
  geometry.setPositions(positions);
  geometry.computeBoundingSphere();
}

function gridLineIndices(size: number): number[] {
  const indices: number[] = [];
  for (let index = 0; index < size; index += SURFACE_GRID_INTERVAL) {
    indices.push(index);
  }
  if (indices[indices.length - 1] !== size - 1) {
    indices.push(size - 1);
  }
  return indices;
}

function addSurfaceGridSegment(
  positions: number[],
  domain: SceneDomain,
  startRow: number,
  startColumn: number,
  endRow: number,
  endColumn: number,
  overlayY: number,
): void {
  const start = cellCenterPosition(domain, startRow, startColumn);
  const end = cellCenterPosition(domain, endRow, endColumn);
  positions.push(
    start.x,
    overlayY,
    start.z,
    end.x,
    overlayY,
    end.z,
  );
}

function surfaceMaximumY(
  headsMeters: readonly (readonly number[])[],
  referenceHeadMeters: number,
): number {
  let maximumY = Number.NEGATIVE_INFINITY;
  for (const row of headsMeters) {
    for (const headMeters of row) {
      maximumY = Math.max(maximumY, headMeters - referenceHeadMeters);
    }
  }
  return maximumY;
}

function drawdownRange(drawdownMeters: readonly (readonly number[])[]): {
  minimumDrawdownMeters: number;
  maximumDrawdownMeters: number;
} {
  let minimumDrawdownMeters = Number.POSITIVE_INFINITY;
  let maximumDrawdownMeters = Number.NEGATIVE_INFINITY;
  for (const row of drawdownMeters) {
    for (const drawdown of row) {
      minimumDrawdownMeters = Math.min(minimumDrawdownMeters, drawdown);
      maximumDrawdownMeters = Math.max(maximumDrawdownMeters, drawdown);
    }
  }
  return { minimumDrawdownMeters, maximumDrawdownMeters };
}

function setDrawdownColor(
  target: THREE.Color,
  drawdown: number,
  minimumDrawdownMeters: number,
  maximumDrawdownMeters: number,
  hasNegativeDrawdown: boolean,
  negativeColor: THREE.Color,
  zeroColor: THREE.Color,
  divergentPositiveColor: THREE.Color,
): void {
  if (minimumDrawdownMeters === maximumDrawdownMeters) {
    target.copy(zeroColor);
    return;
  }
  if (hasNegativeDrawdown && drawdown < 0) {
    const relative = drawdown / minimumDrawdownMeters;
    target.lerpColors(zeroColor, negativeColor, relative);
    return;
  }
  if (maximumDrawdownMeters <= 0) {
    target.copy(zeroColor);
    return;
  }
  const normalized = drawdown / maximumDrawdownMeters;
  if (hasNegativeDrawdown) {
    target.lerpColors(zeroColor, divergentPositiveColor, normalized);
    return;
  }
  target.copy(getPositiveDrawdownColor(drawdown, minimumDrawdownMeters, maximumDrawdownMeters));
}

/**
 * Capa de presentación: transforma polilíneas ya integradas a geometría Three.js.
 * No interpreta q ni integra trayectorias.
 */
function updateStreamlineLines(
  group: THREE.Group,
  lineObjects: THREE.Line[],
  domain: SceneDomain,
  data: QualitativeStreamlineOverlayData,
): void {
  for (const line of lineObjects) {
    group.remove(line);
    line.geometry.dispose();
    disposeMaterial(line.material);
  }
  lineObjects.length = 0;

  for (const streamline of data.lines) {
    if (streamline.points.length < 2) {
      continue;
    }
    const positions: number[] = [];
    for (const point of streamline.points) {
      const surfacePosition = surfacePositionAtPhysicalPoint(
        domain,
        point.xMeters,
        point.zMeters,
      );
      positions.push(
        surfacePosition.x,
        interpolateSurfaceElevation(domain, data, point.xMeters, point.zMeters) + STREAMLINE_OVERLAY_OFFSET_METERS,
        surfacePosition.z,
      );
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.computeBoundingSphere();
    const material = new THREE.LineBasicMaterial({
      color: 0xffd166,
      transparent: true,
      opacity: 0.9,
      depthTest: false,
      depthWrite: false,
    });
    const line = new THREE.Line(geometry, material);
    line.name = "Línea de flujo cualitativa";
    line.renderOrder = 5;
    line.frustumCulled = false;
    lineObjects.push(line);
    group.add(line);
  }
}

function interpolateSurfaceElevation(
  domain: SceneDomain,
  data: Pick<QualitativeStreamlineOverlayData, "headsMeters" | "referenceHeadMeters">,
  xMeters: number,
  zMeters: number,
): number {
  const coordinates = surfaceCoordinatesAtPhysicalPoint(domain, xMeters, zMeters);
  const lowerColumn = Math.floor(coordinates.gridColumn);
  const upperColumn = Math.ceil(coordinates.gridColumn);
  const lowerRow = Math.floor(coordinates.gridRow);
  const upperRow = Math.ceil(coordinates.gridRow);
  const tx = coordinates.gridColumn - lowerColumn;
  const tz = coordinates.gridRow - lowerRow;
  const a = data.headsMeters[lowerRow][lowerColumn];
  const b = data.headsMeters[lowerRow][upperColumn];
  const c = data.headsMeters[upperRow][lowerColumn];
  const d = data.headsMeters[upperRow][upperColumn];
  const elevation = (a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + d * tx) * tz;
  return elevation - data.referenceHeadMeters;
}

/**
 * La superficie está definida en centros de celda, no en los extremos físicos
 * de la caja. Esta es la única conversión físico → Three.js para sus overlays.
 */
function surfacePositionAtPhysicalPoint(
  domain: SceneDomain,
  xMeters: number,
  zMeters: number,
): { x: number; z: number } {
  const coordinates = surfaceCoordinatesAtPhysicalPoint(domain, xMeters, zMeters);
  const dx = domain.widthMeters / domain.columns;
  const dz = domain.heightMeters / domain.rows;
  return {
    x: (coordinates.gridColumn + 0.5) * dx - domain.widthMeters / 2,
    z: (coordinates.gridRow + 0.5) * dz - domain.heightMeters / 2,
  };
}

function surfaceCoordinatesAtPhysicalPoint(
  domain: SceneDomain,
  xMeters: number,
  zMeters: number,
): { gridColumn: number; gridRow: number } {
  const dx = domain.widthMeters / domain.columns;
  const dz = domain.heightMeters / domain.rows;
  return {
    gridColumn: THREE.MathUtils.clamp(xMeters / dx - 0.5, 0, domain.columns - 1),
    gridRow: THREE.MathUtils.clamp(zMeters / dz - 0.5, 0, domain.rows - 1),
  };
}

function updateDarcyArrows(
  group: THREE.Group,
  arrows: THREE.Group[],
  domain: SceneDomain,
  data: DarcyOverlayData,
  overlayY: number,
  cutEnabled: boolean,
  cutX: number,
): void {
  for (const arrow of arrows) {
    group.remove(arrow);
    disposeDarcyArrow(arrow);
  }
  arrows.length = 0;

  if (data.field.maxMagnitudeMetersPerDay <= Number.EPSILON) {
    return;
  }

  for (const vector of data.field.vectors) {
    // El cálculo contiene cada celda interior; sólo se muestrea cada siete para legibilidad.
    if (
      (vector.row - 1) % DARCY_VISUAL_SAMPLE_INTERVAL !== 0 ||
      (vector.column - 1) % DARCY_VISUAL_SAMPLE_INTERVAL !== 0
    ) {
      continue;
    }
    if (vector.magnitudeMetersPerDay <= Number.EPSILON) {
      continue;
    }

    const position = cellCenterPosition(domain, vector.row, vector.column);
    const direction = new THREE.Vector3(vector.qxMetersPerDay, 0, vector.qzMetersPerDay).normalize();
    const relativeMagnitude = vector.magnitudeMetersPerDay / data.field.maxMagnitudeMetersPerDay;
    const visualRelativeMagnitude = Math.sqrt(relativeMagnitude);
    const requestedLength = DARCY_MAX_ARROW_LENGTH * visualRelativeMagnitude;
    const origin = new THREE.Vector3(
      position.x,
      overlayY + DARCY_OVERLAY_OFFSET_METERS,
      position.z,
    );
    const availableLength = distanceToInsetDomainBoundary(origin, direction, domain);
    const length = Math.min(requestedLength, availableLength);
    if (length < MIN_DARCY_ARROW_LENGTH) {
      continue;
    }
    const arrow = createDarcyArrow(origin, direction, length);
    arrow.userData.originX = origin.x;
    arrow.visible = isRetainedByCut(origin.x, cutEnabled, cutX);
    arrows.push(arrow);
    group.add(arrow);
  }
}

function distanceToInsetDomainBoundary(
  origin: THREE.Vector3,
  direction: THREE.Vector3,
  domain: SceneDomain,
): number {
  const minimumX = -domain.widthMeters / 2 + DARCY_DOMAIN_MARGIN;
  const maximumX = domain.widthMeters / 2 - DARCY_DOMAIN_MARGIN;
  const minimumZ = -domain.heightMeters / 2 + DARCY_DOMAIN_MARGIN;
  const maximumZ = domain.heightMeters / 2 - DARCY_DOMAIN_MARGIN;
  const distances: number[] = [];
  const epsilon = 1e-12;

  if (direction.x > epsilon) {
    distances.push((maximumX - origin.x) / direction.x);
  } else if (direction.x < -epsilon) {
    distances.push((minimumX - origin.x) / direction.x);
  }
  if (direction.z > epsilon) {
    distances.push((maximumZ - origin.z) / direction.z);
  } else if (direction.z < -epsilon) {
    distances.push((minimumZ - origin.z) / direction.z);
  }

  return Math.max(0, Math.min(...distances.filter(Number.isFinite)));
}

function createDarcyArrow(
  origin: THREE.Vector3,
  direction: THREE.Vector3,
  length: number,
): THREE.Group {
  const arrow = new THREE.Group();
  const shaftLength = length * 0.7;
  const headLength = length - shaftLength;
  const orientation = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction,
  );
  const material = new THREE.MeshBasicMaterial({
    color: 0xffd400,
    transparent: false,
    opacity: 1,
    blending: THREE.NormalBlending,
    depthTest: true,
    depthWrite: true,
    vertexColors: false,
  });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(6.1, 6.1, shaftLength, 10), material);
  shaft.position.copy(origin).addScaledVector(direction, shaftLength / 2);
  shaft.quaternion.copy(orientation);
  shaft.renderOrder = 4;

  const head = new THREE.Mesh(
    new THREE.ConeGeometry(18, headLength, 12),
    material.clone(),
  );
  head.position.copy(origin).addScaledVector(direction, shaftLength + headLength / 2);
  head.quaternion.copy(orientation);
  head.renderOrder = 4;

  arrow.add(shaft, head);
  return arrow;
}

function disposeDarcyArrow(arrow: THREE.Group): void {
  arrow.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.geometry.dispose();
      disposeMaterial(object.material);
    }
  });
}

function disposeMaterial(material: THREE.Material | THREE.Material[]): void {
  if (Array.isArray(material)) {
    for (const item of material) {
      item.dispose();
    }
    return;
  }
  material.dispose();
}

function updateWellLabelPositions(
  camera: THREE.Camera,
  container: HTMLElement,
  wellLabels: readonly { marker: THREE.Mesh; label: HTMLDivElement }[],
  cutEnabled: boolean,
  cutPlane: THREE.Plane,
  wellWorldPosition: THREE.Vector3,
  wellLabelWorldPosition: THREE.Vector3,
): void {
  const width = container.clientWidth;
  const height = container.clientHeight;
  for (const { marker, label } of wellLabels) {
    marker.getWorldPosition(wellWorldPosition);
    const projected = wellLabelWorldPosition
      .copy(wellWorldPosition)
      .setY(wellWorldPosition.y + 40)
      .project(camera);
    const isVisible =
      projected.x >= -1 &&
      projected.x <= 1 &&
      projected.y >= -1 &&
      projected.y <= 1 &&
      projected.z >= -1 &&
      projected.z <= 1 &&
      isWellLabelRetainedByCut(wellWorldPosition, cutEnabled, cutPlane);
    label.style.display = isVisible ? "" : "none";
    if (isVisible) {
      label.style.left = `${(projected.x * 0.5 + 0.5) * width}px`;
      label.style.top = `${(-projected.y * 0.5 + 0.5) * height}px`;
    }
  }
}

function updateRiverLabelPosition(
  camera: THREE.Camera,
  container: HTMLElement,
  riverLabel: { marker: THREE.Mesh; label: HTMLDivElement },
  riverLabelWorldPosition: THREE.Vector3,
): void {
  riverLabel.marker.getWorldPosition(riverLabelWorldPosition);
  const projected = riverLabelWorldPosition
    .setY(riverLabelWorldPosition.y + 20)
    .project(camera);

  const isVisible =
    projected.x >= -1 &&
    projected.x <= 1 &&
    projected.y >= -1 &&
    projected.y <= 1 &&
    projected.z >= -1 &&
    projected.z <= 1;

  riverLabel.label.style.display = isVisible ? "" : "none";
  if (isVisible) {
    riverLabel.label.style.left = `${(projected.x * 0.5 + 0.5) * container.clientWidth}px`;
    riverLabel.label.style.top = `${(-projected.y * 0.5 + 0.5) * container.clientHeight}px`;
  }
}

function isWellLabelRetainedByCut(
  position: THREE.Vector3,
  cutEnabled: boolean,
  cutPlane: THREE.Plane,
): boolean {
  // Three.js descarta el semiespacio negativo del plano de recorte.
  return !cutEnabled || cutPlane.distanceToPoint(position) >= -CUT_LABEL_PLANE_TOLERANCE_METERS;
}

function isRetainedByCut(x: number, cutEnabled: boolean, cutX: number): boolean {
  return !cutEnabled || x <= cutX;
}

function cellCenterPosition(
  domain: SceneDomain,
  row: number,
  column: number,
): { x: number; z: number } {
  const dx = domain.widthMeters / domain.columns;
  const dy = domain.heightMeters / domain.rows;
  return {
    x: (column + 0.5) * dx - domain.widthMeters / 2,
    z: (row + 0.5) * dy - domain.heightMeters / 2,
  };
}
