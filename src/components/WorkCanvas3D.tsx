import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  SimulatorConfig,
  ProductivityMetrics,
  LiveSimulationState,
} from '../types/simulator';
import {
  Play,
  Pause,
  RotateCcw,
  Camera,
  Activity,
  Compass,
  Gauge,
  Truck,
  HardHat,
  FileSpreadsheet,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { formatAhspForExcel } from '../utils/productivityEngine';

interface WorkCanvas3DProps {
  config: SimulatorConfig;
  metrics: ProductivityMetrics;
  simState: LiveSimulationState;
  onTogglePlay: () => void;
  onReset: () => void;
  onChangeSpeed: (speed: number) => void;
}

// Closed-loop 3D waypoint circuit for excavation dump truck fleet
const HAUL_WAYPOINTS = [
  new THREE.Vector3(2, -5, 0),
  new THREE.Vector3(10, -5, 1),
  new THREE.Vector3(16, -3.5, 3),
  new THREE.Vector3(24, 0, 8),
  new THREE.Vector3(34, 0, 16),
  new THREE.Vector3(46, 0, 26),
  new THREE.Vector3(58, 0, 36),
  new THREE.Vector3(65, 0, 42),
  new THREE.Vector3(68, 0, 48),
  new THREE.Vector3(63, 0, 54),
  new THREE.Vector3(50, 0, 42),
  new THREE.Vector3(36, 0, 28),
  new THREE.Vector3(24, 0, 14),
  new THREE.Vector3(16, 0, 8),
  new THREE.Vector3(12, -3.5, 3),
  new THREE.Vector3(6, -5, 0),
];

export const WorkCanvas3D: React.FC<WorkCanvas3DProps> = ({
  config,
  metrics,
  simState,
  onTogglePlay,
  onReset,
  onChangeSpeed,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Avoid React stale closure bugs in requestAnimationFrame loop
  const configRef = useRef<SimulatorConfig>(config);
  configRef.current = config;
  const metricsRef = useRef<ProductivityMetrics>(metrics);
  metricsRef.current = metrics;
  const simStateRef = useRef<LiveSimulationState>(simState);
  simStateRef.current = simState;

  // Animation clocks
  const haulClockRef = useRef<number>(0);
  const digClockRef = useRef<number>(0);
  const compactorClockRef = useRef<number>(0);
  const craneClockRef = useRef<number>(0);
  const mixerClockRef = useRef<number>(0);

  // Mesh & Group refs
  // Excavation
  const excavationRootRef = useRef<THREE.Group | null>(null);
  const soilBlockMeshRef = useRef<THREE.Mesh | null>(null);
  const spoilPileMeshRef = useRef<THREE.Mesh | null>(null);
  const excavatorSlewRef = useRef<THREE.Group | null>(null);
  const boomRef = useRef<THREE.Group | null>(null);
  const stickRef = useRef<THREE.Group | null>(null);
  const bucketRef = useRef<THREE.Group | null>(null);
  const trucksGroupRef = useRef<THREE.Group | null>(null);
  const dustParticlesRef = useRef<THREE.Points | null>(null);

  // Embankment
  const embankmentRootRef = useRef<THREE.Group | null>(null);
  const fillRoadwayMeshRef = useRef<THREE.Mesh | null>(null);
  const vibroRollerGroupRef = useRef<THREE.Group | null>(null);
  const vibroDrumRef = useRef<THREE.Mesh | null>(null);
  const rollerDustRef = useRef<THREE.Points | null>(null);

  // Rigid Pavement
  const rigidRootRef = useRef<THREE.Group | null>(null);
  const pavedSlabMeshRef = useRef<THREE.Mesh | null>(null);
  const mixerDrumMeshRef = useRef<THREE.Mesh | null>(null);
  const pumpBoomRef = useRef<THREE.Group | null>(null);

  // U-Ditch Precast
  const uditchRootRef = useRef<THREE.Group | null>(null);
  const uditchTrenchPlacedRef = useRef<THREE.Group | null>(null);
  const craneSlewRef = useRef<THREE.Group | null>(null);
  const craneHookBlockRef = useRef<THREE.Group | null>(null);

  const [activePreset, setActivePreset] = useState<string>('pit');
  const [activeTrucksInSpot, setActiveTrucksInSpot] = useState<boolean>(false);
  const [isAhspOpen, setIsAhspOpen] = useState<boolean>(true);
  const [copiedAhsp, setCopiedAhsp] = useState<boolean>(false);

  // Camera presets
  const cameraPresets: Record<string, { pos: [number, number, number]; target: [number, number, number] }> = {
    pit: { pos: [-36, 24, 28], target: [0, 2, 0] },
    equipment: { pos: [-16, 8, 14], target: [-4, 2, 0] },
    haul: { pos: [-10, 24, 65], target: [25, 2, 50] },
    topdown: { pos: [0, 95, 0], target: [0, 0, 0] },
  };

  const flyToPreset = useCallback((presetKey: string) => {
    const p = cameraPresets[presetKey];
    if (!p || !cameraRef.current || !controlsRef.current) return;

    setActivePreset(presetKey);
    const startPos = cameraRef.current.position.clone();
    const endPos = new THREE.Vector3(...p.pos);
    const startTarget = controlsRef.current.target.clone();
    const endTarget = new THREE.Vector3(...p.target);

    const duration = 900;
    const startTime = performance.now();

    function step(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const ease = 1 - Math.pow(1 - progress, 3);

      cameraRef.current?.position.lerpVectors(startPos, endPos, ease);
      controlsRef.current?.target.lerpVectors(startTarget, endTarget, ease);
      controlsRef.current?.update();

      if (progress < 1) {
        requestAnimationFrame(step);
      }
    }
    requestAnimationFrame(step);
  }, []);

  // Helper to build a dump truck mesh
  const createDumpTruckMesh = useCallback((id: number, capacityM3: number) => {
    const t = new THREE.Group();
    t.name = `truck_${id}`;

    const isLargeTruck = capacityM3 >= 16;
    const bedLength = isLargeTruck ? 5.8 : 4.8;
    const bedHeight = isLargeTruck ? 1.8 : 1.5;
    const chassisLength = isLargeTruck ? 8.4 : 7.2;

    const blackMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.8, metalness: 0.3 });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.3, metalness: 0.8 });
    const cabColor = id % 2 === 0 ? 0x0284c7 : 0x0ea5e9;

    const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.8, chassisLength), blackMat);
    chassis.position.y = 0.8;
    chassis.castShadow = true;
    t.add(chassis);

    const cab = new THREE.Mesh(
      new THREE.BoxGeometry(2.5, 2.1, 2.3),
      new THREE.MeshStandardMaterial({ color: cabColor, roughness: 0.4 })
    );
    cab.position.set(0, 1.85, chassisLength * 0.32);
    cab.castShadow = true;
    t.add(cab);

    const windshield = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 1.1, 0.1),
      new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.1, transparent: true, opacity: 0.75 })
    );
    windshield.position.set(0, 1.95, chassisLength * 0.32 + 1.16);
    t.add(windshield);

    const hlMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfef08a, emissiveIntensity: 2.2 });
    for (const side of [-0.9, 0.9]) {
      const hl = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.1, 12), hlMat);
      hl.rotation.x = Math.PI / 2;
      hl.position.set(side, 0.9, chassisLength * 0.32 + 1.16);
      t.add(hl);
    }

    const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 2.2, 8), metalMat);
    exhaust.position.set(1.15, 2.6, chassisLength * 0.32 - 1.2);
    t.add(exhaust);

    const bedPivot = new THREE.Group();
    bedPivot.name = 'bedPivot';
    bedPivot.position.set(0, 1.3, -chassisLength * 0.38);

    const dumpBed = new THREE.Mesh(
      new THREE.BoxGeometry(2.7, bedHeight, bedLength),
      new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.45, metalness: 0.2 })
    );
    dumpBed.position.set(0, bedHeight * 0.5, bedLength * 0.5);
    dumpBed.castShadow = true;
    bedPivot.add(dumpBed);

    const soilInBed = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, bedHeight * 0.65, bedLength * 0.9),
      new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.95 })
    );
    soilInBed.name = 'soilInBed';
    soilInBed.position.set(0, bedHeight * 0.75, bedLength * 0.5);
    soilInBed.visible = true;
    bedPivot.add(soilInBed);

    t.add(bedPivot);

    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.9 });
    const zAxles = isLargeTruck ? [2.4, -0.6, -2.0, -3.4] : [2.2, -1.0, -2.6];
    for (const zPos of zAxles) {
      for (const side of [-1.4, 1.4]) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.48, 14), wheelMat);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(side, 0.55, zPos);
        t.add(wheel);
      }
    }

    t.userData = { id, capacityM3 };
    return t;
  }, []);

  // Helper to build civil construction workers
  const createWorkerFigure = useCallback((role: 'spotter' | 'mandor' | 'helper') => {
    const g = new THREE.Group();
    g.name = `worker_${role}`;

    const isMandor = role === 'mandor';
    const isSpotter = role === 'spotter';

    const helmetColor = isMandor ? 0xf8fafc : 0xfacc15;
    const vestColor = isMandor ? 0x84cc16 : 0xf97316;
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.6 });
    const helmetMat = new THREE.MeshStandardMaterial({ color: helmetColor, roughness: 0.35, metalness: 0.1 });
    const vestMat = new THREE.MeshStandardMaterial({ color: vestColor, roughness: 0.45 });
    const pantsMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.8 });

    for (const xOff of [-0.14, 0.14]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.72, 0.18), pantsMat);
      leg.position.set(xOff, 0.52, 0);
      leg.castShadow = true;
      g.add(leg);
    }

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.64, 0.28), vestMat);
    torso.position.set(0, 1.16, 0);
    torso.castShadow = true;
    g.add(torso);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.28, 0.26), skinMat);
    head.position.set(0, 1.62, 0);
    head.castShadow = true;
    g.add(head);

    const helmet = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.18, 12), helmetMat);
    helmet.position.set(0, 1.82, 0);
    helmet.castShadow = true;
    g.add(helmet);

    if (isSpotter) {
      const flagArmPivot = new THREE.Group();
      flagArmPivot.name = 'flagArm';
      flagArmPivot.position.set(0.32, 1.35, 0);

      const flag = new THREE.Mesh(
        new THREE.PlaneGeometry(0.5, 0.36),
        new THREE.MeshStandardMaterial({ color: 0xef4444, side: THREE.DoubleSide, roughness: 0.4 })
      );
      flag.position.set(0.45, 0.4, 0.1);
      flagArmPivot.add(flag);
      g.add(flagArmPivot);
    } else if (isMandor) {
      const clipboard = new THREE.Mesh(
        new THREE.BoxGeometry(0.32, 0.42, 0.02),
        new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.8 })
      );
      clipboard.position.set(0, 1.15, 0.3);
      clipboard.rotation.x = -Math.PI / 4;
      g.add(clipboard);
    }

    return g;
  }, []);

  // Synchronize 3D truck fleet
  const syncTruckFleet = useCallback((count: number, capacityM3: number) => {
    const trucksGroup = trucksGroupRef.current;
    if (!trucksGroup) return;

    while (trucksGroup.children.length > 0) {
      const child = trucksGroup.children[0];
      trucksGroup.remove(child);
    }

    const targetCount = Math.max(1, Math.min(12, count));
    for (let i = 0; i < targetCount; i++) {
      const truck = createDumpTruckMesh(i + 1, capacityM3);
      trucksGroup.add(truck);
    }
  }, [createDumpTruckMesh]);

  // Main Scene Setup
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0f1d);
    scene.fog = new THREE.FogExp2(0x0a0f1d, 0.0075);

    const camera = new THREE.PerspectiveCamera(45, width / height, 1, 1200);
    camera.position.set(...cameraPresets.pit.pos);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(...cameraPresets.pit.target);
    controls.maxPolarAngle = Math.PI / 2 - 0.02;
    controls.minDistance = 6;
    controls.maxDistance = 280;
    controlsRef.current = controls;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x94a3b8, 1.25);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xfffbeb, 2.2);
    sunLight.position.set(-65, 85, -45);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    scene.add(sunLight);

    const fillLight = new THREE.DirectionalLight(0x38bdf8, 0.6);
    fillLight.position.set(45, 35, 55);
    scene.add(fillLight);

    // Base Ground Plane
    const groundGeo = new THREE.PlaneGeometry(380, 380, 32, 32);
    groundGeo.rotateX(-Math.PI / 2);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.92 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.receiveShadow = true;
    scene.add(ground);

    const gridHelper = new THREE.GridHelper(320, 64, 0x334155, 0x1e293b);
    gridHelper.position.y = 0.02;
    scene.add(gridHelper);

    // ================= 1. EXCAVATION SCENE ROOT =================
    const excavationRoot = new THREE.Group();
    excavationRoot.name = 'excavationRoot';
    excavationRootRef.current = excavationRoot;

    // Pit Berm & Floor
    const pitFloor = new THREE.Mesh(
      new THREE.BoxGeometry(30, 0.5, 26),
      new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.9 })
    );
    pitFloor.position.set(0, -5, 0);
    pitFloor.receiveShadow = true;
    excavationRoot.add(pitFloor);

    // Pit Slopes
    const benchMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.95 });
    for (let side = -1; side <= 1; side += 2) {
      const slope = new THREE.Mesh(new THREE.BoxGeometry(30, 5, 2), benchMat);
      slope.position.set(0, -2.5, side * 13);
      slope.rotation.x = side * (Math.PI / 6);
      excavationRoot.add(slope);
    }

    // Dynamic Soil Block
    const soilBlockGeo = new THREE.BoxGeometry(20, 6, 16);
    soilBlockGeo.translate(0, 3, 0);
    const soilMat = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.92 });
    const soilBlock = new THREE.Mesh(soilBlockGeo, soilMat);
    soilBlock.position.set(-2, -5, 0);
    soilBlock.castShadow = true;
    soilBlockMeshRef.current = soilBlock;
    excavationRoot.add(soilBlock);

    // Haul Road
    const haulCurve = new THREE.CatmullRomCurve3(HAUL_WAYPOINTS, true, 'catmullrom', 0.5);
    const road = new THREE.Mesh(
      new THREE.TubeGeometry(haulCurve, 140, 3.4, 4, true),
      new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.88 })
    );
    road.scale.set(1, 0.03, 1);
    road.receiveShadow = true;
    excavationRoot.add(road);

    // Spoil Pile
    const spoilGeo = new THREE.ConeGeometry(14, 9, 18);
    spoilGeo.translate(0, 4.5, 0);
    const spoilPile = new THREE.Mesh(spoilGeo, benchMat);
    spoilPile.position.set(65, 0, 45);
    spoilPile.scale.set(0.3, 0.2, 0.3);
    spoilPile.castShadow = true;
    spoilPileMeshRef.current = spoilPile;
    excavationRoot.add(spoilPile);

    // Excavator Group
    const excavatorGroup = new THREE.Group();
    excavatorGroup.position.set(-6, -5, 0);

    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.4, metalness: 0.3 });
    const blackMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.6 });

    for (const side of [-1.8, 1.8]) {
      const track = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.3, 6.2), blackMat);
      track.position.set(side, 0.7, 0);
      track.castShadow = true;
      excavatorGroup.add(track);
    }

    const slewGroup = new THREE.Group();
    slewGroup.position.set(0, 1.6, 0);
    excavatorSlewRef.current = slewGroup;

    const house = new THREE.Mesh(new THREE.BoxGeometry(3.6, 2.0, 4.2), bodyMat);
    house.position.set(0, 1.1, -0.6);
    house.castShadow = true;
    slewGroup.add(house);

    const boomGroup = new THREE.Group();
    boomGroup.position.set(0.6, 1.4, 1.6);
    boomRef.current = boomGroup;

    const boomMesh = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.1, 6.5), bodyMat);
    boomMesh.position.set(0, 2.4, 2.6);
    boomMesh.rotation.x = -Math.PI / 4.2;
    boomMesh.castShadow = true;
    boomGroup.add(boomMesh);

    const stickGroup = new THREE.Group();
    stickGroup.position.set(0, 4.8, 5.0);
    stickRef.current = stickGroup;

    const stickMesh = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 4.5), bodyMat);
    stickMesh.position.set(0, -1.4, 1.6);
    stickMesh.rotation.x = Math.PI / 3.2;
    stickMesh.castShadow = true;
    stickGroup.add(stickMesh);

    const bucketGroup = new THREE.Group();
    bucketGroup.position.set(0, -3.2, 3.2);
    bucketRef.current = bucketGroup;

    const bucketMesh = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.1, 1.3), blackMat);
    bucketMesh.position.set(0, -0.4, 0.4);
    bucketMesh.castShadow = true;
    bucketGroup.add(bucketMesh);

    stickGroup.add(bucketGroup);
    boomGroup.add(stickGroup);
    slewGroup.add(boomGroup);
    excavatorGroup.add(slewGroup);
    excavationRoot.add(excavatorGroup);

    // Dust particles
    const dustCount = 120;
    const dustGeo = new THREE.BufferGeometry();
    const dustPos = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount; i++) {
      dustPos[i * 3] = (Math.random() - 0.5) * 5;
      dustPos[i * 3 + 1] = Math.random() * 3.5;
      dustPos[i * 3 + 2] = (Math.random() - 0.5) * 5;
    }
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    const dust = new THREE.Points(
      dustGeo,
      new THREE.PointsMaterial({ color: 0xd97706, size: 0.35, transparent: true, opacity: 0.5 })
    );
    dust.position.set(-6, -4, 0);
    excavationRoot.add(dust);
    dustParticlesRef.current = dust;

    // Trucks Fleet
    const trucksGroup = new THREE.Group();
    trucksGroup.name = 'trucksGroup';
    trucksGroupRef.current = trucksGroup;
    excavationRoot.add(trucksGroup);
    syncTruckFleet(configRef.current.machine.truckCount, configRef.current.machine.truckCapacityM3);

    scene.add(excavationRoot);

    // ================= 2. EMBANKMENT SCENE ROOT =================
    const embankmentRoot = new THREE.Group();
    embankmentRoot.name = 'embankmentRoot';
    embankmentRoot.visible = false;
    embankmentRootRef.current = embankmentRoot;

    // Embankment Earthen Fill Roadway Corridor
    const fillRoadGeo = new THREE.BoxGeometry(24, 4.0, 90);
    fillRoadGeo.translate(0, 2.0, 0);
    const fillRoadMat = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.95 });
    const fillRoad = new THREE.Mesh(fillRoadGeo, fillRoadMat);
    fillRoad.position.set(0, 0, 0);
    fillRoad.receiveShadow = true;
    fillRoad.castShadow = true;
    fillRoadwayMeshRef.current = fillRoad;
    embankmentRoot.add(fillRoad);

    // Embankment Slopes
    const slopeMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.98 });
    for (const side of [-1, 1]) {
      const slopeGeo = new THREE.BoxGeometry(6, 4.0, 90);
      slopeGeo.translate(side * 3, 2.0, 0);
      const slopeM = new THREE.Mesh(slopeGeo, slopeMat);
      slopeM.position.set(side * 12, 0, 0);
      slopeM.rotation.z = side * (Math.PI / 6);
      embankmentRoot.add(slopeM);
    }

    // Vibratory Compactor 3D Model (10-12 Ton)
    const rollerGroup = new THREE.Group();
    rollerGroup.name = 'vibroRoller';
    vibroRollerGroupRef.current = rollerGroup;

    // Rear Chassis & Engine Hood
    const rollerBody = new THREE.Mesh(
      new THREE.BoxGeometry(2.6, 2.2, 4.2),
      new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.4 })
    );
    rollerBody.position.set(0, 2.4, -1.8);
    rollerBody.castShadow = true;
    rollerGroup.add(rollerBody);

    // Operator ROPS Canopy
    const ropsCanopy = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 0.15, 2.2),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5 })
    );
    ropsCanopy.position.set(0, 4.8, -1.8);
    rollerGroup.add(ropsCanopy);

    // Flashing Beacon on Canopy
    const beacon = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.12, 0.25, 8),
      new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xf59e0b, emissiveIntensity: 2.0 })
    );
    beacon.position.set(0, 5.0, -1.8);
    rollerGroup.add(beacon);

    // Front Vibratory Steel Drum
    const drumGeo = new THREE.CylinderGeometry(1.2, 1.2, 2.8, 20);
    drumGeo.rotateZ(Math.PI / 2);
    const drumMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.35, metalness: 0.8 });
    const drum = new THREE.Mesh(drumGeo, drumMat);
    drum.position.set(0, 1.2, 2.2);
    drum.castShadow = true;
    vibroDrumRef.current = drum;
    rollerGroup.add(drum);

    // Rear Rubber Tires
    for (const side of [-1.5, 1.5]) {
      const tire = new THREE.Mesh(
        new THREE.CylinderGeometry(1.1, 1.1, 0.7, 16),
        new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.9 })
      );
      tire.rotateZ(Math.PI / 2);
      tire.position.set(side, 1.1, -2.4);
      rollerGroup.add(tire);
    }

    rollerGroup.position.set(2, 4.0, 0);
    embankmentRoot.add(rollerGroup);

    // Compactor Dust Puff System
    const rDustGeo = new THREE.BufferGeometry();
    const rDustPos = new Float32Array(80 * 3);
    for (let i = 0; i < 80; i++) {
      rDustPos[i * 3] = (Math.random() - 0.5) * 3.5;
      rDustPos[i * 3 + 1] = Math.random() * 1.5;
      rDustPos[i * 3 + 2] = (Math.random() - 0.5) * 2.5;
    }
    rDustGeo.setAttribute('position', new THREE.BufferAttribute(rDustPos, 3));
    const rDust = new THREE.Points(
      rDustGeo,
      new THREE.PointsMaterial({ color: 0xd97706, size: 0.3, transparent: true, opacity: 0.4 })
    );
    rDust.position.set(2, 4.2, 2.2);
    rollerDustRef.current = rDust;
    embankmentRoot.add(rDust);

    // Bulldozer D65P on fill head
    const dozer = new THREE.Group();
    dozer.position.set(-6, 4.0, 30);
    const dozerBody = new THREE.Mesh(
      new THREE.BoxGeometry(3.0, 2.2, 4.5),
      new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.4 })
    );
    dozerBody.position.y = 1.8;
    dozer.add(dozerBody);

    // Big Curved Dozer Blade in front
    const blade = new THREE.Mesh(
      new THREE.BoxGeometry(4.2, 1.5, 0.4),
      new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.4, metalness: 0.6 })
    );
    blade.position.set(0, 0.8, 3.2);
    dozer.add(blade);
    embankmentRoot.add(dozer);

    scene.add(embankmentRoot);

    // ================= 3. RIGID PAVEMENT SCENE ROOT =================
    const rigidRoot = new THREE.Group();
    rigidRoot.name = 'rigidRoot';
    rigidRoot.visible = false;
    rigidRootRef.current = rigidRoot;

    // Base Lean Concrete / Subbase
    const subbase = new THREE.Mesh(
      new THREE.BoxGeometry(16, 0.4, 110),
      new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.9 })
    );
    subbase.position.set(0, 0.2, 0);
    subbase.receiveShadow = true;
    rigidRoot.add(subbase);

    // Extending Rigid Concrete Pavement Slab (Tebal 25 cm)
    const slabGeo = new THREE.BoxGeometry(14, 0.6, 90);
    slabGeo.translate(0, 0.3, 45); // Extends from Z=0 to Z=+90
    const slabMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.5, metalness: 0.1 });
    const slab = new THREE.Mesh(slabGeo, slabMat);
    slab.position.set(0, 0.4, -45);
    slab.receiveShadow = true;
    slab.castShadow = true;
    pavedSlabMeshRef.current = slab;
    rigidRoot.add(slab);

    // Transverse Saw-cut Contraction Joints along the Slab
    const jointMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.9 });
    for (let j = 0; j < 18; j++) {
      const joint = new THREE.Mesh(new THREE.BoxGeometry(14.2, 0.05, 0.12), jointMat);
      joint.position.set(0, 1.02, -45 + j * 5.0);
      rigidRoot.add(joint);
    }

    // Concrete Boom Pump Truck
    const pumpTruck = new THREE.Group();
    pumpTruck.position.set(-11, 0, 15);
    const pumpChassis = new THREE.Mesh(
      new THREE.BoxGeometry(3.0, 2.0, 9.0),
      new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.4 })
    );
    pumpChassis.position.y = 1.6;
    pumpTruck.add(pumpChassis);

    // Articulated 4-Section Placing Boom
    const pumpBoom = new THREE.Group();
    pumpBoom.position.set(0, 3.2, -1.0);
    pumpBoomRef.current = pumpBoom;

    const b1 = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.5, 9.0),
      new THREE.MeshStandardMaterial({ color: 0xd97706 })
    );
    b1.position.set(4.0, 4.5, 0);
    b1.rotation.y = Math.PI / 4;
    b1.rotation.z = -Math.PI / 6;
    pumpBoom.add(b1);

    // Flexible Tremie Hose hanging over pour face
    const hose = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.15, 4.5, 8),
      new THREE.MeshStandardMaterial({ color: 0x18181b })
    );
    hose.position.set(7.0, 2.2, 0);
    pumpBoom.add(hose);

    pumpTruck.add(pumpBoom);
    rigidRoot.add(pumpTruck);

    // Concrete Transit Mixer Truck with Revolving Drum
    const mixerTruck = new THREE.Group();
    mixerTruck.position.set(-11, 0, 2);
    const mixerCab = new THREE.Mesh(
      new THREE.BoxGeometry(2.8, 2.4, 2.5),
      new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.4 })
    );
    mixerCab.position.set(0, 1.8, 3.2);
    mixerTruck.add(mixerCab);

    // Revolving Angled Mixer Drum
    const drumMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(1.6, 0.9, 5.2, 16),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.35 })
    );
    drumMesh.position.set(0, 2.6, -1.2);
    drumMesh.rotation.x = Math.PI / 5;
    mixerDrumMeshRef.current = drumMesh;
    mixerTruck.add(drumMesh);

    rigidRoot.add(mixerTruck);
    scene.add(rigidRoot);

    // ================= 4. U-DITCH PRECAST SCENE ROOT =================
    const uditchRoot = new THREE.Group();
    uditchRoot.name = 'uditchRoot';
    uditchRoot.visible = false;
    uditchRootRef.current = uditchRoot;

    // Roadway alongside Trench
    const pavedRoad = new THREE.Mesh(
      new THREE.BoxGeometry(18, 0.4, 110),
      new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.88 })
    );
    pavedRoad.position.set(10, 0.2, 0);
    uditchRoot.add(pavedRoad);

    // Drainage Trench Channel (Depth y = -2.2)
    const trenchFloor = new THREE.Mesh(
      new THREE.BoxGeometry(3.6, 0.4, 90),
      new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.95 }) // Sand bedding
    );
    trenchFloor.position.set(-6, -2.0, 0);
    uditchRoot.add(trenchFloor);

    // Placed Precast U-Ditch Units Group
    const placedUDitches = new THREE.Group();
    uditchTrenchPlacedRef.current = placedUDitches;

    const concreteUChannelMat = new THREE.MeshStandardMaterial({
      color: 0xcbd5e1,
      roughness: 0.6,
      metalness: 0.1,
    });

    // Helper to generate a hollow precast U-channel
    const createUChannelSegment = (zPos: number) => {
      const uSeg = new THREE.Group();
      uSeg.position.set(-6, -1.8, zPos);

      // Bottom slab
      const bottom = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.3, 1.15), concreteUChannelMat);
      bottom.position.y = 0.15;
      uSeg.add(bottom);

      // Left Wall
      const wallL = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.6, 1.15), concreteUChannelMat);
      wallL.position.set(-0.85, 0.95, 0);
      uSeg.add(wallL);

      // Right Wall
      const wallR = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.6, 1.15), concreteUChannelMat);
      wallR.position.set(0.85, 0.95, 0);
      uSeg.add(wallR);

      return uSeg;
    };

    // Pre-populate initial laid segments
    for (let u = 0; u < 28; u++) {
      const seg = createUChannelSegment(-40 + u * 1.25);
      placedUDitches.add(seg);
    }
    uditchRoot.add(placedUDitches);

    // Mobile Crane 25 Ton (Positioned on the road bed)
    const craneGroup = new THREE.Group();
    craneGroup.position.set(3, 0.4, 0);

    // Crane Carrier & Outriggers
    const carrier = new THREE.Mesh(
      new THREE.BoxGeometry(3.2, 1.8, 10.5),
      new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.4 })
    );
    carrier.position.y = 1.2;
    craneGroup.add(carrier);

    // Outrigger Beams
    for (const zSide of [-4.0, 4.0]) {
      for (const xSide of [-2.4, 2.4]) {
        const outrigger = new THREE.Mesh(
          new THREE.BoxGeometry(1.6, 0.4, 0.4),
          new THREE.MeshStandardMaterial({ color: 0x18181b })
        );
        outrigger.position.set(xSide, 0.5, zSide);
        craneGroup.add(outrigger);
      }
    }

    // Crane Slewing Superstructure
    const craneSlew = new THREE.Group();
    craneSlew.position.set(0, 2.4, -1.0);
    craneSlewRef.current = craneSlew;

    const craneCab = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 1.8, 2.2),
      new THREE.MeshStandardMaterial({ color: 0x0284c7 })
    );
    craneCab.position.set(-1.0, 0.9, 0.5);
    craneSlew.add(craneCab);

    // Telescopic Boom
    const craneBoom = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 0.8, 14.0),
      new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.3 })
    );
    craneBoom.position.set(0, 4.5, -3.5);
    craneBoom.rotation.x = -Math.PI / 3.5;
    craneSlew.add(craneBoom);

    // Suspended Hook & Slung U-Ditch block
    const hookGroup = new THREE.Group();
    hookGroup.position.set(0, 1.5, -9.5);
    craneHookBlockRef.current = hookGroup;

    // Hoist Cable
    const cable = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 6.0, 6),
      new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8 })
    );
    cable.position.y = 3.0;
    hookGroup.add(cable);

    // 4-Leg Wire Rope Sling holding U-Ditch
    const slungUDitch = createUChannelSegment(0);
    slungUDitch.position.set(0, 0, 0);
    hookGroup.add(slungUDitch);

    craneSlew.add(hookGroup);
    craneGroup.add(craneSlew);
    uditchRoot.add(craneGroup);

    scene.add(uditchRoot);

    // ================= SITE WORKERS =================
    const workersGroup = new THREE.Group();
    workersGroup.name = 'workersGroup';

    const spotter = createWorkerFigure('spotter');
    spotter.position.set(20.5, 0, 12.5);
    spotter.rotation.y = -Math.PI / 4;
    workersGroup.add(spotter);
    const spotterFlagArm = spotter.getObjectByName('flagArm') as THREE.Group | null;

    const mandor = createWorkerFigure('mandor');
    mandor.position.set(-11, 0, 9);
    mandor.rotation.y = Math.PI / 3.2;
    workersGroup.add(mandor);

    scene.add(workersGroup);

    // ================= RENDER & ANIMATION LOOP =================
    const clock = new THREE.Clock();
    const loadingSpotPos = new THREE.Vector3(2, -5, 0);
    const lookTarget = new THREE.Vector3();

    function animate() {
      animFrameRef.current = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const time = clock.getElapsedTime();

      if (spotterFlagArm) {
        spotterFlagArm.rotation.z = -Math.PI / 4 + Math.sin(time * 3.5) * 0.22;
      }

      const currentSim = simStateRef.current;
      const currentCfg = configRef.current;
      const act = currentCfg.scope.activity;
      const isPlaying = currentSim.isPlaying;
      const speedMult = currentSim.speedMultiplier;

      // Visibility switching based on active civil work package
      if (excavationRootRef.current) {
        excavationRootRef.current.visible = act === 'excavation' || act === 'concrete';
      }
      if (embankmentRootRef.current) {
        embankmentRootRef.current.visible = act === 'embankment';
      }
      if (rigidRootRef.current) {
        rigidRootRef.current.visible = act === 'rigid_pavement';
      }
      if (uditchRootRef.current) {
        uditchRootRef.current.visible = act === 'uditch';
      }

      // ================= 1. EXCAVATION ANIMATIONS =================
      if (act === 'excavation' || act === 'concrete') {
        const haulDist = currentCfg.scope.haulDistanceKm;
        const loopDurationSec = Math.max(6, (haulDist * 3.2 + 10) / speedMult);
        const cycleRate = 1.0 / loopDurationSec;

        if (isPlaying) {
          haulClockRef.current += delta * cycleRate;
        }

        let truckInLoadingZone = false;

        if (trucksGroupRef.current) {
          const truckList = trucksGroupRef.current.children;
          const nTrucks = truckList.length;

          for (let idx = 0; idx < nTrucks; idx++) {
            const tr = truckList[idx];
            const uOffset = idx / nTrucks;
            const u = (haulClockRef.current + uOffset) % 1.0;

            const pos = haulCurve.getPointAt(u);
            tr.position.copy(pos);

            const tangent = haulCurve.getTangentAt(u).normalize();
            lookTarget.copy(pos).add(tangent);
            tr.lookAt(lookTarget);

            const bed = tr.getObjectByName('bedPivot');
            const soil = tr.getObjectByName('soilInBed');

            const distToLoading = pos.distanceTo(loadingSpotPos);
            if (distToLoading < 6.0) {
              truckInLoadingZone = true;
            }

            if (u < 0.12) {
              if (bed) bed.rotation.x = 0;
              if (soil) soil.visible = true;
            } else if (u < 0.46) {
              if (bed) bed.rotation.x = 0;
              if (soil) soil.visible = true;
            } else if (u >= 0.46 && u <= 0.58) {
              const dumpP = (u - 0.46) / 0.12;
              const tiltAngle = Math.sin(dumpP * Math.PI) * (Math.PI / 4.0);
              if (bed) bed.rotation.x = -tiltAngle;
              if (soil) soil.visible = dumpP < 0.45;
            } else {
              if (bed) bed.rotation.x = 0;
              if (soil) soil.visible = false;
            }
          }
        }

        setActiveTrucksInSpot(truckInLoadingZone);

        // Excavator Kinematics
        if (excavatorSlewRef.current && boomRef.current && stickRef.current && bucketRef.current) {
          if (isPlaying && truckInLoadingZone) {
            const digCycleSec = Math.max(0.3, 3.2 / speedMult);
            digClockRef.current += delta / digCycleSec;
            const digPhase = digClockRef.current % 1.0;

            if (digPhase < 0.4) {
              const p = digPhase / 0.4;
              excavatorSlewRef.current.rotation.y = THREE.MathUtils.lerp(-0.3, -1.1, Math.sin(p * Math.PI * 0.5));
              boomRef.current.rotation.x = -0.2 - Math.sin(p * Math.PI) * 0.35;
              stickRef.current.rotation.x = 0.3 + Math.sin(p * Math.PI) * 0.4;
              bucketRef.current.rotation.x = 0.2 + p * 0.9;
            } else if (digPhase < 0.6) {
              const p = (digPhase - 0.4) / 0.2;
              excavatorSlewRef.current.rotation.y = THREE.MathUtils.lerp(-1.1, 1.4, p);
              boomRef.current.rotation.x = THREE.MathUtils.lerp(-0.2, 0.2, p);
              stickRef.current.rotation.x = THREE.MathUtils.lerp(0.7, -0.1, p);
              bucketRef.current.rotation.x = 1.1;
            } else if (digPhase < 0.8) {
              const p = (digPhase - 0.6) / 0.2;
              excavatorSlewRef.current.rotation.y = 1.4;
              boomRef.current.rotation.x = 0.2 - Math.sin(p * Math.PI) * 0.15;
              stickRef.current.rotation.x = -0.1 + p * 0.3;
              bucketRef.current.rotation.x = THREE.MathUtils.lerp(1.1, -0.4, p);
            } else {
              const p = (digPhase - 0.8) / 0.2;
              excavatorSlewRef.current.rotation.y = THREE.MathUtils.lerp(1.4, -0.3, p);
              boomRef.current.rotation.x = THREE.MathUtils.lerp(0.1, -0.2, p);
              stickRef.current.rotation.x = THREE.MathUtils.lerp(0.2, 0.3, p);
              bucketRef.current.rotation.x = THREE.MathUtils.lerp(-0.4, 0.2, p);
            }

            if (dustParticlesRef.current) {
              dustParticlesRef.current.visible = true;
              dustParticlesRef.current.rotation.y += delta * 1.5;
            }
          } else {
            excavatorSlewRef.current.rotation.y = THREE.MathUtils.lerp(excavatorSlewRef.current.rotation.y, 0.2, delta * 4.0);
            boomRef.current.rotation.x = THREE.MathUtils.lerp(boomRef.current.rotation.x, -0.15, delta * 4.0);
            stickRef.current.rotation.x = THREE.MathUtils.lerp(stickRef.current.rotation.x, 0.2, delta * 4.0);
            bucketRef.current.rotation.x = THREE.MathUtils.lerp(bucketRef.current.rotation.x, 0.3, delta * 4.0);
            if (dustParticlesRef.current) dustParticlesRef.current.visible = false;
          }
        }
      }

      // ================= 2. EMBANKMENT ANIMATIONS =================
      if (act === 'embankment') {
        if (isPlaying) {
          const rollerCycleSec = Math.max(1.5, 9.0 / speedMult);
          compactorClockRef.current += delta / rollerCycleSec;
        }

        const compPhase = (compactorClockRef.current % 1.0) * Math.PI * 2;
        const zPos = Math.sin(compPhase) * 28.0; // Drives between Z = -28 and +28
        const movingForward = Math.cos(compPhase) >= 0;

        if (vibroRollerGroupRef.current) {
          vibroRollerGroupRef.current.position.z = zPos;
          vibroRollerGroupRef.current.rotation.y = movingForward ? 0 : Math.PI;

          // Rolling steel drum
          if (vibroDrumRef.current && isPlaying) {
            vibroDrumRef.current.rotation.x += delta * (movingForward ? 6.0 : -6.0) * speedMult;
          }
        }

        // Dust puffing under drum
        if (rollerDustRef.current) {
          rollerDustRef.current.position.z = zPos + (movingForward ? 2.2 : -2.2);
          rollerDustRef.current.visible = isPlaying;
          if (isPlaying) rollerDustRef.current.rotation.y += delta * 2.0;
        }
      }

      // ================= 3. RIGID PAVEMENT ANIMATIONS =================
      if (act === 'rigid_pavement') {
        if (isPlaying) {
          mixerClockRef.current += delta * 3.5 * speedMult;
          // Revolving mixer drum
          if (mixerDrumMeshRef.current) {
            mixerDrumMeshRef.current.rotation.y += delta * 2.5 * speedMult;
          }

          // Pump boom gentle vibration
          if (pumpBoomRef.current) {
            pumpBoomRef.current.rotation.z = -Math.PI / 6 + Math.sin(time * 6.0) * 0.015;
          }
        }
      }

      // ================= 4. U-DITCH PRECAST ANIMATIONS =================
      if (act === 'uditch') {
        if (isPlaying) {
          const craneCycleSec = Math.max(2.0, 7.5 / speedMult);
          craneClockRef.current += delta / craneCycleSec;
        }

        const cranePhase = craneClockRef.current % 1.0;

        if (craneSlewRef.current && craneHookBlockRef.current) {
          // Crane cycle:
          // 0.0 - 0.4: Slew toward trench & lower block
          // 0.4 - 0.6: Seating precast into sand bed
          // 0.6 - 1.0: Slew back to flatbed truck
          if (cranePhase < 0.4) {
            const p = cranePhase / 0.4;
            craneSlewRef.current.rotation.y = THREE.MathUtils.lerp(0.8, -1.2, p);
            craneHookBlockRef.current.position.y = THREE.MathUtils.lerp(2.5, -0.6, Math.sin(p * Math.PI));
          } else if (cranePhase < 0.6) {
            craneSlewRef.current.rotation.y = -1.2;
            craneHookBlockRef.current.position.y = -0.6;
          } else {
            const p = (cranePhase - 0.6) / 0.4;
            craneSlewRef.current.rotation.y = THREE.MathUtils.lerp(-1.2, 0.8, p);
            craneHookBlockRef.current.position.y = THREE.MathUtils.lerp(-0.6, 2.5, p);
          }
        }
      }

      controls.update();
      renderer.render(scene, camera);
    }

    animate();

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    const resizeObs = new ResizeObserver(handleResize);
    resizeObs.observe(container);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      resizeObs.disconnect();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [cameraPresets.pit, createDumpTruckMesh, createWorkerFigure, syncTruckFleet]);

  // Synchronize 3D truck fleet dynamically
  useEffect(() => {
    syncTruckFleet(config.machine.truckCount, config.machine.truckCapacityM3);
  }, [config.machine.truckCount, config.machine.truckCapacityM3, syncTruckFleet]);

  // Reset positions on simulation reset
  useEffect(() => {
    if (simState.elapsedSimSeconds === 0 && !simState.isPlaying) {
      haulClockRef.current = 0;
      digClockRef.current = 0;
      compactorClockRef.current = 0;
      craneClockRef.current = 0;
      mixerClockRef.current = 0;
      setActiveTrucksInSpot(false);
      if (trucksGroupRef.current) {
        syncTruckFleet(config.machine.truckCount, config.machine.truckCapacityM3);
      }
    }
  }, [simState.elapsedSimSeconds, simState.isPlaying, config.machine.truckCount, config.machine.truckCapacityM3, syncTruckFleet]);

  // Update dynamic meshes as simulation progresses
  useEffect(() => {
    const progress = Math.min(100, Math.max(0, simState.progressPercent)) / 100;

    // Excavation: soil block shrinking & spoil growing
    if (soilBlockMeshRef.current && spoilPileMeshRef.current) {
      const remainRatio = Math.max(0.02, 1.0 - progress);
      soilBlockMeshRef.current.scale.y = remainRatio;
      const spoilScale = 0.3 + progress * 1.8;
      spoilPileMeshRef.current.scale.set(spoilScale, spoilScale * 0.9, spoilScale);
    }

    // Embankment: roadway fill height & length rising
    if (fillRoadwayMeshRef.current) {
      fillRoadwayMeshRef.current.scale.y = 0.2 + progress * 0.8;
    }

    // Rigid Pavement: paved slab extending forward
    if (pavedSlabMeshRef.current) {
      pavedSlabMeshRef.current.scale.z = Math.max(0.05, progress);
    }
  }, [simState.progressPercent]);

  // Format IDR Currency
  const formatIDR = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const handleCopyAhsp = () => {
    if (!metrics.benchmarks) return;
    const tsv = formatAhspForExcel(metrics.benchmarks, config);
    navigator.clipboard.writeText(tsv);
    setCopiedAhsp(true);
    setTimeout(() => setCopiedAhsp(false), 2000);
  };

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#0a0f1d] select-none">
      {/* 3D WebGL Canvas */}
      <div ref={containerRef} className="w-full h-full" />

      {/* Floating Telemetry HUD (Top Left) */}
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-2.5 max-w-sm pointer-events-auto">
        <div className="bg-[#0f172a]/95 backdrop-blur-xl border border-slate-800 rounded-2xl p-3.5 shadow-2xl space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-amber-400 animate-pulse" />
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                {metrics.workPackageTitle}
              </span>
            </div>
            <span
              className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border ${
                metrics.matchFactorStatus === 'balanced'
                  ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800'
                  : metrics.matchFactorStatus === 'under_trucked'
                  ? 'bg-amber-950/80 text-amber-300 border-amber-800 animate-pulse'
                  : 'bg-blue-950/80 text-blue-300 border-blue-800'
              }`}
            >
              MF: {metrics.matchFactor.toFixed(2)}
            </span>
          </div>

          {/* Volume Progress Bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Progres Pelaksanaan:</span>
              <span className="font-mono font-bold text-white">
                {simState.progressPercent.toFixed(1)}%
              </span>
            </div>
            <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-sky-500 transition-all duration-200"
                style={{ width: `${Math.min(100, simState.progressPercent)}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>
                Selesai: {Math.round(simState.excavatedVolumeM3).toLocaleString()} {metrics.unitLabel}
              </span>
              <span>
                Sisa: {Math.round(simState.remainingVolumeM3).toLocaleString()} {metrics.unitLabel}
              </span>
            </div>
          </div>

          {/* 3 Core Output Metrics */}
          <div className="grid grid-cols-3 gap-2 text-center pt-1">
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2">
              <span className="text-[10px] text-slate-400 block">Output Rate</span>
              <span className="font-mono font-bold text-white text-xs sm:text-sm">
                {metrics.dailyOutputM3}
              </span>
              <span className="text-[9px] text-slate-500 block">{metrics.unitLabel}/hari</span>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2">
              <span className="text-[10px] text-slate-400 block">Elapsed</span>
              <span className="font-mono font-bold text-sky-400 text-xs sm:text-sm">
                {(simState.elapsedSimSeconds / 3600).toFixed(1)}
              </span>
              <span className="text-[9px] text-slate-500 block">Jam</span>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2">
              <span className="text-[10px] text-slate-400 block">
                {config.scope.activity === 'uditch' ? 'Precast' : 'Rit / Trip'}
              </span>
              <span className="font-mono font-bold text-emerald-400 text-xs sm:text-sm">
                {config.scope.activity === 'uditch'
                  ? Math.round(simState.excavatedVolumeM3 / 1.2)
                  : simState.truckRitsCompleted}
              </span>
              <span className="text-[9px] text-slate-500 block">
                {config.scope.activity === 'uditch' ? 'pcs' : 'rit'}
              </span>
            </div>
          </div>

          {/* Accrued Cost Readout */}
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-2 flex items-center justify-between text-xs">
            <span className="text-slate-400">Total Biaya Berjalan:</span>
            <span className="font-mono font-bold text-amber-300">
              {formatIDR(simState.totalCostAccruedIdr)}
            </span>
          </div>

          {/* Active Site Crew Telemetry Badge */}
          <div className="flex items-center justify-between text-[11px] bg-slate-900/80 px-2.5 py-1.5 rounded-lg border border-slate-800">
            <div className="flex items-center gap-1.5 text-slate-300">
              <HardHat className="w-3.5 h-3.5 text-amber-400" />
              <span>
                Crew: <strong className="text-white font-mono">{metrics.totalCrewHeadcount} Orang</strong>
              </span>
            </div>
            <span className="font-mono text-[9px] text-amber-300 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-900/50">
              ({metrics.crewBreakdownText})
            </span>
          </div>

          {/* Fleet Status Indicator Pill */}
          <div className="flex items-center justify-between text-[11px] bg-slate-900/80 px-2.5 py-1.5 rounded-lg border border-slate-800">
            <div className="flex items-center gap-1.5 text-slate-300">
              <Truck className="w-3.5 h-3.5 text-sky-400" />
              <span>
                {metrics.benchmarks.primaryEquipLabel} & {metrics.benchmarks.secondaryEquipLabel}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  simState.isPlaying
                    ? config.scope.activity === 'excavation' && activeTrucksInSpot
                      ? 'bg-emerald-400 animate-ping'
                      : 'bg-emerald-400'
                    : 'bg-amber-400'
                }`}
              />
              <span
                className={`font-mono text-[10px] ${
                  simState.isPlaying ? 'text-emerald-400 font-bold' : 'text-amber-400'
                }`}
              >
                {simState.isPlaying
                  ? config.scope.activity === 'excavation'
                    ? activeTrucksInSpot
                      ? 'EXCAVATOR LOADING'
                      : 'FLEET TRANSIT'
                    : 'SIMULATION ACTIVE'
                  : 'STANDBY PAUSE'}
              </span>
            </div>
          </div>
        </div>

        {/* Productivity Benchmarks & AHSP Reference Card */}
        {metrics.benchmarks && (
          <div className="bg-[#0f172a]/95 backdrop-blur-xl border border-slate-800 rounded-2xl p-3 shadow-2xl space-y-2.5">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setIsAhspOpen((prev) => !prev)}
                className="flex items-center gap-1.5 text-xs font-bold text-white hover:text-emerald-400 transition"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                <span>Productivity & AHSP Index</span>
                {isAhspOpen ? (
                  <ChevronUp className="w-3 h-3 text-slate-400 ml-0.5" />
                ) : (
                  <ChevronDown className="w-3 h-3 text-slate-400 ml-0.5" />
                )}
              </button>
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-mono text-emerald-300 bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-800/60 font-semibold">
                  PUPR
                </span>
                <button
                  onClick={handleCopyAhsp}
                  className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-md transition active:scale-95"
                  title="Copy Permen PUPR AHSP Table for Excel"
                >
                  {copiedAhsp ? (
                    <>
                      <Check className="w-2.5 h-2.5 text-emerald-400" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-2.5 h-2.5" />
                      <span>Copy AHSP</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Quick Benchmark 4-Tile Grid */}
            <div className="grid grid-cols-2 gap-1.5 text-[11px]">
              <div className="bg-slate-900/80 border border-slate-800/80 rounded-lg p-1.5">
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span className="truncate max-w-[90px]">{metrics.benchmarks.primaryEquipLabel}</span>
                  <span className="font-mono text-emerald-400 font-bold">
                    {metrics.benchmarks.primaryEquipOutput.toFixed(1)} {metrics.unitLabel}/j
                  </span>
                </div>
                <div className="text-[9px] font-mono text-slate-400 mt-0.5">
                  Koef:{' '}
                  <span className="text-white">
                    {metrics.benchmarks.primaryEquipCoeff.toFixed(4)}
                  </span>{' '}
                  jam/{metrics.unitLabel}
                </div>
              </div>

              <div className="bg-slate-900/80 border border-slate-800/80 rounded-lg p-1.5">
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span className="truncate max-w-[90px]">{metrics.benchmarks.secondaryEquipLabel}</span>
                  <span className="font-mono text-sky-400 font-bold">
                    {metrics.benchmarks.secondaryEquipOutput.toFixed(1)} {metrics.unitLabel}/j
                  </span>
                </div>
                <div className="text-[9px] font-mono text-slate-400 mt-0.5">
                  Koef:{' '}
                  <span className="text-white">
                    {metrics.benchmarks.secondaryEquipCoeff.toFixed(4)}
                  </span>{' '}
                  jam/{metrics.unitLabel}
                </div>
              </div>

              <div className="bg-slate-900/80 border border-slate-800/80 rounded-lg p-1.5">
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span>👷 Labor Crew</span>
                  <span className="font-mono text-amber-300 font-bold">
                    {metrics.benchmarks.crewOutputM3PerManDay.toFixed(1)} {metrics.unitLabel}/OH
                  </span>
                </div>
                <div className="text-[9px] font-mono text-slate-400 mt-0.5">
                  Koef:{' '}
                  <span className="text-white">
                    {metrics.benchmarks.totalLaborCoeffOhPerM3.toFixed(4)}
                  </span>{' '}
                  OH/{metrics.unitLabel}
                </div>
              </div>

              <div className="bg-slate-900/80 border border-slate-800/80 rounded-lg p-1.5">
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span>⛽ Solar Index</span>
                  <span className="font-mono text-violet-400 font-bold">
                    {metrics.benchmarks.fuelIndexLitersPerM3.toFixed(2)} L/{metrics.unitLabel}
                  </span>
                </div>
                <div className="text-[9px] font-mono text-slate-400 mt-0.5">
                  Standar:{' '}
                  <span className="text-white">Permen PUPR</span>
                </div>
              </div>
            </div>

            {/* Collapsible PUPR Cost Subtotals Breakdown */}
            {isAhspOpen && (
              <div className="space-y-1.5 pt-1 border-t border-slate-800/60 text-[10px]">
                <div className="flex justify-between text-slate-400">
                  <span>A. Tenaga Kerja:</span>
                  <span className="font-mono text-slate-200">
                    {formatIDR(metrics.benchmarks.subtotalTenagaKerja)}
                  </span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>B. Bahan:</span>
                  <span className="font-mono text-slate-200">
                    {formatIDR(metrics.benchmarks.subtotalBahan)}
                  </span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>C. Peralatan:</span>
                  <span className="font-mono text-slate-200">
                    {formatIDR(metrics.benchmarks.subtotalPeralatan)}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-slate-800 font-semibold">
                  <span className="text-emerald-400">Harga Satuan (HSP):</span>
                  <span className="font-mono text-emerald-300 text-xs">
                    {formatIDR(metrics.benchmarks.totalUnitPricePermenPupr)} / {metrics.unitLabel}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* OrbitControls Navigation Helper Hint (Top Right) */}
      <div className="absolute top-4 right-4 z-10 hidden lg:flex items-center gap-2 bg-[#0f172a]/80 backdrop-blur-md border border-slate-800 text-[11px] text-slate-400 px-3 py-1.5 rounded-xl shadow-lg">
        <Compass className="w-3.5 h-3.5 text-sky-400" />
        <span>Left-click: Orbit • Right-click: Pan • Scroll: Zoom</span>
      </div>

      {/* Simulation Playback & Speed Controls (Bottom Center) */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex flex-wrap items-center gap-2 bg-[#0f172a]/95 backdrop-blur-xl border border-slate-800 px-4 py-2 rounded-2xl shadow-2xl">
        <button
          onClick={onTogglePlay}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold transition shadow-lg ${
            simState.isPlaying
              ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/30'
              : 'bg-sky-500 hover:bg-sky-400 text-slate-950 shadow-sky-500/30'
          }`}
        >
          {simState.isPlaying ? (
            <>
              <Pause className="w-4 h-4 fill-current" />
              <span>PAUSE</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-current ml-0.5" />
              <span>SIMULATE</span>
            </>
          )}
        </button>

        <button
          onClick={onReset}
          className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition"
          title="Reset Simulation"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-0.5 ml-1">
          <div className="px-2 py-0.5 flex items-center text-slate-500">
            <Gauge className="w-3 h-3 mr-1" />
          </div>
          {[1, 5, 20].map((s) => (
            <button
              key={s}
              onClick={() => onChangeSpeed(s)}
              className={`px-2.5 py-1 text-xs font-mono rounded-lg font-semibold transition ${
                simState.speedMultiplier === s
                  ? 'bg-sky-500 text-slate-950'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {s}x
            </button>
          ))}
        </div>

        <div className="hidden sm:flex items-center gap-1 pl-2 border-l border-slate-800">
          <Camera className="w-3.5 h-3.5 text-slate-500 mr-1" />
          {[
            { key: 'pit', label: 'Overview' },
            { key: 'equipment', label: 'Equipment' },
            { key: 'haul', label: 'Workzone' },
            { key: 'topdown', label: '2D Plan' },
          ].map((preset) => (
            <button
              key={preset.key}
              onClick={() => flyToPreset(preset.key)}
              className={`px-2 py-0.5 text-[11px] rounded-lg font-medium transition ${
                activePreset === preset.key
                  ? 'bg-slate-700 text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
