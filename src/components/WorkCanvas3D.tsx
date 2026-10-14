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
} from 'lucide-react';

interface WorkCanvas3DProps {
  config: SimulatorConfig;
  metrics: ProductivityMetrics;
  simState: LiveSimulationState;
  onTogglePlay: () => void;
  onReset: () => void;
  onChangeSpeed: (speed: number) => void;
}

// Closed-loop 3D waypoint circuit for dump truck fleet
const HAUL_WAYPOINTS = [
  new THREE.Vector3(2, -5, 0),    // Point A: Loading Spot beside Excavator (Pit floor)
  new THREE.Vector3(10, -5, 1),   // Pit floor exit straightaway
  new THREE.Vector3(16, -3.5, 3), // Ramp ascending out of pit
  new THREE.Vector3(24, 0, 8),    // Ramp crest reaching ground surface level
  new THREE.Vector3(34, 0, 16),   // Surface haul road turn
  new THREE.Vector3(46, 0, 26),   // Surface straightaway
  new THREE.Vector3(58, 0, 36),   // Approaching disposal site
  new THREE.Vector3(65, 0, 42),   // Disposal site entrance
  new THREE.Vector3(68, 0, 48),   // Point D: Spoil dumping spot (bed tilting)
  new THREE.Vector3(63, 0, 54),   // Turnaround loop behind spoil pile
  new THREE.Vector3(50, 0, 42),   // Return haul road
  new THREE.Vector3(36, 0, 28),   // Return lane
  new THREE.Vector3(24, 0, 14),   // Approaching pit ramp
  new THREE.Vector3(16, 0, 8),    // Ramp crest entering pit
  new THREE.Vector3(12, -3.5, 3), // Mid-ramp descent
  new THREE.Vector3(6, -5, 0),    // Approaching loading bay
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
  const isTruckLoadingRef = useRef<boolean>(false);

  // Mesh & Group refs for 4D excavation & heavy equipment animation
  const soilBlockMeshRef = useRef<THREE.Mesh | null>(null);
  const spoilPileMeshRef = useRef<THREE.Mesh | null>(null);
  const excavatorGroupRef = useRef<THREE.Group | null>(null);
  const excavatorSlewRef = useRef<THREE.Group | null>(null);
  const boomRef = useRef<THREE.Group | null>(null);
  const stickRef = useRef<THREE.Group | null>(null);
  const bucketRef = useRef<THREE.Group | null>(null);
  const trucksGroupRef = useRef<THREE.Group | null>(null);
  const dustParticlesRef = useRef<THREE.Points | null>(null);

  const [activePreset, setActivePreset] = useState<string>('pit');
  const [activeTrucksInSpot, setActiveTrucksInSpot] = useState<boolean>(false);

  // Camera presets
  const cameraPresets: Record<string, { pos: [number, number, number]; target: [number, number, number] }> = {
    pit: { pos: [-36, 24, 28], target: [0, 2, 0] },
    excavator: { pos: [-16, 8, 14], target: [-4, 2, 0] },
    haul: { pos: [-10, 24, 65], target: [25, 2, 50] },
    spoil: { pos: [72, 16, 52], target: [60, 4, 35] },
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
      const ease = 1 - Math.pow(1 - progress, 3); // cubic ease-out

      cameraRef.current?.position.lerpVectors(startPos, endPos, ease);
      controlsRef.current?.target.lerpVectors(startTarget, endTarget, ease);
      controlsRef.current?.update();

      if (progress < 1) {
        requestAnimationFrame(step);
      }
    }
    requestAnimationFrame(step);
  }, []);

  // Helper to build a detailed, lightweight 3D dump truck mesh
  const createDumpTruckMesh = useCallback((id: number, capacityM3: number) => {
    const t = new THREE.Group();
    t.name = `truck_${id}`;

    const isLargeTruck = capacityM3 >= 16;
    const bedLength = isLargeTruck ? 5.8 : 4.8;
    const bedHeight = isLargeTruck ? 1.8 : 1.5;
    const chassisLength = isLargeTruck ? 8.4 : 7.2;

    const blackMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.8, metalness: 0.3 });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.3, metalness: 0.8 });
    const cabColor = id % 2 === 0 ? 0x0284c7 : 0x0ea5e9; // Alternating fleet cyan/blue cabs

    // 1. Chassis
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.8, chassisLength), blackMat);
    chassis.position.y = 0.8;
    chassis.castShadow = true;
    t.add(chassis);

    // 2. Cab (Front of truck is at +Z)
    const cab = new THREE.Mesh(
      new THREE.BoxGeometry(2.5, 2.1, 2.3),
      new THREE.MeshStandardMaterial({ color: cabColor, roughness: 0.4 })
    );
    cab.position.set(0, 1.85, chassisLength * 0.32);
    cab.castShadow = true;
    t.add(cab);

    // Cab Visor / Stone Guard
    const visor = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.15, 1.2), blackMat);
    visor.position.set(0, 2.9, chassisLength * 0.32 + 0.3);
    t.add(visor);

    // Windshield
    const windshield = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 1.1, 0.1),
      new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.1, transparent: true, opacity: 0.75 })
    );
    windshield.position.set(0, 1.95, chassisLength * 0.32 + 1.16);
    t.add(windshield);

    // Headlights (Dual glowing emissive cylinders pointing along +Z)
    const hlMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xfef08a,
      emissiveIntensity: 2.2,
      roughness: 0.2,
    });
    for (const side of [-0.9, 0.9]) {
      const hl = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.1, 12), hlMat);
      hl.rotation.x = Math.PI / 2;
      hl.position.set(side, 0.9, chassisLength * 0.32 + 1.16);
      t.add(hl);
    }

    // Rear Taillights (Red emissive at -Z)
    const tailMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xef4444,
      emissiveIntensity: 1.5,
    });
    for (const side of [-1.0, 1.0]) {
      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.1), tailMat);
      tl.position.set(side, 0.8, -chassisLength * 0.5);
      t.add(tl);
    }

    // Exhaust Stack behind Cab
    const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 2.2, 8), metalMat);
    exhaust.position.set(1.15, 2.6, chassisLength * 0.32 - 1.2);
    t.add(exhaust);

    // 3. Tilting Dump Bed Pivot (Located at rear chassis)
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

    // Soil mound inside bed (Visible while hauling, hidden when dumped)
    const soilInBed = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, bedHeight * 0.65, bedLength * 0.9),
      new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.95 })
    );
    soilInBed.name = 'soilInBed';
    soilInBed.position.set(0, bedHeight * 0.75, bedLength * 0.5);
    soilInBed.visible = true;
    bedPivot.add(soilInBed);

    t.add(bedPivot);

    // 4. Heavy Off-Road Wheels
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.9 });
    const hubMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.3 });
    const zAxles = isLargeTruck ? [2.4, -0.6, -2.0, -3.4] : [2.2, -1.0, -2.6];

    for (const zPos of zAxles) {
      for (const side of [-1.4, 1.4]) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.48, 14), wheelMat);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(side, 0.55, zPos);

        const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.5, 10), hubMat);
        hub.rotation.z = Math.PI / 2;
        hub.position.set(side, 0.55, zPos);

        t.add(wheel);
        t.add(hub);
      }
    }

    t.userData = { id, capacityM3 };
    return t;
  }, []);

  // Synchronize 3D truck fleet meshes with user's slider count & capacity
  const syncTruckFleet = useCallback((count: number, capacityM3: number) => {
    const trucksGroup = trucksGroupRef.current;
    if (!trucksGroup) return;

    // Clean up existing truck meshes
    while (trucksGroup.children.length > 0) {
      const child = trucksGroup.children[0];
      trucksGroup.remove(child);
    }

    // Instantiate exactly user's configured fleet count
    const targetCount = Math.max(1, Math.min(12, count));
    for (let i = 0; i < targetCount; i++) {
      const truck = createDumpTruckMesh(i + 1, capacityM3);
      trucksGroup.add(truck);
    }
  }, [createDumpTruckMesh]);

  // Main Three.js Scene Setup & Render Loop
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    // 1. Scene with engineering dark navy backdrop & subtle depth fog
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0f1d);
    scene.fog = new THREE.FogExp2(0x0a0f1d, 0.0075);

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 1, 1200);
    const initCam = cameraPresets.pit;
    camera.position.set(...initCam.pos);
    cameraRef.current = camera;

    // 3. High-Performance WebGL Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.appendChild(renderer.domElement);

    // 4. OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(...initCam.target);
    controls.maxPolarAngle = Math.PI / 2 - 0.02; // Prevent underground clipping
    controls.minDistance = 6;
    controls.maxDistance = 280;
    controlsRef.current = controls;

    // 5. Lighting
    const ambientLight = new THREE.AmbientLight(0x94a3b8, 1.25);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xfffbeb, 2.2);
    sunLight.position.set(-65, 85, -45);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 320;
    sunLight.shadow.camera.left = -85;
    sunLight.shadow.camera.right = 85;
    sunLight.shadow.camera.top = 85;
    sunLight.shadow.camera.bottom = -85;
    sunLight.shadow.bias = -0.0005;
    scene.add(sunLight);

    const fillLight = new THREE.DirectionalLight(0x38bdf8, 0.6);
    fillLight.position.set(45, 35, 55);
    scene.add(fillLight);

    // 6. Base Ground Plane (Civil Site Grade at y = 0)
    const groundGeo = new THREE.PlaneGeometry(380, 380, 32, 32);
    groundGeo.rotateX(-Math.PI / 2);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.92,
      metalness: 0.08,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.receiveShadow = true;
    scene.add(ground);

    // Engineering Coordinate Grid
    const gridHelper = new THREE.GridHelper(320, 64, 0x334155, 0x1e293b);
    gridHelper.position.y = 0.02;
    scene.add(gridHelper);

    // 7. Excavation Pit Assembly (Depth y = -5)
    const pitGroup = new THREE.Group();
    pitGroup.name = 'pitGroup';

    // Outer Berm
    const bermGeo = new THREE.RingGeometry(18, 34, 32);
    bermGeo.rotateX(-Math.PI / 2);
    const bermMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.95 });
    const berm = new THREE.Mesh(bermGeo, bermMat);
    berm.position.set(0, 0.04, 0);
    berm.receiveShadow = true;
    pitGroup.add(berm);

    // Pit Floor
    const pitFloorGeo = new THREE.BoxGeometry(30, 0.5, 26);
    const pitFloorMat = new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.9 });
    const pitFloor = new THREE.Mesh(pitFloorGeo, pitFloorMat);
    pitFloor.position.set(0, -5, 0);
    pitFloor.receiveShadow = true;
    pitGroup.add(pitFloor);

    // Pit Slopes
    const benchMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.95 });
    for (let side = -1; side <= 1; side += 2) {
      const slopeGeo = new THREE.BoxGeometry(30, 5, 2);
      const slope = new THREE.Mesh(slopeGeo, benchMat);
      slope.position.set(0, -2.5, side * 13);
      slope.rotation.x = side * (Math.PI / 6);
      slope.receiveShadow = true;
      pitGroup.add(slope);
    }
    for (let side = -1; side <= 1; side += 2) {
      const slopeGeo = new THREE.BoxGeometry(2, 5, 26);
      const slope = new THREE.Mesh(slopeGeo, benchMat);
      slope.position.set(side * 15, -2.5, 0);
      slope.rotation.z = -side * (Math.PI / 6);
      slope.receiveShadow = true;
      pitGroup.add(slope);
    }

    // Earthen Ramp Embankment (Physical slope linking pit floor y = -5 to surface y = 0)
    const rampSlopeGeo = new THREE.BoxGeometry(9, 0.8, 18);
    const rampSlopeMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.9 });
    const rampSlope = new THREE.Mesh(rampSlopeGeo, rampSlopeMat);
    rampSlope.position.set(17, -2.5, 5);
    rampSlope.rotation.y = -Math.PI / 8;
    rampSlope.rotation.x = Math.PI / 10;
    rampSlope.receiveShadow = true;
    pitGroup.add(rampSlope);

    // 8. Dynamic In-Situ Soil Block (Excavated in real-time)
    const soilBlockGeo = new THREE.BoxGeometry(20, 6, 16);
    soilBlockGeo.translate(0, 3, 0); // Pivot at bottom

    const soilMat = new THREE.MeshStandardMaterial({
      color: 0x92400e,
      roughness: 0.92,
      metalness: 0.05,
    });
    const soilBlock = new THREE.Mesh(soilBlockGeo, soilMat);
    soilBlock.position.set(-2, -5, 0);
    soilBlock.castShadow = true;
    soilBlock.receiveShadow = true;
    soilBlockMeshRef.current = soilBlock;
    pitGroup.add(soilBlock);

    scene.add(pitGroup);

    // 9. Closed Haul Road Ribbon following the Circuit
    const haulCurve = new THREE.CatmullRomCurve3(HAUL_WAYPOINTS, true, 'catmullrom', 0.5);

    // Roadway Bed Mesh
    const roadGroup = new THREE.Group();
    const roadGeo = new THREE.TubeGeometry(haulCurve, 140, 3.4, 4, true);
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.88 });
    const road = new THREE.Mesh(roadGeo, roadMat);
    road.scale.set(1, 0.03, 1);
    road.receiveShadow = true;
    roadGroup.add(road);

    // Orange Safety Guide Delineators along Haul Road
    const coneGeo = new THREE.ConeGeometry(0.35, 0.85, 8);
    const coneMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.4 });
    for (let c = 0; c < 24; c++) {
      const u = c / 24;
      const pt = haulCurve.getPointAt(u);
      const tangent = haulCurve.getTangentAt(u).normalize();
      const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();

      const coneL = new THREE.Mesh(coneGeo, coneMat);
      coneL.position.copy(pt).addScaledVector(normal, 2.6);
      coneL.position.y += 0.4;
      roadGroup.add(coneL);

      const coneR = new THREE.Mesh(coneGeo, coneMat);
      coneR.position.copy(pt).addScaledVector(normal, -2.6);
      coneR.position.y += 0.4;
      roadGroup.add(coneR);
    }
    scene.add(roadGroup);

    // 10. Spoil Disposal Pile (Grows taller as trucks dump)
    const spoilGeo = new THREE.ConeGeometry(14, 9, 18);
    spoilGeo.translate(0, 4.5, 0);
    const spoilMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.95 });
    const spoilPile = new THREE.Mesh(spoilGeo, spoilMat);
    spoilPile.position.set(65, 0, 45);
    spoilPile.scale.set(0.3, 0.2, 0.3);
    spoilPile.castShadow = true;
    spoilPile.receiveShadow = true;
    spoilPileMeshRef.current = spoilPile;
    scene.add(spoilPile);

    // 11. Heavy Excavator 3D Model
    const excavatorGroup = new THREE.Group();
    excavatorGroup.position.set(-6, -5, 0); // Positioned inside pit beside soil block
    excavatorGroupRef.current = excavatorGroup;

    const trackMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.7, metalness: 0.6 });
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.4, metalness: 0.3 }); // Komatsu/Cat yellow
    const blackMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.6, metalness: 0.5 });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.3, metalness: 0.8 });

    // Crawler Tracks
    for (const side of [-1.8, 1.8]) {
      const track = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.3, 6.2), trackMat);
      track.position.set(side, 0.7, 0);
      track.castShadow = true;
      excavatorGroup.add(track);

      for (const zSp of [2.7, -2.7]) {
        const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 1.25, 12), blackMat);
        sp.rotation.z = Math.PI / 2;
        sp.position.set(side, 0.7, zSp);
        excavatorGroup.add(sp);
      }
    }

    // Carbody Hub
    const carbody = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.8, 3.2), blackMat);
    carbody.position.set(0, 1.1, 0);
    excavatorGroup.add(carbody);

    // Slewing Upper Carriage
    const slewGroup = new THREE.Group();
    slewGroup.position.set(0, 1.6, 0);
    excavatorSlewRef.current = slewGroup;

    // Engine House & Counterweight
    const house = new THREE.Mesh(new THREE.BoxGeometry(3.6, 2.0, 4.2), bodyMat);
    house.position.set(0, 1.1, -0.6);
    house.castShadow = true;
    slewGroup.add(house);

    const cw = new THREE.Mesh(new THREE.BoxGeometry(3.6, 1.8, 1.2), blackMat);
    cw.position.set(0, 1.0, -2.4);
    cw.castShadow = true;
    slewGroup.add(cw);

    // Operator Cab
    const cab = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 2.2, 2.2),
      new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.2, metalness: 0.1 })
    );
    cab.position.set(-1.1, 1.4, 1.0);
    cab.castShadow = true;
    slewGroup.add(cab);

    // Cab Glass Windshield
    const glass = new THREE.Mesh(
      new THREE.BoxGeometry(1.3, 1.2, 0.1),
      new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.1, transparent: true, opacity: 0.75 })
    );
    glass.position.set(-1.1, 1.5, 2.12);
    slewGroup.add(glass);

    // Exhaust Stack
    const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.4, 8), metalMat);
    exhaust.position.set(1.2, 2.6, -1.5);
    slewGroup.add(exhaust);

    // Articulated Boom Pivot
    const boomGroup = new THREE.Group();
    boomGroup.position.set(0.6, 1.4, 1.6);
    boomRef.current = boomGroup;

    const boomMesh = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.1, 6.5), bodyMat);
    boomMesh.position.set(0, 2.4, 2.6);
    boomMesh.rotation.x = -Math.PI / 4.2;
    boomMesh.castShadow = true;
    boomGroup.add(boomMesh);

    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 4.2, 8), metalMat);
    cyl.position.set(0, 1.2, 1.4);
    cyl.rotation.x = -Math.PI / 4.5;
    boomGroup.add(cyl);

    // Dipper Stick Pivot
    const stickGroup = new THREE.Group();
    stickGroup.position.set(0, 4.8, 5.0);
    stickRef.current = stickGroup;

    const stickMesh = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 4.5), bodyMat);
    stickMesh.position.set(0, -1.4, 1.6);
    stickMesh.rotation.x = Math.PI / 3.2;
    stickMesh.castShadow = true;
    stickGroup.add(stickMesh);

    // Bucket Pivot
    const bucketGroup = new THREE.Group();
    bucketGroup.position.set(0, -3.2, 3.2);
    bucketRef.current = bucketGroup;

    const bucketMesh = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.1, 1.3), blackMat);
    bucketMesh.position.set(0, -0.4, 0.4);
    bucketMesh.castShadow = true;
    bucketGroup.add(bucketMesh);

    // Bucket Teeth
    const teeth = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.2, 0.4), metalMat);
    teeth.position.set(0, -0.9, 0.95);
    bucketGroup.add(teeth);

    stickGroup.add(bucketGroup);
    boomGroup.add(stickGroup);
    slewGroup.add(boomGroup);
    excavatorGroup.add(slewGroup);
    scene.add(excavatorGroup);

    // 12. Dump Trucks Fleet Group
    const trucksGroup = new THREE.Group();
    trucksGroup.name = 'trucksGroup';
    trucksGroupRef.current = trucksGroup;
    scene.add(trucksGroup);

    // Populate initial fleet
    syncTruckFleet(configRef.current.machine.truckCount, configRef.current.machine.truckCapacityM3);

    // 13. Dust Particle System at Dig Face
    const dustCount = 160;
    const dustGeo = new THREE.BufferGeometry();
    const dustPos = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount; i++) {
      dustPos[i * 3] = (Math.random() - 0.5) * 5;
      dustPos[i * 3 + 1] = Math.random() * 3.5;
      dustPos[i * 3 + 2] = (Math.random() - 0.5) * 5;
    }
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    const dustMat = new THREE.PointsMaterial({
      color: 0xd97706,
      size: 0.35,
      transparent: true,
      opacity: 0.5,
    });
    const dust = new THREE.Points(dustGeo, dustMat);
    dust.position.set(-6, -4, 0);
    scene.add(dust);
    dustParticlesRef.current = dust;

    // 14. Smooth 60 FPS RequestAnimationFrame Loop
    const clock = new THREE.Clock();
    const loadingSpotPos = new THREE.Vector3(2, -5, 0);
    const lookTarget = new THREE.Vector3();

    function animate() {
      animFrameRef.current = requestAnimationFrame(animate);
      const delta = clock.getDelta();

      const currentSim = simStateRef.current;
      const currentCfg = configRef.current;
      const isPlaying = currentSim.isPlaying;
      const speedMult = currentSim.speedMultiplier;

      // Real-time speed-adjusted cycle rate
      // At 1x speed: ~22s per loop for 4.5km; at 5x: ~4.4s; at 20x: ~1.1s
      const haulDist = currentCfg.scope.haulDistanceKm;
      const loopDurationSec = Math.max(6, (haulDist * 3.2 + 10) / speedMult);
      const cycleRate = 1.0 / loopDurationSec;

      if (isPlaying) {
        haulClockRef.current += delta * cycleRate;
      }

      // Track if any truck in the fleet is currently stationed at Point A (loading spot)
      let truckInLoadingZone = false;

      // Animate Dump Truck Fleet along the closed CatmullRomCurve3 loop
      if (trucksGroupRef.current) {
        const truckList = trucksGroupRef.current.children;
        const nTrucks = truckList.length;

        for (let idx = 0; idx < nTrucks; idx++) {
          const tr = truckList[idx];
          // Evenly space fleet along the haul loop
          const uOffset = idx / nTrucks;
          const u = (haulClockRef.current + uOffset) % 1.0;

          // 1. Position on curve
          const pos = haulCurve.getPointAt(u);
          tr.position.copy(pos);

          // 2. Tangent & Headlights heading orientation
          const tangent = haulCurve.getTangentAt(u).normalize();
          lookTarget.copy(pos).add(tangent);
          tr.lookAt(lookTarget);

          // 3. Dump bed & soil payload mechanics
          const bed = tr.getObjectByName('bedPivot');
          const soil = tr.getObjectByName('soilInBed');

          // Check distance to loading spot beside excavator
          const distToLoading = pos.distanceTo(loadingSpotPos);
          const isAtSpot = distToLoading < 6.0;

          if (isAtSpot) {
            truckInLoadingZone = true;
          }

          // Phasing along the loop:
          // [0.0 - 0.12]: Loading Spot A (Beside Excavator)
          // [0.12 - 0.46]: Loaded haul trip up ramp to spoil pile
          // [0.46 - 0.58]: Spoil Disposal Spot D (Tilting bed up to 45 deg, soil emptied)
          // [0.58 - 1.0]: Empty return trip down ramp to Pit
          if (u < 0.12) {
            // Loading at pit
            if (bed) bed.rotation.x = 0;
            if (soil) soil.visible = true;
          } else if (u < 0.46) {
            // Hauling loaded
            if (bed) bed.rotation.x = 0;
            if (soil) soil.visible = true;
          } else if (u >= 0.46 && u <= 0.58) {
            // Dumping at spoil area
            const dumpP = (u - 0.46) / 0.12;
            // Tilt bed up around X-axis (up to ~45 degrees)
            const tiltAngle = Math.sin(dumpP * Math.PI) * (Math.PI / 4.0);
            if (bed) bed.rotation.x = -tiltAngle;
            // Soil falls out into spoil pile midway through tilt
            if (soil) {
              soil.visible = dumpP < 0.45;
            }
          } else {
            // Returning empty
            if (bed) bed.rotation.x = 0;
            if (soil) soil.visible = false;
          }
        }
      }

      isTruckLoadingRef.current = truckInLoadingZone;
      setActiveTrucksInSpot(truckInLoadingZone);

      // Animate Excavator Kinematics (Dig, Slew, Dump, or Standby Pause)
      if (excavatorSlewRef.current && boomRef.current && stickRef.current && bucketRef.current) {
        if (isPlaying && truckInLoadingZone) {
          // Advance excavator digging clock
          // One full dig cycle = ~3.2s at 1x speed, scaled by speedMultiplier
          const digCycleSec = Math.max(0.3, 3.2 / speedMult);
          digClockRef.current += delta / digCycleSec;
          const digPhase = digClockRef.current % 1.0;

          // 4-Stage Digging & Loading Kinematics:
          // 0.00 - 0.40: Cut Face Digging (Slewed to pit face, boom dips, bucket curls into soil bank)
          // 0.40 - 0.60: Hoisting & Slewing to Truck Bed
          // 0.60 - 0.80: Discharging Soil into Truck Bed
          // 0.80 - 1.00: Slewing back to Cut Face
          if (digPhase < 0.4) {
            const p = digPhase / 0.4;
            // Slewed toward cut face
            excavatorSlewRef.current.rotation.y = THREE.MathUtils.lerp(-0.3, -1.1, Math.sin(p * Math.PI * 0.5));
            // Boom dips into soil
            boomRef.current.rotation.x = -0.2 - Math.sin(p * Math.PI) * 0.35;
            // Dipper stick pulls through bank
            stickRef.current.rotation.x = 0.3 + Math.sin(p * Math.PI) * 0.4;
            // Bucket curls upward scooping earth
            bucketRef.current.rotation.x = 0.2 + p * 0.9;
          } else if (digPhase < 0.6) {
            const p = (digPhase - 0.4) / 0.2;
            // Slew across toward truck bed at Point A (+1.4 rad)
            excavatorSlewRef.current.rotation.y = THREE.MathUtils.lerp(-1.1, 1.4, p);
            // Boom lifts high to clear truck side boards
            boomRef.current.rotation.x = THREE.MathUtils.lerp(-0.2, 0.2, p);
            stickRef.current.rotation.x = THREE.MathUtils.lerp(0.7, -0.1, p);
            bucketRef.current.rotation.x = 1.1; // Hold soil curled
          } else if (digPhase < 0.8) {
            const p = (digPhase - 0.6) / 0.2;
            // Hold slew above truck bed
            excavatorSlewRef.current.rotation.y = 1.4;
            boomRef.current.rotation.x = 0.2 - Math.sin(p * Math.PI) * 0.15;
            stickRef.current.rotation.x = -0.1 + p * 0.3;
            // Bucket uncurls wide to discharge soil into truck
            bucketRef.current.rotation.x = THREE.MathUtils.lerp(1.1, -0.4, p);
          } else {
            const p = (digPhase - 0.8) / 0.2;
            // Slew back to pit cut face
            excavatorSlewRef.current.rotation.y = THREE.MathUtils.lerp(1.4, -0.3, p);
            boomRef.current.rotation.x = THREE.MathUtils.lerp(0.1, -0.2, p);
            stickRef.current.rotation.x = THREE.MathUtils.lerp(0.2, 0.3, p);
            bucketRef.current.rotation.x = THREE.MathUtils.lerp(-0.4, 0.2, p);
          }

          // Active dust swirling during cut phase
          if (dustParticlesRef.current) {
            dustParticlesRef.current.visible = true;
            dustParticlesRef.current.rotation.y += delta * 1.5;
          }
        } else {
          // Excavator Standby / Idle Pause (Waiting for truck to arrive or simulation paused)
          // Smoothly relax to neutral ready posture
          excavatorSlewRef.current.rotation.y = THREE.MathUtils.lerp(
            excavatorSlewRef.current.rotation.y,
            0.2,
            delta * 4.0
          );
          boomRef.current.rotation.x = THREE.MathUtils.lerp(boomRef.current.rotation.x, -0.15, delta * 4.0);
          stickRef.current.rotation.x = THREE.MathUtils.lerp(stickRef.current.rotation.x, 0.2, delta * 4.0);
          bucketRef.current.rotation.x = THREE.MathUtils.lerp(bucketRef.current.rotation.x, 0.3, delta * 4.0);

          if (dustParticlesRef.current) {
            dustParticlesRef.current.visible = false;
          }
        }
      }

      controls.update();
      renderer.render(scene, camera);
    }

    animate();

    // 15. Resize Observer
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
  }, [cameraPresets.pit, createDumpTruckMesh, syncTruckFleet]);

  // Synchronize 3D truck fleet dynamically when user moves Fleet Count or Truck Capacity slider
  useEffect(() => {
    syncTruckFleet(config.machine.truckCount, config.machine.truckCapacityM3);
  }, [config.machine.truckCount, config.machine.truckCapacityM3, syncTruckFleet]);

  // Reset truck & excavator positions on simulation reset
  useEffect(() => {
    if (simState.elapsedSimSeconds === 0 && !simState.isPlaying) {
      haulClockRef.current = 0;
      digClockRef.current = 0;
      isTruckLoadingRef.current = false;
      setActiveTrucksInSpot(false);
      if (trucksGroupRef.current) {
        syncTruckFleet(config.machine.truckCount, config.machine.truckCapacityM3);
      }
    }
  }, [simState.elapsedSimSeconds, simState.isPlaying, config.machine.truckCount, config.machine.truckCapacityM3, syncTruckFleet]);

  // Update dynamic soil block height as remaining volume decreases (Progressive Excavation)
  useEffect(() => {
    if (!soilBlockMeshRef.current || !spoilPileMeshRef.current) return;

    // Remaining volume ratio: 1.0 down to 0.01
    const remainRatio = Math.max(0.02, simState.remainingVolumeM3 / Math.max(1, config.scope.volumeM3));
    soilBlockMeshRef.current.scale.y = remainRatio;

    // Spoil pile grows as volume is excavated
    const excavatedRatio = 1.0 - remainRatio;
    const spoilScale = 0.3 + excavatedRatio * 1.8;
    spoilPileMeshRef.current.scale.set(spoilScale, spoilScale * 0.9, spoilScale);
  }, [simState.remainingVolumeM3, config.scope.volumeM3]);

  // Color soil block according to selected material
  useEffect(() => {
    if (!soilBlockMeshRef.current) return;
    const mat = soilBlockMeshRef.current.material as THREE.MeshStandardMaterial;

    if (config.scope.materialType === 'tanah_keras') {
      mat.color.setHex(0x52525b); // Gray rock
    } else if (config.scope.materialType === 'lempung_basah') {
      mat.color.setHex(0x713f12); // Deep sticky wet clay
    } else {
      mat.color.setHex(0x92400e); // Common earth amber brown
    }
  }, [config.scope.materialType]);

  // Format IDR Currency
  const formatIDR = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(val);
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
                Live 4D Work Execution
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
              <span className="text-slate-400">Excavation Progress:</span>
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
              <span>Excavated: {Math.round(simState.excavatedVolumeM3).toLocaleString()} m³</span>
              <span>Left: {Math.round(simState.remainingVolumeM3).toLocaleString()} m³</span>
            </div>
          </div>

          {/* 3 Core Output Metrics */}
          <div className="grid grid-cols-3 gap-2 text-center pt-1">
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2">
              <span className="text-[10px] text-slate-400 block">Output Rate</span>
              <span className="font-mono font-bold text-white text-xs sm:text-sm">
                {metrics.dailyOutputM3}
              </span>
              <span className="text-[9px] text-slate-500 block">m³/day</span>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2">
              <span className="text-[10px] text-slate-400 block">Elapsed</span>
              <span className="font-mono font-bold text-sky-400 text-xs sm:text-sm">
                {(simState.elapsedSimSeconds / 3600).toFixed(1)}
              </span>
              <span className="text-[9px] text-slate-500 block">Hours</span>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2">
              <span className="text-[10px] text-slate-400 block">Truck Rits</span>
              <span className="font-mono font-bold text-emerald-400 text-xs sm:text-sm">
                {simState.truckRitsCompleted}
              </span>
              <span className="text-[9px] text-slate-500 block">trips</span>
            </div>
          </div>

          {/* Accrued Cost Readout */}
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-2 flex items-center justify-between text-xs">
            <span className="text-slate-400">Total Cost Accrued:</span>
            <span className="font-mono font-bold text-amber-300">
              {formatIDR(simState.totalCostAccruedIdr)}
            </span>
          </div>

          {/* Fleet Status Indicator Pill */}
          <div className="flex items-center justify-between text-[11px] bg-slate-900/80 px-2.5 py-1.5 rounded-lg border border-slate-800">
            <div className="flex items-center gap-1.5 text-slate-300">
              <Truck className="w-3.5 h-3.5 text-sky-400" />
              <span>Fleet: {config.machine.truckCount} Active Units</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${activeTrucksInSpot ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'}`} />
              <span className={`font-mono text-[10px] ${activeTrucksInSpot ? 'text-emerald-400 font-bold' : 'text-amber-400'}`}>
                {activeTrucksInSpot ? 'EXCAVATOR LOADING' : 'EXCAVATOR STANDBY'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* OrbitControls Navigation Helper Hint (Top Right) */}
      <div className="absolute top-4 right-4 z-10 hidden lg:flex items-center gap-2 bg-[#0f172a]/80 backdrop-blur-md border border-slate-800 text-[11px] text-slate-400 px-3 py-1.5 rounded-xl shadow-lg">
        <Compass className="w-3.5 h-3.5 text-sky-400" />
        <span>Left-click: Orbit • Right-click: Pan • Scroll: Zoom</span>
      </div>

      {/* Simulation Playback & Speed Controls (Bottom Center) */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex flex-wrap items-center gap-2 bg-[#0f172a]/95 backdrop-blur-xl border border-slate-800 px-4 py-2 rounded-2xl shadow-2xl">
        {/* Play/Pause Button */}
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

        {/* Reset Button */}
        <button
          onClick={onReset}
          className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition"
          title="Reset Simulation"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        {/* Speed Pills */}
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

        {/* Camera Preset Quick Buttons */}
        <div className="hidden sm:flex items-center gap-1 pl-2 border-l border-slate-800">
          <Camera className="w-3.5 h-3.5 text-slate-500 mr-1" />
          {[
            { key: 'pit', label: 'Pit' },
            { key: 'excavator', label: 'Excavator' },
            { key: 'haul', label: 'Haul' },
            { key: 'spoil', label: 'Spoil' },
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
