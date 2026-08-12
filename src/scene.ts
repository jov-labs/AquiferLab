import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { LineSegments2 } from "three/addons/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";
import type { DarcyFlowField } from "./flow.js";

const SURFACE_GRID_INTERVAL = 3;
const OVERLAY_SURFACE_MARGIN_METERS = 8;
const DARCY_OVERLAY_OFFSET_METERS = 16;
const DARCY_VISUAL_SAMPLE_INTERVAL = 5;
const DARCY_MAX_ARROW_LENGTH = 364;

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

export interface AquiferScene {
  updatePiezometricSurface(data: PiezometricSurfaceData): void;
  updateDarcyFlow(data: DarcyOverlayData): void;
  setDarcyFlowVisible(visible: boolean): void;
  setGeologicalCut(enabled: boolean, positionPercent: number): void;
}

/** Representación Three.js: recibe campos ya resueltos, sin cálculo hidrogeológico. */
export function createAquiferScene(
  container: HTMLElement,
  domain: SceneDomain,
  wells: readonly WellMarker[],
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
  const cutHelper = new THREE.PlaneHelper(cutPlane, Math.max(domain.widthMeters, domain.heightMeters) * 1.1, 0x78dce8);
  cutHelper.visible = false;
  scene.add(cutHelper);

  addGeologicalContext(scene, domain, clippingMaterials);
  addRiver(scene, domain, clippingMaterials);
  const wellLabels = wells.map((well) =>
    addWellMarker(scene, container, domain, well, clippingMaterials),
  );

  const surfaceGeometry = createSurfaceGeometry(domain);
  const surfaceMaterial = new THREE.MeshStandardMaterial({
    color: 0x3cd7ff,
    vertexColors: true,
    transparent: true,
    opacity: 0.72,
    side: THREE.DoubleSide,
    roughness: 0.35,
    metalness: 0.05,
  });
  clippingMaterials.push(surfaceMaterial);
  const surface = new THREE.Mesh(surfaceGeometry, surfaceMaterial);
  surface.renderOrder = 2;
  scene.add(surface);
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
  let overlayY = 0;
  let cutEnabled = false;
  let cutX = domain.widthMeters / 2;
  let lastWidth = 0;
  let lastHeight = 0;
  let resizeFrame = 0;

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
    updateWellLabelPositions(camera, container, wellLabels, cutEnabled, cutX);
    renderer.render(scene, camera);
    window.requestAnimationFrame(render);
  };
  render();

  return {
    updatePiezometricSurface(data: PiezometricSurfaceData): void {
      updateSurfaceVertices(surfaceGeometry, domain, data);
      overlayY = surfaceMaximumY(data.headsMeters, data.referenceHeadMeters) + OVERLAY_SURFACE_MARGIN_METERS;
      updateSurfaceGrid(surfaceGridGeometry, domain, overlayY);
    },
    updateDarcyFlow(data: DarcyOverlayData): void {
      updateDarcyArrows(darcyGroup, darcyArrows, domain, data, overlayY, cutEnabled, cutX);
    },
    setDarcyFlowVisible(visible: boolean): void {
      darcyGroup.visible = visible;
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
      cutHelper.visible = enabled;
      cutHelper.updateMatrixWorld();
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
    const geometry = new THREE.BoxGeometry(domain.widthMeters, 10, domain.heightMeters);
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

function addRiver(
  scene: THREE.Scene,
  domain: SceneDomain,
  clippingMaterials: THREE.Material[],
): void {
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
  river.name = "Río: frontera de carga fija h = 100 m";
  scene.add(river);
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
): void {
  const positions = geometry.getAttribute("position") as THREE.BufferAttribute;
  const colors = geometry.getAttribute("color") as THREE.BufferAttribute;
  const { minimumDrawdownMeters, maximumDrawdownMeters } = drawdownRange(data.drawdownMeters);
  const hasNegativeDrawdown = minimumDrawdownMeters < 0;
  const zeroColor = new THREE.Color(0x38d7ff);
  const positiveColor = new THREE.Color(0x7f3cff);
  const negativeColor = new THREE.Color(0x3155d9);
  const vertexColor = new THREE.Color();
  for (let row = 0; row < domain.rows; row += 1) {
    for (let column = 0; column < domain.columns; column += 1) {
      const index = row * domain.columns + column;
      const position = cellCenterPosition(domain, row, column);
      positions.setXYZ(index, position.x, data.headsMeters[row][column] - data.referenceHeadMeters, position.z);
      const drawdown = data.drawdownMeters[row][column];
      setDrawdownColor(
        vertexColor,
        drawdown,
        minimumDrawdownMeters,
        maximumDrawdownMeters,
        hasNegativeDrawdown,
        negativeColor,
        zeroColor,
        positiveColor,
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
  positiveColor: THREE.Color,
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
  target.lerpColors(zeroColor, positiveColor, drawdown / maximumDrawdownMeters);
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
    // El cálculo contiene cada celda interior; sólo se muestrea cada cinco para legibilidad.
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
    const length = DARCY_MAX_ARROW_LENGTH * visualRelativeMagnitude;
    const origin = new THREE.Vector3(
      position.x,
      overlayY + DARCY_OVERLAY_OFFSET_METERS,
      position.z,
    );
    const arrow = createDarcyArrow(origin, direction, length);
    arrow.userData.originX = origin.x;
    arrow.visible = isRetainedByCut(origin.x, cutEnabled, cutX);
    arrows.push(arrow);
    group.add(arrow);
  }
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
    color: 0xff0000,
    transparent: false,
    opacity: 1,
    blending: THREE.NormalBlending,
    depthTest: true,
    depthWrite: true,
    vertexColors: false,
  });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 4.5, shaftLength, 10), material);
  shaft.position.copy(origin).addScaledVector(direction, shaftLength / 2);
  shaft.quaternion.copy(orientation);
  shaft.renderOrder = 4;

  const head = new THREE.Mesh(
    new THREE.ConeGeometry(14, headLength, 12),
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
  cutX: number,
): void {
  const width = container.clientWidth;
  const height = container.clientHeight;
  for (const { marker, label } of wellLabels) {
    const projected = marker.position.clone().add(new THREE.Vector3(0, 40, 0)).project(camera);
    const isVisible =
      projected.x >= -1 &&
      projected.x <= 1 &&
      projected.y >= -1 &&
      projected.y <= 1 &&
      projected.z >= -1 &&
      projected.z <= 1 &&
      isRetainedByCut(marker.position.x, cutEnabled, cutX);
    label.hidden = !isVisible;
    if (isVisible) {
      label.style.left = `${(projected.x * 0.5 + 0.5) * width}px`;
      label.style.top = `${(-projected.y * 0.5 + 0.5) * height}px`;
    }
  }
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
