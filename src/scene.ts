import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { DarcyFlowField } from "./flow.js";

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
  scene.add(new THREE.GridHelper(2_200, 22, 0x2a4259, 0x192a3a).translateY(-42));

  addGeologicalContext(scene, domain);
  addRiver(scene, domain);
  const wellLabels = wells.map((well) => addWellMarker(scene, container, domain, well));

  const surfaceGeometry = createSurfaceGeometry(domain);
  const surfaceMaterial = new THREE.MeshStandardMaterial({
    color: 0x3cd7ff,
    transparent: true,
    opacity: 0.72,
    side: THREE.DoubleSide,
    roughness: 0.35,
    metalness: 0.05,
  });
  const surface = new THREE.Mesh(surfaceGeometry, surfaceMaterial);
  surface.renderOrder = 2;
  scene.add(surface);
  const darcyGroup = new THREE.Group();
  darcyGroup.name = "Campo de descarga específica de Darcy";
  darcyGroup.renderOrder = 3;
  scene.add(darcyGroup);
  const darcyArrows: THREE.Group[] = [];

  const resize = () => {
    const width = Math.max(container.clientWidth, 1);
    const height = Math.max(container.clientHeight, 1);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  };
  new ResizeObserver(resize).observe(container);
  resize();

  const render = () => {
    controls.update();
    updateWellLabelPositions(camera, container, wellLabels);
    renderer.render(scene, camera);
    window.requestAnimationFrame(render);
  };
  render();

  return {
    updatePiezometricSurface(data: PiezometricSurfaceData): void {
      updateSurfaceVertices(surfaceGeometry, domain, data);
    },
    updateDarcyFlow(data: DarcyOverlayData): void {
      updateDarcyArrows(darcyGroup, darcyArrows, domain, data);
    },
    setDarcyFlowVisible(visible: boolean): void {
      darcyGroup.visible = visible;
    },
  };
}

function addGeologicalContext(scene: THREE.Scene, domain: SceneDomain): void {
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
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = layer.name;
    mesh.position.y = layer.y;
    mesh.renderOrder = 1;
    scene.add(mesh);
  }
}

function addRiver(scene: THREE.Scene, domain: SceneDomain): void {
  const geometry = new THREE.BoxGeometry(24, 5, domain.heightMeters);
  const material = new THREE.MeshStandardMaterial({
    color: 0x287fd1,
    emissive: 0x0a315d,
    roughness: 0.25,
  });
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
): { marker: THREE.Mesh; label: HTMLDivElement } {
  const geometry = new THREE.CylinderGeometry(18, 18, 72, 20);
  const material = new THREE.MeshStandardMaterial({
    color: 0xf3c760,
    emissive: 0x5a3d00,
    roughness: 0.45,
  });
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
  geometry.setIndex(indices);
  return geometry;
}

function updateSurfaceVertices(
  geometry: THREE.BufferGeometry,
  domain: SceneDomain,
  data: PiezometricSurfaceData,
): void {
  const positions = geometry.getAttribute("position") as THREE.BufferAttribute;
  for (let row = 0; row < domain.rows; row += 1) {
    for (let column = 0; column < domain.columns; column += 1) {
      const index = row * domain.columns + column;
      const position = cellCenterPosition(domain, row, column);
      positions.setXYZ(index, position.x, data.headsMeters[row][column] - data.referenceHeadMeters, position.z);
    }
  }
  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
}

function updateDarcyArrows(
  group: THREE.Group,
  arrows: THREE.Group[],
  domain: SceneDomain,
  data: DarcyOverlayData,
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
    // El cálculo contiene cada celda interior; sólo se muestrea cada cuatro para legibilidad.
    if ((vector.row - 1) % 4 !== 0 || (vector.column - 1) % 4 !== 0) {
      continue;
    }
    if (vector.magnitudeMetersPerDay <= Number.EPSILON) {
      continue;
    }

    const position = cellCenterPosition(domain, vector.row, vector.column);
    const direction = new THREE.Vector3(vector.qxMetersPerDay, 0, vector.qzMetersPerDay).normalize();
    const relativeMagnitude = vector.magnitudeMetersPerDay / data.field.maxMagnitudeMetersPerDay;
    const visualRelativeMagnitude = Math.sqrt(relativeMagnitude);
    const length = 280 * visualRelativeMagnitude;
    const origin = new THREE.Vector3(
      position.x,
      data.headsMeters[vector.row][vector.column] - data.referenceHeadMeters + 2,
      position.z,
    );
    const arrow = createDarcyArrow(origin, direction, length);
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
  const material = new THREE.MeshStandardMaterial({
    color: 0xff3b30,
    emissive: 0x5a0805,
    roughness: 0.35,
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
      projected.z <= 1;
    label.hidden = !isVisible;
    if (isVisible) {
      label.style.left = `${(projected.x * 0.5 + 0.5) * width}px`;
      label.style.top = `${(-projected.y * 0.5 + 0.5) * height}px`;
    }
  }
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
