import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

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

export interface AquiferScene {
  updatePiezometricSurface(data: PiezometricSurfaceData): void;
}

/** Representación Three.js: recibe campos ya resueltos, sin cálculo hidrogeológico. */
export function createAquiferScene(
  container: HTMLElement,
  domain: SceneDomain,
  wells: readonly WellMarker[],
): AquiferScene {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x09111f);

  const camera = new THREE.PerspectiveCamera(42, 1, 1, 10_000);
  camera.position.set(1_700, 1_450, 1_700);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.append(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, -10, 0);
  controls.enableDamping = true;
  controls.minDistance = 500;
  controls.maxDistance = 5_000;

  scene.add(new THREE.HemisphereLight(0xb9d8ff, 0x152033, 2.2));
  const keyLight = new THREE.DirectionalLight(0xffffff, 2.4);
  keyLight.position.set(900, 1_500, 600);
  scene.add(keyLight);
  scene.add(new THREE.GridHelper(2_200, 22, 0x2a4259, 0x192a3a).translateY(-42));

  addGeologicalContext(scene, domain);
  addRiver(scene, domain);
  for (const well of wells) {
    addWellMarker(scene, domain, well);
  }

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
    renderer.render(scene, camera);
    window.requestAnimationFrame(render);
  };
  render();

  return {
    updatePiezometricSurface(data: PiezometricSurfaceData): void {
      updateSurfaceVertices(surfaceGeometry, domain, data);
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

function addWellMarker(scene: THREE.Scene, domain: SceneDomain, well: WellMarker): void {
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
