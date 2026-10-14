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
} from 'lucide-react';

interface WorkCanvas3DProps {
  config: SimulatorConfig;
  metrics: ProductivityMetrics;
  simState: LiveSimulationState;
  onTogglePlay: () => void;
  onReset: () => void;
  onChangeSpeed: (speed: number) => void;
}

export const WorkCanvas3D: React.FC<WorkCanvas3DProps> = ({
  config,
  metrics,
  simState,
  onTogglePlay,
  onReset,
  onChangeSpeed,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Mesh refs for progressive 4D excavation & heavy equipment animation
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

  // Camera presets
  const cameraPresets: Record<string, { pos: [number, number, number]; target: [number, number, number] }> = {
    pit: { pos: [-36, 24, 28], target: [0, 2, 0] },
    excavator: { pos: [-14, 10, 12], target: [-4, 3, 0] },
    haul: { pos: [-10, 20, 65], target: [25, 2, 50] },
    spoil: { pos: [70, 16, 50], target: [60, 4, 35] },
    topdown: { pos: [0, 85, 0], target: [0, 0, 0] },
  };

  const flyToPreset = useCallback((presetKey: string) => {
    const p = cameraPresets[presetKey];
    if (!p || !cameraRef.current || !controlsRef.current) return;

    setActivePreset(presetKey);
    const startPos = cameraRef.current.position.clone();
    const endPos = new THREE.Vector3(...p.pos);
    const startTarget = controlsRef.current.target.clone();
    const endTarget = new THREE.Vector3(...p.target);

    const duration = 1000;
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

  // Initialize Three.js Scene
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    // 1. Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0f1d);
    scene.fog = new THREE.FogExp2(0x0a0f1d, 0.008);
    sceneRef.current = scene;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 1, 1000);
    const initCam = cameraPresets.pit;
    camera.position.set(...initCam.pos);
    cameraRef.current = camera;

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(...initCam.target);
    controls.maxPolarAngle = Math.PI / 2 - 0.02; // Don't go below ground
    controls.minDistance = 5;
    controls.maxDistance = 250;
    controlsRef.current = controls;

    // 5. Lighting
    const ambientLight = new THREE.AmbientLight(0x94a3b8, 1.2);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xfffbeb, 2.2);
    sunLight.position.set(-60, 80, -40);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 300;
    sunLight.shadow.camera.left = -80;
    sunLight.shadow.camera.right = 80;
    sunLight.shadow.camera.top = 80;
    sunLight.shadow.camera.bottom = -80;
    sunLight.shadow.bias = -0.0005;
    scene.add(sunLight);

    const fillLight = new THREE.DirectionalLight(0x38bdf8, 0.6);
    fillLight.position.set(40, 30, 50);
    scene.add(fillLight);

    // 6. Base Ground Plane (Jobsite terrain)
    const groundGeo = new THREE.PlaneGeometry(350, 350, 40, 40);
    groundGeo.rotateX(-Math.PI / 2);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.9,
      metalness: 0.1,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.receiveShadow = true;
    scene.add(ground);

    // Ground Grid overlay for engineering coordinate feel
    const gridHelper = new THREE.GridHelper(300, 60, 0x334155, 0x1e293b);
    gridHelper.position.y = 0.02;
    scene.add(gridHelper);

    // 7. Excavation Pit Outer Berm & Cut Face
    const pitGroup = new THREE.Group();
    pitGroup.name = 'pitGroup';

    // Outer Berm
    const bermGeo = new THREE.RingGeometry(18, 32, 32);
    bermGeo.rotateX(-Math.PI / 2);
    const bermMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.95 });
    const berm = new THREE.Mesh(bermGeo, bermMat);
    berm.position.set(0, 0.05, 0);
    berm.receiveShadow = true;
    pitGroup.add(berm);

    // Pit Hole Floor
    const pitFloorGeo = new THREE.BoxGeometry(28, 0.5, 24);
    const pitFloorMat = new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.9 });
    const pitFloor = new THREE.Mesh(pitFloorGeo, pitFloorMat);
    pitFloor.position.set(0, -5, 0);
    pitFloor.receiveShadow = true;
    pitGroup.add(pitFloor);

    // Pit Side Slopes (Terraced Benches)
    const benchMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.95 });
    for (let side = -1; side <= 1; side += 2) {
      // East-West slopes
      const slopeGeo = new THREE.BoxGeometry(28, 5, 2);
      const slope = new THREE.Mesh(slopeGeo, benchMat);
      slope.position.set(0, -2.5, side * 12);
      slope.rotation.x = side * (Math.PI / 6);
      slope.receiveShadow = true;
      pitGroup.add(slope);
    }
    for (let side = -1; side <= 1; side += 2) {
      // North-South slopes
      const slopeGeo = new THREE.BoxGeometry(2, 5, 24);
      const slope = new THREE.Mesh(slopeGeo, benchMat);
      slope.position.set(side * 14, -2.5, 0);
      slope.rotation.z = -side * (Math.PI / 6);
      slope.receiveShadow = true;
      pitGroup.add(slope);
    }

    // 8. Dynamic Soil Block (Excavated in real-time)
    // Sized to represent the in-situ bank volume
    const soilBlockGeo = new THREE.BoxGeometry(20, 6, 16);
    // Center the pivot at bottom
    soilBlockGeo.translate(0, 3, 0);

    const soilMat = new THREE.MeshStandardMaterial({
      color: 0x92400e, // Rich earth amber-brown
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

    // 9. Haul Road Surface (Pit to Spoil Area)
    const roadGroup = new THREE.Group();
    // Curved/Angled road mesh from (10, 0, 0) to (60, 0, 40)
    const roadCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(10, 0.08, 0),
      new THREE.Vector3(25, 0.08, 12),
      new THREE.Vector3(42, 0.08, 28),
      new THREE.Vector3(60, 0.08, 40),
    ]);
    const roadGeo = new THREE.TubeGeometry(roadCurve, 24, 4.5, 4, false);
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.85 });
    const road = new THREE.Mesh(roadGeo, roadMat);
    road.scale.set(1, 0.05, 1);
    road.receiveShadow = true;
    roadGroup.add(road);

    // Safety Guide Cones along haul road
    const coneGeo = new THREE.ConeGeometry(0.35, 0.8, 8);
    const coneMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.4 });
    for (let c = 0; c < 12; c++) {
      const pt = roadCurve.getPoint(c / 11);
      const coneLeft = new THREE.Mesh(coneGeo, coneMat);
      coneLeft.position.set(pt.x - 2.8, 0.4, pt.z);
      roadGroup.add(coneLeft);

      const coneRight = new THREE.Mesh(coneGeo, coneMat);
      coneRight.position.set(pt.x + 2.8, 0.4, pt.z);
      roadGroup.add(coneRight);
    }
    scene.add(roadGroup);

    // 10. Spoil Disposal Pile (Grows as trucks dump)
    const spoilGeo = new THREE.ConeGeometry(12, 8, 16);
    spoilGeo.translate(0, 4, 0);
    const spoilMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.95 });
    const spoilPile = new THREE.Mesh(spoilGeo, spoilMat);
    spoilPile.position.set(65, 0, 45);
    spoilPile.scale.set(0.3, 0.2, 0.3); // Initial small pile
    spoilPile.castShadow = true;
    spoilPile.receiveShadow = true;
    spoilPileMeshRef.current = spoilPile;
    scene.add(spoilPile);

    // 11. Heavy Excavator 3D Model
    const excavatorGroup = new THREE.Group();
    excavatorGroup.position.set(-6, -5, 0); // Positioned inside pit
    excavatorGroupRef.current = excavatorGroup;

    // Undercarriage & Tracks
    const trackMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.7, metalness: 0.6 });
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.4, metalness: 0.3 }); // Komatsu yellow
    const blackMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.6, metalness: 0.5 });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.3, metalness: 0.8 });

    // Left and Right Tracks
    for (const side of [-1.8, 1.8]) {
      const track = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.3, 6.2), trackMat);
      track.position.set(side, 0.7, 0);
      track.castShadow = true;
      excavatorGroup.add(track);

      // Sprockets
      const sp1 = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 1.25, 12), blackMat);
      sp1.rotation.z = Math.PI / 2;
      sp1.position.set(side, 0.7, 2.7);
      excavatorGroup.add(sp1);

      const sp2 = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 1.25, 12), blackMat);
      sp2.rotation.z = Math.PI / 2;
      sp2.position.set(side, 0.7, -2.7);
      excavatorGroup.add(sp2);
    }

    // Carbody Center Hub
    const carbody = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.8, 3.2), blackMat);
    carbody.position.set(0, 1.1, 0);
    excavatorGroup.add(carbody);

    // Slewing Upper Carriage
    const slewGroup = new THREE.Group();
    slewGroup.position.set(0, 1.6, 0);
    excavatorSlewRef.current = slewGroup;

    // Main Engine House / Counterweight
    const house = new THREE.Mesh(new THREE.BoxGeometry(3.6, 2.0, 4.2), bodyMat);
    house.position.set(0, 1.1, -0.6);
    house.castShadow = true;
    slewGroup.add(house);

    // Rear Counterweight with Brand Stripe
    const cw = new THREE.Mesh(new THREE.BoxGeometry(3.6, 1.8, 1.2), blackMat);
    cw.position.set(0, 1.0, -2.4);
    cw.castShadow = true;
    slewGroup.add(cw);

    // Operator Cab (Offset to left side)
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

    // Main Boom (Gooseneck)
    const boomMesh = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.1, 6.5), bodyMat);
    boomMesh.position.set(0, 2.4, 2.6);
    boomMesh.rotation.x = -Math.PI / 4.2;
    boomMesh.castShadow = true;
    boomGroup.add(boomMesh);

    // Hydraulic Boom Cylinders
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 4.2, 8), metalMat);
    cyl.position.set(0, 1.2, 1.4);
    cyl.rotation.x = -Math.PI / 4.5;
    boomGroup.add(cyl);

    // Articulated Dipper Stick / Arm Pivot
    const stickGroup = new THREE.Group();
    stickGroup.position.set(0, 4.8, 5.0);
    stickRef.current = stickGroup;

    const stickMesh = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 4.5), bodyMat);
    stickMesh.position.set(0, -1.4, 1.6);
    stickMesh.rotation.x = Math.PI / 3.2;
    stickMesh.castShadow = true;
    stickGroup.add(stickMesh);

    // Articulated Bucket Pivot
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

    // Helper to create a dump truck mesh
    function createDumpTruckMesh(id: number) {
      const t = new THREE.Group();
      t.name = `truck_${id}`;

      // Chassis
      const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.9, 7.5), blackMat);
      chassis.position.y = 0.8;
      chassis.castShadow = true;
      t.add(chassis);

      // Cab
      const tCab = new THREE.Mesh(
        new THREE.BoxGeometry(2.5, 2.0, 2.2),
        new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.3 })
      );
      tCab.position.set(0, 1.8, 2.4);
      tCab.castShadow = true;
      t.add(tCab);

      // Tilting Dump Bed
      const bedPivot = new THREE.Group();
      bedPivot.name = 'bedPivot';
      bedPivot.position.set(0, 1.4, -3.2);

      const dumpBed = new THREE.Mesh(
        new THREE.BoxGeometry(2.7, 1.6, 4.8),
        new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.5 })
      );
      dumpBed.position.set(0, 0.8, 2.4);
      dumpBed.castShadow = true;
      bedPivot.add(dumpBed);

      // Loose soil inside bed
      const soilInBed = new THREE.Mesh(
        new THREE.BoxGeometry(2.4, 0.8, 4.4),
        new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.9 })
      );
      soilInBed.name = 'soilInBed';
      soilInBed.position.set(0, 1.4, 2.4);
      soilInBed.visible = false;
      bedPivot.add(soilInBed);

      t.add(bedPivot);

      // Heavy 6 Wheels
      for (const side of [-1.4, 1.4]) {
        for (const zPos of [2.2, -1.0, -2.6]) {
          const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.5, 12), blackMat);
          wheel.rotation.z = Math.PI / 2;
          wheel.position.set(side, 0.55, zPos);
          t.add(wheel);
        }
      }

      return t;
    }

    // Build visible dump trucks (up to 4 representative trucks in the loop)
    const truckCount = Math.min(6, Math.max(2, config.machine.truckCount));
    for (let i = 0; i < truckCount; i++) {
      const truck = createDumpTruckMesh(i);
      trucksGroup.add(truck);
    }

    // 13. Excavation Dust Particle System
    const dustCount = 180;
    const dustGeo = new THREE.BufferGeometry();
    const dustPos = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount; i++) {
      dustPos[i * 3] = (Math.random() - 0.5) * 6;
      dustPos[i * 3 + 1] = Math.random() * 4;
      dustPos[i * 3 + 2] = (Math.random() - 0.5) * 6;
    }
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    const dustMat = new THREE.PointsMaterial({
      color: 0xd97706,
      size: 0.35,
      transparent: true,
      opacity: 0.45,
    });
    const dust = new THREE.Points(dustGeo, dustMat);
    dust.position.set(-6, -4, 0);
    scene.add(dust);
    dustParticlesRef.current = dust;

    // 14. Animation & Physics Loop
    let clock = new THREE.Clock();

    function animate() {
      animFrameRef.current = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const time = clock.getElapsedTime();

      // Animate digging excavator if simulation is playing
      if (simState.isPlaying && excavatorSlewRef.current && boomRef.current && stickRef.current && bucketRef.current) {
        // Multiplier speed factor
        const cycleSpeed = 0.5 * simState.speedMultiplier;
        const phase = (time * cycleSpeed) % (Math.PI * 2);

        // Digging cycle stages:
        // 0 to PI: Slew to pit face, dig, curl bucket
        // PI to 2PI: Slew to truck, uncurl bucket, dump
        if (phase < Math.PI) {
          // Digging Phase
          const t1 = phase / Math.PI;
          excavatorSlewRef.current.rotation.y = THREE.MathUtils.lerp(0.8, -0.4, t1);
          boomRef.current.rotation.x = -0.3 + Math.sin(t1 * Math.PI) * 0.35;
          stickRef.current.rotation.x = -0.2 + Math.sin(t1 * Math.PI) * 0.5;
          bucketRef.current.rotation.x = 0.1 + Math.sin(t1 * Math.PI) * 0.9;
        } else {
          // Dumping into truck Phase
          const t2 = (phase - Math.PI) / Math.PI;
          excavatorSlewRef.current.rotation.y = THREE.MathUtils.lerp(-0.4, 0.8, t2);
          boomRef.current.rotation.x = 0.1 - Math.sin(t2 * Math.PI) * 0.2;
          stickRef.current.rotation.x = 0.4 - Math.sin(t2 * Math.PI) * 0.3;
          bucketRef.current.rotation.x = 0.9 - Math.sin(t2 * Math.PI) * 0.8;
        }
      }

      // Animate Dump Trucks along haul road loop
      if (trucksGroupRef.current && simState.isPlaying) {
        const truckCount = trucksGroupRef.current.children.length;
        trucksGroupRef.current.children.forEach((tr, idx) => {
          // Staggered progress along route
          const truckOffset = idx / truckCount;
          const cycleRate = (0.04 * simState.speedMultiplier) / (config.scope.haulDistanceKm * 0.5);
          const tProgress = (time * cycleRate + truckOffset) % 1.0;

          // Positions:
          // 0.0 - 0.25: Loading in pit at (4, -5, 0)
          // 0.25 - 0.55: Hauling up ramp and along road to (60, 0, 40)
          // 0.55 - 0.70: Dumping bed at spoil pile
          // 0.70 - 1.0: Returning empty to pit
          let pos = new THREE.Vector3();
          let rotY = 0;
          const bed = tr.getObjectByName('bedPivot');
          const soilInBed = tr.getObjectByName('soilInBed');

          if (tProgress < 0.25) {
            // Loading at Excavator Pit
            pos.set(2 + idx * 3, -5, 0);
            rotY = Math.PI / 2;
            if (bed) bed.rotation.x = 0;
            if (soilInBed) soilInBed.visible = true;
          } else if (tProgress < 0.55) {
            // Hauling to spoil pile
            const p = (tProgress - 0.25) / 0.3;
            pos.set(
              THREE.MathUtils.lerp(10, 60, p),
              THREE.MathUtils.lerp(-5, 0, Math.min(1, p * 2.5)),
              THREE.MathUtils.lerp(0, 40, p)
            );
            rotY = Math.PI / 3.5;
            if (bed) bed.rotation.x = 0;
            if (soilInBed) soilInBed.visible = true;
          } else if (tProgress < 0.7) {
            // Dumping at spoil pile
            const p = (tProgress - 0.55) / 0.15;
            pos.set(60, 0, 40);
            rotY = Math.PI / 3.5;
            // Tilting bed up to 45 deg
            if (bed) bed.rotation.x = Math.sin(p * Math.PI) * (Math.PI / 4.2);
            if (soilInBed) soilInBed.visible = p < 0.5;
          } else {
            // Returning empty
            const p = (tProgress - 0.7) / 0.3;
            pos.set(
              THREE.MathUtils.lerp(60, 10, p),
              THREE.MathUtils.lerp(0, -5, Math.max(0, (p - 0.6) * 2.5)),
              THREE.MathUtils.lerp(40, 0, p)
            );
            rotY = -Math.PI / 1.3;
            if (bed) bed.rotation.x = 0;
            if (soilInBed) soilInBed.visible = false;
          }

          tr.position.copy(pos);
          tr.rotation.y = rotY;
        });
      }

      // Swirl dust particles
      if (dustParticlesRef.current && simState.isPlaying) {
        dustParticlesRef.current.rotation.y += delta * 0.4;
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
  }, []);

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
      mat.color.setHex(0x92400e); // Common earth brown
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
