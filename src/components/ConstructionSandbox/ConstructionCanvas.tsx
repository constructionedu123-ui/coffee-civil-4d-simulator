import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  StructuralElement,
  CraneCollisionPair,
  TransitMixer,
  WeatherState,
} from './types';
import {
  SITE_CRANES,
  getCraneCollisionPairs,
  BATCHING_PLANT_LOCATION,
  RIVER_START_Z,
  RIVER_END_Z,
} from './corridorData';
import {
  Camera,
  AlertTriangle,
  Compass,
} from 'lucide-react';

interface ConstructionCanvasProps {
  currentWeek: number;
  elements: StructuralElement[];
  selectedElement: StructuralElement | null;
  onSelectElement: (el: StructuralElement | null) => void;
  weather: WeatherState;
  showCraneCoverage: boolean;
  showFleetAnimation: boolean;
  transitMixers: TransitMixer[];
  activeCameraPreset: string;
  onCameraPresetChange: (preset: string) => void;
}

export const ConstructionCanvas: React.FC<ConstructionCanvasProps> = ({
  currentWeek,
  elements,
  selectedElement,
  onSelectElement,
  weather,
  showCraneCoverage,
  showFleetAnimation,
  transitMixers,
  activeCameraPreset,
  onCameraPresetChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Mesh registries for fast updates and raycasting
  const elementMeshesRef = useRef<Map<string, THREE.Mesh>>(new Map());
  const craneGroupRef = useRef<THREE.Group | null>(null);
  const craneRadiusMeshesRef = useRef<THREE.Group | null>(null);
  const collisionMeshesRef = useRef<THREE.Group | null>(null);
  const mixerMeshesRef = useRef<Map<string, THREE.Group>>(new Map());
  const rainPointsRef = useRef<THREE.Points | null>(null);
  const waterMeshRef = useRef<THREE.Mesh | null>(null);
  const pumpTruckRef = useRef<THREE.Group | null>(null);

  // Hover Tooltip State
  const [hoveredElement, setHoveredElement] = useState<StructuralElement | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Collision pairs
  const collisionPairs: CraneCollisionPair[] = getCraneCollisionPairs(SITE_CRANES);

  // Camera presets coordinates
  const cameraPresets: Record<string, { pos: [number, number, number]; target: [number, number, number] }> = {
    overview: { pos: [-350, 260, -200], target: [0, 15, 0] },
    river: { pos: [-120, 65, 0], target: [0, 18, 0] },
    batching: { pos: [-160, 45, -220], target: [-95, 10, -220] },
    cranes: { pos: [-110, 80, -20], target: [-28, 20, -15] },
    topdown: { pos: [0, 750, 0], target: [0, 0, 0] },
  };

  // Smooth camera fly-to animation
  const flyToPreset = useCallback((presetKey: string) => {
    const config = cameraPresets[presetKey];
    if (!config || !cameraRef.current || !controlsRef.current) return;

    const startPos = cameraRef.current.position.clone();
    const endPos = new THREE.Vector3(...config.pos);
    const startTarget = controlsRef.current.target.clone();
    const endTarget = new THREE.Vector3(...config.target);

    const duration = 1200; // ms
    const startTime = performance.now();

    function animateCamera(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      // Ease out cubic
      const ease = 1 - Math.pow(1 - progress, 3);

      cameraRef.current?.position.lerpVectors(startPos, endPos, ease);
      controlsRef.current?.target.lerpVectors(startTarget, endTarget, ease);
      controlsRef.current?.update();

      if (progress < 1) {
        requestAnimationFrame(animateCamera);
      }
    }

    requestAnimationFrame(animateCamera);
    onCameraPresetChange(presetKey);
  }, [onCameraPresetChange]);

  // Handle active preset changes from parent
  useEffect(() => {
    if (activeCameraPreset && cameraPresets[activeCameraPreset]) {
      flyToPreset(activeCameraPreset);
    }
  }, [activeCameraPreset, flyToPreset]);

  // Initialize Three.js Scene
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    // 1. Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0f1d);
    scene.fog = new THREE.FogExp2(0x0a0f1d, 0.00065);
    sceneRef.current = scene;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 2, 4000);
    const initialConfig = cameraPresets.overview;
    camera.position.set(...initialConfig.pos);
    cameraRef.current = camera;

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.maxPolarAngle = Math.PI / 2 - 0.03; // don't go below ground
    controls.minDistance = 15;
    controls.maxDistance = 2200;
    controls.target.set(...initialConfig.target);
    controlsRef.current = controls;

    // 5. Lighting
    const ambientLight = new THREE.AmbientLight(0x94a3b8, 1.4);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0x38bdf8, 0x1e293b, 0.8);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfff7ed, 2.2);
    sunLight.position.set(-300, 450, -200);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 1500;
    const d = 500;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.bias = -0.0005;
    scene.add(sunLight);

    // 6. Terrain / Ground
    const groundGeo = new THREE.PlaneGeometry(1600, 3200, 32, 64);
    groundGeo.rotateX(-Math.PI / 2);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x121824,
      roughness: 0.95,
      metalness: 0.05,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.receiveShadow = true;
    ground.position.y = -0.2;
    scene.add(ground);

    // Grid helper overlay
    const grid = new THREE.GridHelper(3000, 60, 0x1e293b, 0x0f172a);
    grid.position.y = 0.05;
    scene.add(grid);

    // Haul Road (Running parallel to elevated structure)
    const haulRoadGeo = new THREE.PlaneGeometry(16, 2800);
    haulRoadGeo.rotateX(-Math.PI / 2);
    const haulRoadMat = new THREE.MeshStandardMaterial({
      color: 0x272e3f,
      roughness: 0.88,
    });
    const haulRoad = new THREE.Mesh(haulRoadGeo, haulRoadMat);
    haulRoad.position.set(-20, 0.15, 0);
    haulRoad.receiveShadow = true;
    scene.add(haulRoad);

    // Spur road to batching plant
    const spurGeo = new THREE.PlaneGeometry(14, 110);
    spurGeo.rotateX(-Math.PI / 2);
    spurGeo.rotateY(Math.PI / 2);
    const spurRoad = new THREE.Mesh(spurGeo, haulRoadMat);
    spurRoad.position.set(-58, 0.16, -220);
    scene.add(spurRoad);

    // 7. Cisadane River Crossing
    const riverGeo = new THREE.PlaneGeometry(1400, RIVER_END_Z - RIVER_START_Z);
    riverGeo.rotateX(-Math.PI / 2);
    const riverMat = new THREE.MeshStandardMaterial({
      color: 0x0369a1,
      roughness: 0.15,
      metalness: 0.75,
      transparent: true,
      opacity: 0.88,
    });
    const riverMesh = new THREE.Mesh(riverGeo, riverMat);
    riverMesh.position.set(0, -0.1, (RIVER_START_Z + RIVER_END_Z) / 2);
    riverMesh.receiveShadow = true;
    scene.add(riverMesh);
    waterMeshRef.current = riverMesh;

    // River embankment slopes (North & South river banks)
    const bankGeo = new THREE.BoxGeometry(1400, 2.0, 18);
    const bankMat = new THREE.MeshStandardMaterial({ color: 0x1c2b22, roughness: 0.9 });
    const bankSouth = new THREE.Mesh(bankGeo, bankMat);
    bankSouth.position.set(0, -0.5, RIVER_START_Z - 5);
    scene.add(bankSouth);

    const bankNorth = new THREE.Mesh(bankGeo, bankMat);
    bankNorth.position.set(0, -0.5, RIVER_END_Z + 5);
    scene.add(bankNorth);

    // 8. Batching Plant Compound (3D Model)
    const plantGroup = new THREE.Group();
    plantGroup.position.set(...BATCHING_PLANT_LOCATION);

    // Concrete Pad
    const pad = new THREE.Mesh(
      new THREE.BoxGeometry(50, 0.6, 60),
      new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.8 })
    );
    pad.position.y = 0.3;
    pad.receiveShadow = true;
    plantGroup.add(pad);

    // 3 Cement Silos
    const siloMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.35, metalness: 0.45 });
    const stripeMat = new THREE.MeshStandardMaterial({ color: 0x0284c7 });
    for (let s = 0; s < 3; s++) {
      const sx = -14 + s * 14;
      const siloGeo = new THREE.CylinderGeometry(3.6, 3.6, 22, 24);
      const silo = new THREE.Mesh(siloGeo, siloMat);
      silo.position.set(sx, 14, -12);
      silo.castShadow = true;
      plantGroup.add(silo);

      // Top cone
      const coneGeo = new THREE.ConeGeometry(3.6, 3.5, 24);
      const cone = new THREE.Mesh(coneGeo, siloMat);
      cone.position.set(sx, 26.5, -12);
      plantGroup.add(cone);

      // Silo Brand Stripe (PT Semen Indonesia / BUMN)
      const stripeGeo = new THREE.CylinderGeometry(3.65, 3.65, 2.5, 24);
      const stripe = new THREE.Mesh(stripeGeo, stripeMat);
      stripe.position.set(sx, 16, -12);
      plantGroup.add(stripe);

      // Silo Legs
      for (let l = 0; l < 4; l++) {
        const legAng = (l * Math.PI) / 2;
        const leg = new THREE.Mesh(
          new THREE.CylinderGeometry(0.3, 0.3, 5, 8),
          new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.7 })
        );
        leg.position.set(sx + Math.cos(legAng) * 2.8, 2.5, -12 + Math.sin(legAng) * 2.8);
        plantGroup.add(leg);
      }
    }

    // Aggregate Hopper Bins
    const hopperMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.2 });
    const hopper = new THREE.Mesh(new THREE.BoxGeometry(32, 7, 10), hopperMat);
    hopper.position.set(0, 5, 14);
    hopper.castShadow = true;
    plantGroup.add(hopper);

    // Batching Mixing Tower & Loading Chute Canopy
    const tower = new THREE.Mesh(
      new THREE.BoxGeometry(10, 14, 10),
      new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.3 })
    );
    tower.position.set(0, 8.5, 0);
    tower.castShadow = true;
    plantGroup.add(tower);

    // Operator Control Cabin
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(6, 4, 6),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.2 })
    );
    cabin.position.set(9, 7, 0);
    plantGroup.add(cabin);

    scene.add(plantGroup);

    // 9. Heavy Cranes Group
    const craneGroup = new THREE.Group();
    craneGroupRef.current = craneGroup;
    scene.add(craneGroup);

    // 10. Crane Sweep Radiuses Group
    const radiusGroup = new THREE.Group();
    craneRadiusMeshesRef.current = radiusGroup;
    scene.add(radiusGroup);

    // 11. Crane Collision Overlap Lens Group
    const collisionGroup = new THREE.Group();
    collisionMeshesRef.current = collisionGroup;
    scene.add(collisionGroup);

    // Build Crane 3D Meshes & Radius Visualizers
    SITE_CRANES.forEach((crane) => {
      // 3D Crane Object
      const cMesh = new THREE.Group();
      cMesh.name = `crane_${crane.id}`;
      cMesh.position.set(...crane.position);

      // Timber Crane Mat
      const mat = new THREE.Mesh(
        new THREE.BoxGeometry(14, 0.4, 14),
        new THREE.MeshStandardMaterial({ color: 0x5a3e26, roughness: 0.9 })
      );
      mat.position.y = 0.2;
      cMesh.add(mat);

      // Crawler Tracks
      const trackMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, metalness: 0.8 });
      for (const side of [-3.5, 3.5]) {
        const track = new THREE.Mesh(new THREE.BoxGeometry(3.0, 2.4, 11), trackMat);
        track.position.set(side, 1.4, 0);
        track.castShadow = true;
        cMesh.add(track);
      }

      // Rotating Slewing Superstructure
      const slewGroup = new THREE.Group();
      slewGroup.name = 'slew';
      slewGroup.position.y = 2.8;

      // Machinery Deck & Cabin
      const cabMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.3, metalness: 0.4 });
      const cab = new THREE.Mesh(new THREE.BoxGeometry(6, 4, 8), cabMat);
      cab.position.set(0, 2, 0);
      cab.castShadow = true;
      slewGroup.add(cab);

      // Counterweight stack
      const cw = new THREE.Mesh(
        new THREE.BoxGeometry(5.8, 3.5, 3.5),
        new THREE.MeshStandardMaterial({ color: 0x111827 })
      );
      cw.position.set(0, 2, -4);
      slewGroup.add(cw);

      // Lattice Boom (Angled upwards)
      const boomLen = crane.boomLengthMeters * 0.7; // Visual scale
      const boomMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, wireframe: false, roughness: 0.4 });
      const boomGeo = new THREE.CylinderGeometry(0.5, 1.2, boomLen, 6);
      const boom = new THREE.Mesh(boomGeo, boomMat);
      boom.position.set(0, boomLen * 0.42, boomLen * 0.28);
      boom.rotation.x = Math.PI / 3.4;
      boom.castShadow = true;
      slewGroup.add(boom);

      // Cable & Hook
      const cable = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.06, boomLen * 0.6, 6),
        new THREE.MeshBasicMaterial({ color: 0x94a3b8 })
      );
      cable.position.set(0, boomLen * 0.35, boomLen * 0.6);
      slewGroup.add(cable);

      cMesh.add(slewGroup);
      craneGroup.add(cMesh);

      // 360° Sweep Radius Ring on Ground
      const radiusRingGeo = new THREE.RingGeometry(crane.radiusMeters - 1.2, crane.radiusMeters, 64);
      radiusRingGeo.rotateX(-Math.PI / 2);
      const radiusRingMat = new THREE.MeshBasicMaterial({
        color: 0x0ea5e9,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.6,
      });
      const radiusRing = new THREE.Mesh(radiusRingGeo, radiusRingMat);
      radiusRing.position.set(crane.position[0], 0.25, crane.position[2]);
      radiusGroup.add(radiusRing);

      // Fill disk semi-transparent
      const fillGeo = new THREE.CircleGeometry(crane.radiusMeters, 64);
      fillGeo.rotateX(-Math.PI / 2);
      const fillMat = new THREE.MeshBasicMaterial({
        color: 0x0ea5e9,
        transparent: true,
        opacity: 0.07,
        side: THREE.DoubleSide,
      });
      const fillMesh = new THREE.Mesh(fillGeo, fillMat);
      fillMesh.position.set(crane.position[0], 0.22, crane.position[2]);
      radiusGroup.add(fillMesh);
    });

    // Overlapping Crane Collision Zones (CR-02 & CR-03 Overlap in River Spans P12-P13)
    collisionPairs.forEach((pair) => {
      const c1 = SITE_CRANES.find((c) => c.id === pair.crane1Id);
      const c2 = SITE_CRANES.find((c) => c.id === pair.crane2Id);
      if (c1 && c2) {
        // Midpoint between cranes
        const midX = (c1.position[0] + c2.position[0]) / 2;
        const midZ = (c1.position[2] + c2.position[2]) / 2;
        const overlapRadius = pair.overlapDistance * 0.9;

        // Pulsing Amber Overlap Zone Disc
        const overlapGeo = new THREE.RingGeometry(2, overlapRadius + 15, 48);
        overlapGeo.rotateX(-Math.PI / 2);
        const overlapMat = new THREE.MeshBasicMaterial({
          color: 0xf59e0b,
          transparent: true,
          opacity: 0.35,
          side: THREE.DoubleSide,
        });
        const overlapMesh = new THREE.Mesh(overlapGeo, overlapMat);
        overlapMesh.position.set(midX, 0.3, midZ);
        overlapMesh.name = 'pulsing_collision_zone';
        collisionGroup.add(overlapMesh);

        // Danger Warning Boundary Ring
        const ringGeo = new THREE.RingGeometry(overlapRadius + 14, overlapRadius + 16, 48);
        ringGeo.rotateX(-Math.PI / 2);
        const ringMat = new THREE.MeshBasicMaterial({
          color: 0xef4444,
          transparent: true,
          opacity: 0.85,
          side: THREE.DoubleSide,
        });
        const ringMesh = new THREE.Mesh(ringGeo, ringMat);
        ringMesh.position.set(midX, 0.32, midZ);
        collisionGroup.add(ringMesh);
      }
    });

    // 12. Active Mobile Concrete Pump Truck (Putzmeister 42m boom)
    const pumpGroup = new THREE.Group();
    pumpGroup.name = 'concrete_pump_truck';
    pumpGroup.position.set(-18, 0, 0); // Positioned near active river span

    // Truck chassis
    const pumpChassis = new THREE.Mesh(
      new THREE.BoxGeometry(3.2, 1.8, 12),
      new THREE.MeshStandardMaterial({ color: 0x1e293b })
    );
    pumpChassis.position.y = 1.0;
    pumpGroup.add(pumpChassis);

    // Cab
    const pumpCab = new THREE.Mesh(
      new THREE.BoxGeometry(3.2, 2.5, 3.2),
      new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.3 })
    );
    pumpCab.position.set(0, 2.2, 4.4);
    pumpGroup.add(pumpCab);

    // Hopper at rear
    const hopperMesh = new THREE.Mesh(
      new THREE.BoxGeometry(2.8, 1.5, 2.5),
      new THREE.MeshStandardMaterial({ color: 0x334155 })
    );
    hopperMesh.position.set(0, 1.4, -4.8);
    pumpGroup.add(hopperMesh);

    // Articulated Boom Arm reaching to Pier Column
    const boomPart1 = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.25, 14, 8),
      new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.5 })
    );
    boomPart1.position.set(4, 7, 0);
    boomPart1.rotation.z = -Math.PI / 3.8;
    pumpGroup.add(boomPart1);

    const boomPart2 = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.2, 12, 8),
      new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.5 })
    );
    boomPart2.position.set(11, 14, 0);
    boomPart2.rotation.z = -Math.PI / 5.5;
    pumpGroup.add(boomPart2);

    scene.add(pumpGroup);
    pumpTruckRef.current = pumpGroup;

    // 13. Weather Rain Particle System (Points)
    const rainCount = 4500;
    const rainGeo = new THREE.BufferGeometry();
    const rainPositions = new Float32Array(rainCount * 3);
    for (let i = 0; i < rainCount; i++) {
      rainPositions[i * 3] = (Math.random() - 0.5) * 800; // X
      rainPositions[i * 3 + 1] = Math.random() * 250; // Y
      rainPositions[i * 3 + 2] = (Math.random() - 0.5) * 2600; // Z
    }
    rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
    const rainMat = new THREE.PointsMaterial({
      color: 0x93c5fd,
      size: 0.75,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
    });
    const rainPoints = new THREE.Points(rainGeo, rainMat);
    rainPoints.visible = false;
    scene.add(rainPoints);
    rainPointsRef.current = rainPoints;

    // 14. Animation Loop
    let clock = new THREE.Clock();
    function animate() {
      animFrameRef.current = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const time = clock.getElapsedTime();

      // Gentle water ripple
      if (waterMeshRef.current) {
        waterMeshRef.current.position.y = -0.1 + Math.sin(time * 1.5) * 0.08;
      }

      // Slowly rotate crane jibs when active
      if (craneGroupRef.current) {
        craneGroupRef.current.children.forEach((craneObj: THREE.Object3D, idx: number) => {
          const slew = craneObj.getObjectByName('slew');
          if (slew) {
            slew.rotation.y = Math.sin(time * 0.25 + idx * 1.5) * 0.85;
          }
        });
      }

      // Pulsing amber collision zones
      if (collisionMeshesRef.current) {
        const pulse = 0.25 + Math.sin(time * 4.0) * 0.18;
        collisionMeshesRef.current.children.forEach((child: THREE.Object3D) => {
          if (child.name === 'pulsing_collision_zone' && child instanceof THREE.Mesh) {
            (child.material as THREE.MeshBasicMaterial).opacity = pulse;
          }
        });
      }

      // Rain particles falling down
      if (rainPointsRef.current && rainPointsRef.current.visible) {
        const positions = rainPointsRef.current.geometry.attributes.position.array as Float32Array;
        const speed = 250 * delta;
        for (let i = 0; i < rainCount; i++) {
          positions[i * 3 + 1] -= speed;
          if (positions[i * 3 + 1] < 0) {
            positions[i * 3 + 1] = 220 + Math.random() * 30;
          }
        }
        rainPointsRef.current.geometry.attributes.position.needsUpdate = true;
      }

      controls.update();
      renderer.render(scene, camera);
    }

    animate();

    // 15. Resize handler
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    // Cleanup
    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
      resizeObserver.disconnect();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Update Rain Particles & Atmosphere based on Weather Slider
  useEffect(() => {
    if (!rainPointsRef.current || !sceneRef.current) return;

    if (weather.rainfallMmHour > 0) {
      rainPointsRef.current.visible = true;
      const mat = rainPointsRef.current.material as THREE.PointsMaterial;
      mat.opacity = Math.min(0.9, 0.25 + (weather.rainfallMmHour / 80) * 0.65);
      mat.size = 0.5 + (weather.rainfallMmHour / 80) * 0.8;

      // Darken sky and intensify fog during downpours
      const fogDensity = 0.00065 + (weather.rainfallMmHour / 80) * 0.0018;
      (sceneRef.current.fog as THREE.FogExp2).density = fogDensity;
      const skyFactor = Math.max(0.04, 0.12 - (weather.rainfallMmHour / 80) * 0.08);
      sceneRef.current.background = new THREE.Color(skyFactor * 0.6, skyFactor * 0.8, skyFactor * 1.2);
    } else {
      rainPointsRef.current.visible = false;
      if (sceneRef.current.fog) {
        (sceneRef.current.fog as THREE.FogExp2).density = 0.00065;
      }
      sceneRef.current.background = new THREE.Color(0x0a0f1d);
    }
  }, [weather.rainfallMmHour]);

  // Toggle Crane Radius Visibility
  useEffect(() => {
    if (craneRadiusMeshesRef.current) {
      craneRadiusMeshesRef.current.visible = showCraneCoverage;
    }
    if (collisionMeshesRef.current) {
      collisionMeshesRef.current.visible = showCraneCoverage;
    }
  }, [showCraneCoverage]);

  // Update Concrete Transit Mixers on Haul Road
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    // Check or create mixer 3D meshes
    transitMixers.forEach((mixer) => {
      let group = mixerMeshesRef.current.get(mixer.id);
      if (!group) {
        group = new THREE.Group();
        group.name = `mixer_${mixer.id}`;

        // Truck Chassis
        const chassis = new THREE.Mesh(
          new THREE.BoxGeometry(2.4, 1.2, 6.8),
          new THREE.MeshStandardMaterial({ color: 0x1e293b })
        );
        chassis.position.y = 0.8;
        chassis.castShadow = true;
        group.add(chassis);

        // Cab
        const cab = new THREE.Mesh(
          new THREE.BoxGeometry(2.4, 1.8, 2.0),
          new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.3 })
        );
        cab.position.set(0, 1.8, 2.3);
        cab.castShadow = true;
        group.add(cab);

        // Rotating Mixing Drum
        const drum = new THREE.Mesh(
          new THREE.CylinderGeometry(1.3, 1.5, 3.8, 16),
          new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4 })
        );
        drum.name = 'drum';
        drum.position.set(0, 2.2, -1.0);
        drum.rotation.x = Math.PI / 5;
        drum.castShadow = true;
        group.add(drum);

        // Wheels
        const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111827 });
        for (const side of [-1.3, 1.3]) {
          for (const wz of [2.2, -0.6, -2.4]) {
            const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.4, 12), wheelMat);
            wheel.rotation.z = Math.PI / 2;
            wheel.position.set(side, 0.5, wz);
            group.add(wheel);
          }
        }

        scene.add(group);
        mixerMeshesRef.current.set(mixer.id, group);
      }

      // Calculate mixer position along route
      // Path: Batching Plant [-95, 0, -220] -> Haul Road [-20, 0, -220] -> Target Pier [-20, 0, TargetZ]
      const plantPos = new THREE.Vector3(...BATCHING_PLANT_LOCATION);
      const targetPierZ = 0; // Default near river span

      let currentPos = new THREE.Vector3();
      let headingAngle = 0;

      if (mixer.state === 'LOADING_AT_PLANT') {
        currentPos.copy(plantPos);
        currentPos.x += 10;
        headingAngle = Math.PI;
      } else if (mixer.state === 'HAULING_TO_PUMP') {
        // Move from plant to pump
        if (mixer.progress < 0.2) {
          // Exiting plant spur
          const p = mixer.progress / 0.2;
          currentPos.set(-95 + p * 75, 0, -220);
          headingAngle = Math.PI / 2;
        } else {
          // Along main haul road
          const p = (mixer.progress - 0.2) / 0.8;
          currentPos.set(-20, 0, -220 + p * (targetPierZ - (-220)));
          headingAngle = 0; // Facing positive Z
        }
      } else if (mixer.state === 'DISCHARGING_AT_PUMP') {
        currentPos.set(-18, 0, targetPierZ - 5);
        headingAngle = 0;
      } else if (mixer.state === 'RETURNING_TO_PLANT') {
        // Returning from pump to plant
        if (mixer.progress < 0.8) {
          const p = mixer.progress / 0.8;
          currentPos.set(-20, 0, targetPierZ - p * (targetPierZ - (-220)));
          headingAngle = Math.PI; // Facing negative Z
        } else {
          const p = (mixer.progress - 0.8) / 0.2;
          currentPos.set(-20 - p * 75, 0, -220);
          headingAngle = -Math.PI / 2;
        }
      }

      group.position.copy(currentPos);
      group.rotation.y = headingAngle;
      group.visible = showFleetAnimation;

      // Drum rotates if not suspended
      if (!weather.isPouringSuspended) {
        const drum = group.getObjectByName('drum');
        if (drum) drum.rotation.y += 0.05;
      }
    });
  }, [transitMixers, showFleetAnimation, weather.isPouringSuspended]);

  // Synchronize 3D Structural Elements with Schedule (currentWeek)
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    elements.forEach((el) => {
      let mesh = elementMeshesRef.current.get(el.id);

      if (!mesh) {
        // Create new Mesh based on type
        let geo: THREE.BufferGeometry;
        let baseColor = 0x94a3b8; // default cured concrete

        if (el.type === 'pile') {
          // Bored Pile Cap & Piles cluster
          geo = new THREE.BoxGeometry(...el.dimensions);
          baseColor = 0x64748b;
        } else if (el.type === 'column') {
          // Monolithic column
          geo = new THREE.BoxGeometry(...el.dimensions);
          baseColor = 0x94a3b8;
        } else if (el.type === 'cap') {
          // Hammerhead Pier Cap
          geo = new THREE.BoxGeometry(...el.dimensions);
          baseColor = 0xa1a1aa;
        } else if (el.type === 'girder') {
          // Precast I-Girder bay
          geo = new THREE.BoxGeometry(...el.dimensions);
          baseColor = 0xe2e8f0; // Smooth precast concrete
        } else if (el.type === 'deck') {
          // Bridge Deck Slab
          geo = new THREE.BoxGeometry(...el.dimensions);
          baseColor = 0xcbd5e1;
        } else {
          // Asphalt wearing course
          geo = new THREE.BoxGeometry(...el.dimensions);
          baseColor = 0x1e293b; // Dark asphalt
        }

        const mat = new THREE.MeshStandardMaterial({
          color: baseColor,
          roughness: el.type === 'asphalt' ? 0.9 : 0.65,
          metalness: 0.1,
        });

        mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(...el.position);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData = { elementId: el.id, element: el };

        scene.add(mesh);
        elementMeshesRef.current.set(el.id, mesh);
      }

      // Check Phasing Status at currentWeek
      const isSelected = selectedElement?.id === el.id;
      const mat = mesh.material as THREE.MeshStandardMaterial;

      if (currentWeek < el.startWeek) {
        // 1. Not yet constructed
        mesh.visible = false;
      } else if (currentWeek >= el.startWeek && currentWeek < el.endWeek) {
        // 2. ACTIVE CONSTRUCTION IN PROGRESS (Pulsing amber rebar / formwork state)
        mesh.visible = true;
        if (isSelected) {
          mat.color.setHex(0x38bdf8); // Cyan selected
          mat.emissive.setHex(0x0284c7);
          mat.emissiveIntensity = 0.5;
        } else {
          mat.color.setHex(0xf59e0b); // Amber construction formwork
          mat.emissive.setHex(0xb45309);
          mat.emissiveIntensity = 0.35;
        }
      } else {
        // 3. FULLY COMPLETED / CURED CONCRETE
        mesh.visible = true;
        mat.emissive.setHex(0x000000);
        mat.emissiveIntensity = 0.0;

        if (isSelected) {
          mat.color.setHex(0x38bdf8); // Cyan selected
          mat.emissive.setHex(0x0284c7);
          mat.emissiveIntensity = 0.6;
        } else {
          // Restore default material colors
          if (el.type === 'asphalt') mat.color.setHex(0x1e293b);
          else if (el.type === 'girder') mat.color.setHex(0xe2e8f0);
          else if (el.type === 'cap') mat.color.setHex(0xa1a1aa);
          else if (el.type === 'deck') mat.color.setHex(0xcbd5e1);
          else mat.color.setHex(0x94a3b8);
        }
      }
    });

    // Update active concrete pump truck position to follow current active span
    const activePourElement = elements.find(
      (el) => currentWeek >= el.startWeek && currentWeek < el.endWeek && (el.type === 'column' || el.type === 'cap')
    );
    if (activePourElement && pumpTruckRef.current) {
      pumpTruckRef.current.position.set(-18, 0, activePourElement.position[2]);
      pumpTruckRef.current.visible = true;
    }
  }, [currentWeek, elements, selectedElement]);

  // Raycasting for Element Selection & Hover Tooltips
  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!rendererRef.current || !cameraRef.current || !sceneRef.current) return;
    const rect = rendererRef.current.domElement.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(x, y), cameraRef.current);

    // Only raycast against visible structural elements
    const visibleMeshes = Array.from(elementMeshesRef.current.values()).filter((m) => m.visible);
    const intersects = raycaster.intersectObjects(visibleMeshes, false);

    if (intersects.length > 0) {
      const hit = intersects[0].object;
      const el: StructuralElement | undefined = hit.userData?.element;
      if (el) {
        onSelectElement(el);
      }
    } else {
      // Clicked on ground or empty space
      if (!event.defaultPrevented && (event.target as HTMLElement).tagName === 'CANVAS') {
        // onSelectElement(null);
      }
    }
  };

  // Hover Tooltip Tracker
  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!rendererRef.current || !cameraRef.current) return;
    const rect = rendererRef.current.domElement.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    setMousePos({ x: event.clientX - rect.left, y: event.clientY - rect.top });

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(x, y), cameraRef.current);

    const visibleMeshes = Array.from(elementMeshesRef.current.values()).filter((m) => m.visible);
    const intersects = raycaster.intersectObjects(visibleMeshes, false);

    if (intersects.length > 0) {
      const hit = intersects[0].object;
      const el: StructuralElement | undefined = hit.userData?.element;
      if (el) {
        setHoveredElement(el);
        if (containerRef.current) containerRef.current.style.cursor = 'pointer';
        return;
      }
    }

    setHoveredElement(null);
    if (containerRef.current) containerRef.current.style.cursor = 'default';
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full select-none overflow-hidden bg-[#0a0f1d]"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerLeave={() => setHoveredElement(null)}
    >
      {/* 3D Viewport Controls & Camera Angle Bar (Top Left) */}
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
        <div className="bg-[#0f172a]/90 backdrop-blur-md border border-slate-800 rounded-xl p-1.5 shadow-2xl flex items-center gap-1">
          <div className="px-2 py-1 flex items-center gap-1.5 text-xs font-semibold text-slate-300">
            <Camera className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden sm:inline">Camera Preset:</span>
          </div>
          <button
            onClick={() => flyToPreset('overview')}
            className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${
              activeCameraPreset === 'overview'
                ? 'bg-sky-500 text-white shadow-md shadow-sky-500/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
            }`}
            title="Corridor 2.5km Full Overview"
          >
            Corridor 2.5km
          </button>
          <button
            onClick={() => flyToPreset('river')}
            className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${
              activeCameraPreset === 'river'
                ? 'bg-sky-500 text-white shadow-md shadow-sky-500/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
            }`}
            title="Active River Crossing (Cisadane Bridge)"
          >
            River Span
          </button>
          <button
            onClick={() => flyToPreset('batching')}
            className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${
              activeCameraPreset === 'batching'
                ? 'bg-sky-500 text-white shadow-md shadow-sky-500/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
            }`}
            title="On-site Concrete Batching Plant Compound"
          >
            Batching Plant
          </button>
          <button
            onClick={() => flyToPreset('cranes')}
            className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${
              activeCameraPreset === 'cranes'
                ? 'bg-sky-500 text-white shadow-md shadow-sky-500/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
            }`}
            title="Crane Interference & Collision Zone"
          >
            Crane Zone
          </button>
          <button
            onClick={() => flyToPreset('topdown')}
            className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${
              activeCameraPreset === 'topdown'
                ? 'bg-sky-500 text-white shadow-md shadow-sky-500/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
            }`}
            title="Top-down 2D Site Plan"
          >
            Top-down
          </button>
        </div>

        {/* Crane Overlap Collision Alert Pill */}
        {showCraneCoverage && collisionPairs.length > 0 && (
          <div className="bg-amber-950/80 backdrop-blur-md border border-amber-600/70 text-amber-200 text-xs px-3 py-1.5 rounded-xl shadow-lg flex items-center gap-2 max-w-md animate-pulse">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <div className="truncate">
              <span className="font-bold text-amber-300">Crane Conflict:</span> CR-02 (300T) & CR-03 (260T) overlap by 20m in River Spans P12-P13!
            </div>
          </div>
        )}
      </div>

      {/* OrbitControls Navigation Helper Hint (Top Right) */}
      <div className="absolute top-4 right-72 z-10 hidden lg:flex items-center gap-2 bg-[#0f172a]/80 backdrop-blur-md border border-slate-800 text-[11px] text-slate-400 px-3 py-1.5 rounded-xl shadow-lg">
        <Compass className="w-3.5 h-3.5 text-sky-400" />
        <span>Left-click: Orbit • Right-click: Pan • Scroll: Zoom</span>
      </div>

      {/* 3D Hover Tooltip */}
      {hoveredElement && (
        <div
          className="pointer-events-none absolute z-20 bg-slate-900/95 border border-sky-500/60 rounded-xl p-2.5 shadow-2xl text-xs backdrop-blur-md max-w-xs transition-opacity duration-150"
          style={{
            left: `${mousePos.x + 16}px`,
            top: `${mousePos.y + 16}px`,
          }}
        >
          <div className="flex items-center justify-between gap-3 mb-1">
            <span className="font-bold text-sky-400 font-mono text-[11px]">{hoveredElement.id}</span>
            <span
              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                currentWeek < hoveredElement.startWeek
                  ? 'bg-slate-800 text-slate-400'
                  : currentWeek < hoveredElement.endWeek
                  ? 'bg-amber-950 text-amber-300 border border-amber-800/80 animate-pulse'
                  : 'bg-emerald-950 text-emerald-300 border border-emerald-800/80'
              }`}
            >
              {currentWeek < hoveredElement.startWeek
                ? 'Scheduled'
                : currentWeek < hoveredElement.endWeek
                ? 'In-Progress (Pouring)'
                : 'Completed & Cured'}
            </span>
          </div>
          <div className="font-medium text-slate-200 text-xs mb-1.5">{hoveredElement.name}</div>
          <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px] text-slate-400">
            <div>Concrete: <span className="text-slate-200 font-semibold">{hoveredElement.concreteSpec.grade}</span></div>
            <div>Volume: <span className="text-slate-200 font-mono font-semibold">{hoveredElement.volumeM3} m³</span></div>
            <div>Schedule: <span className="text-slate-200 font-semibold">Wk {hoveredElement.startWeek} - {hoveredElement.endWeek}</span></div>
            <div>Rebar: <span className="text-slate-200 font-mono font-semibold">{(hoveredElement.steelKg / 1000).toFixed(1)} T</span></div>
          </div>
          <div className="mt-1.5 pt-1.5 border-t border-slate-800 text-[10px] text-sky-400/90 font-medium">
            Click to inspect detailed QA/QC RFI sheet →
          </div>
        </div>
      )}
    </div>
  );
};
