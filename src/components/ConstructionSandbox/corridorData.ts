import {
  StructuralElement,
  CraneConfig,
  CraneCollisionPair,
  TransitMixer,
  Milestone,
  SCurvePoint,
} from './types';

// Corridor length: 2,500m across 25 piers (P01 to P25)
export const CORRIDOR_SPANS_COUNT = 25;
export const SPAN_SPACING_METERS = 100;
export const CORRIDOR_START_Z = -1200; // Z from -1200 to +1200

export const RIVER_START_Z = -250;
export const RIVER_END_Z = 250;

export const MILESTONES: Milestone[] = [
  {
    week: 1,
    title: 'Site Mobilization & Earthwork',
    phase: 'earthwork',
    description: 'Land clearing, haul road stabilization, geotextile subgrade prep and test pile driving.',
  },
  {
    week: 22,
    title: 'Bored Piles & Deep River Foundations',
    phase: 'earthwork',
    description: 'Completion of 196 bored piles (Ø1.5m to Ø2.0m) and tremie underwater river pour.',
  },
  {
    week: 42,
    title: 'Pier Column & Hammerhead Substructure',
    phase: 'substructure',
    description: 'Monolithic column casting, climbing formwork and prestressed pier head caps completed.',
  },
  {
    week: 68,
    title: 'River Span Box Girder & Launching Gantry',
    phase: 'girder',
    description: 'Launching gantry mobilization, precast PCI girder placement across 24 spans.',
  },
  {
    week: 88,
    title: 'Composite Deck Slab & Post-Tensioning',
    phase: 'paving',
    description: 'Cast-in-place reinforced deck concrete pouring, transverse PT stressing and barrier walls.',
  },
  {
    week: 104,
    title: 'Asphalt Paving & Final Handover',
    phase: 'paving',
    description: 'AC-WC asphalt paving, road furniture, static & dynamic bridge load testing complete.',
  },
];

// Generate 104-week S-Curve (Logistic Sigmoid Model)
export const GENERATED_S_CURVE: SCurvePoint[] = Array.from({ length: 104 }, (_, i) => {
  const week = i + 1;
  // Logistic function normalized from week 1 (0.8%) to week 104 (100%)
  const k = 0.065;
  const x0 = 54;
  const rawSigmoid = 1 / (1 + Math.exp(-k * (week - x0)));
  const minSigmoid = 1 / (1 + Math.exp(-k * (1 - x0)));
  const maxSigmoid = 1 / (1 + Math.exp(-k * (104 - x0)));
  const normalized = ((rawSigmoid - minSigmoid) / (maxSigmoid - minSigmoid)) * 100;
  const plannedPercent = Number(normalized.toFixed(1));

  // Actual progress simulates realistic slight front-end variance
  let variance = 0;
  if (week <= 25) variance = -0.4 * Math.sin((week / 25) * Math.PI);
  else if (week <= 60) variance = 1.2 * Math.sin(((week - 25) / 35) * Math.PI);
  else if (week <= 85) variance = -0.8 * Math.sin(((week - 60) / 25) * Math.PI);
  else variance = 0.5 * Math.sin(((week - 85) / 19) * Math.PI);

  const actualPercent = Number(Math.min(100, Math.max(0, plannedPercent + variance)).toFixed(1));

  return { week, plannedPercent, actualPercent };
});

// Helper to determine pier height based on terrain (higher over river valley)
export function getPierHeight(z: number): number {
  if (z >= RIVER_START_Z && z <= RIVER_END_Z) {
    return 16.0; // 16m clearance over Cisadane River
  }
  // Smooth slope to land
  const distToRiver = Math.min(Math.abs(z - RIVER_START_Z), Math.abs(z - RIVER_END_Z));
  if (distToRiver < 200) {
    return 14.0;
  }
  return 10.5; // Standard viaduct elevation
}

// Generate structural components
export function generateCorridorElements(): StructuralElement[] {
  const elements: StructuralElement[] = [];

  for (let span = 0; span < CORRIDOR_SPANS_COUNT; span++) {
    const pierNumber = span + 1;
    const pierId = `P-${pierNumber < 10 ? '0' + pierNumber : pierNumber}`;
    const z = CORRIDOR_START_Z + span * SPAN_SPACING_METERS;
    const isRiver = z >= RIVER_START_Z && z <= RIVER_END_Z;
    const pierH = getPierHeight(z);

    // Schedule Phasing Calculation per span
    // Piling starts in wave: earlier spans start earlier
    const pileStart = 2 + Math.floor(span * 0.9);
    const pileEnd = pileStart + 6;

    const columnStart = pileEnd + 2;
    const columnEnd = columnStart + 8;

    const capStart = columnEnd + 1;
    const capEnd = capStart + 6;

    const girderStart = Math.max(48, capEnd + 3);
    const girderEnd = girderStart + 8;

    const deckStart = Math.max(76, girderEnd + 3);
    const deckEnd = deckStart + 7;

    const asphaltStart = Math.max(92, deckEnd + 2);
    const asphaltEnd = Math.min(104, asphaltStart + 5);

    // 1. Bore Piles & Pile Cap (Foundation)
    elements.push({
      id: `${pierId}-FND`,
      name: `${pierId} Bored Pile Group & Footing Cap`,
      spanIndex: span,
      type: 'pile',
      pierId,
      startWeek: pileStart,
      endWeek: pileEnd,
      position: [0, 0, z],
      dimensions: [8.5, 2.5, 8.5],
      concreteSpec: {
        grade: isRiver ? "f'c 35 MPa (K-400 Underwater)" : "f'c 30 MPa (K-350)",
        slump: '18 ± 2 cm (Tremie)',
        maxAggregate: '20 mm',
        wcRatio: isRiver ? 0.40 : 0.44,
        cementType: isRiver ? 'Type V (Sulfate Resistant)' : 'Type I OPC',
      },
      volumeM3: isRiver ? 185.0 : 124.0,
      steelKg: isRiver ? 24500 : 16800,
      formworkM2: 85.0,
      rfi: {
        number: `RFI-FND-${pierId}-001`,
        date: `Week ${pileEnd}, 2025`,
        status: 'APPROVED',
        leadQc: 'Ir. Hendra Wijaya, ST (QC Lead)',
        consultant: 'Ir. Bambang S., IPM (Supervising Engineer)',
        checkItems: [
          { id: 'c1', label: 'Bore hole sonic logging & verticality test (<1% drift)', checked: true },
          { id: 'c2', label: 'Rebar cage tying, spacer blocks (75mm cover) & lap splices', checked: true },
          { id: 'c3', label: 'Tremie pipe airtightness & underwater concrete head > 2.0m', checked: true },
          { id: 'c4', label: 'Slump test on-site batch delivery verified (18.5 cm)', checked: true },
        ],
      },
    });

    // 2. Pier Column (Substructure)
    elements.push({
      id: `${pierId}-COL`,
      name: `${pierId} Monolithic Concrete Column`,
      spanIndex: span,
      type: 'column',
      pierId,
      startWeek: columnStart,
      endWeek: columnEnd,
      position: [0, pierH / 2, z],
      dimensions: [isRiver ? 3.4 : 2.6, pierH, isRiver ? 3.4 : 2.6],
      concreteSpec: {
        grade: "f'c 35 MPa (K-400)",
        slump: '12 ± 2 cm',
        maxAggregate: '20 mm',
        wcRatio: 0.42,
        cementType: isRiver ? 'Type V (Sulfate Resistant)' : 'Type I OPC',
      },
      volumeM3: isRiver ? 92.5 : 68.0,
      steelKg: isRiver ? 13800 : 9600,
      formworkM2: isRiver ? 142.0 : 98.0,
      rfi: {
        number: `RFI-SUB-${pierId}-014`,
        date: `Week ${columnEnd}, 2025`,
        status: 'APPROVED',
        leadQc: 'Dwi Prasetyo, ST (Site QA/QC)',
        consultant: 'Dr. Ir. Taufik Hidayat (Chief Resident Engineer)',
        checkItems: [
          { id: 'c1', label: 'Column vertical plumbness checked with total station (±5mm)', checked: true },
          { id: 'c2', label: 'Main reinforcement D32 rebar mechanical coupler torque verified', checked: true },
          { id: 'c3', label: 'Formwork tie-rods locked and release agent uniformly sprayed', checked: true },
          { id: 'c4', label: 'Pouring rate limited to 2.5 m/hour to prevent lateral blow-out', checked: true },
        ],
      },
    });

    // 3. Pier Head / Hammerhead Cap
    elements.push({
      id: `${pierId}-CAP`,
      name: `${pierId} Prestressed Pier Head (Hammerhead)`,
      spanIndex: span,
      type: 'cap',
      pierId,
      startWeek: capStart,
      endWeek: capEnd,
      position: [0, pierH + 1.2, z],
      dimensions: [13.0, 2.4, 4.2],
      concreteSpec: {
        grade: "f'c 40 MPa (K-450 High Early)",
        slump: '12 ± 2 cm',
        maxAggregate: '20 mm',
        wcRatio: 0.38,
        cementType: 'Type I OPC + Silica Fume',
      },
      volumeM3: 74.0,
      steelKg: 12200,
      formworkM2: 110.0,
      rfi: {
        number: `RFI-CAP-${pierId}-022`,
        date: `Week ${capEnd}, 2025`,
        status: 'APPROVED',
        leadQc: 'Ir. Ahmad Zarkasih, ST',
        consultant: 'Ir. Bambang S., IPM',
        checkItems: [
          { id: 'c1', label: 'Elastomeric bearing pads leveling and seismic stopper placement', checked: true },
          { id: 'c2', label: 'Post-tensioning duct alignment, vents & burst rebar check', checked: true },
          { id: 'c3', label: 'Top surface elevation tolerance checked to ±3mm', checked: true },
          { id: 'c4', label: 'Curing compound & burlap geotextile soak protocol ready', checked: true },
        ],
      },
    });

    // 4. Precast Girders (Superstructure) - Between span i and i+1
    if (span < CORRIDOR_SPANS_COUNT - 1) {
      const nextPierNumber = span + 2;
      const nextPierId = `P-${nextPierNumber < 10 ? '0' + nextPierNumber : nextPierNumber}`;
      const midZ = z + SPAN_SPACING_METERS / 2;
      const avgH = (pierH + getPierHeight(z + SPAN_SPACING_METERS)) / 2;

      elements.push({
        id: `GIR-${pierId}-${nextPierId}`,
        name: `PCI Girder Span ${pierId} to ${nextPierId} (5 Lines)`,
        spanIndex: span,
        type: 'girder',
        pierId,
        startWeek: girderStart,
        endWeek: girderEnd,
        position: [0, avgH + 2.5, midZ],
        dimensions: [12.0, 2.2, SPAN_SPACING_METERS - 4],
        concreteSpec: {
          grade: "f'c 50 MPa (K-600 Precast Prestressed)",
          slump: '10 ± 2 cm',
          maxAggregate: '19 mm',
          wcRatio: 0.34,
          cementType: 'Type I High Early Strength',
        },
        volumeM3: isRiver ? 138.0 : 105.0,
        steelKg: isRiver ? 26000 : 19400,
        formworkM2: 240.0,
        rfi: {
          number: `RFI-GIR-${pierId}-${nextPierId}-031`,
          date: `Week ${girderEnd}, 2026`,
          status: 'APPROVED',
          leadQc: 'Rian Syahputra, ST (Precast Engineer)',
          consultant: 'Ir. Bambang S., IPM',
          checkItems: [
            { id: 'c1', label: 'Girder camber measurement meets design (+42mm ± 5mm)', checked: true },
            { id: 'c2', label: 'Tandem crane lift lifting lug certification & rigging plan', checked: true },
            { id: 'c3', label: 'Seated precisely on elastomeric bearings with shear keys', checked: true },
            { id: 'c4', label: 'Diaphragm cross-beam reinforcement tying and formwork ready', checked: true },
          ],
        },
      });

      // 5. Deck Slab (Between span i and i+1)
      elements.push({
        id: `DECK-${pierId}-${nextPierId}`,
        name: `Reinforced Concrete Deck Slab ${pierId}-${nextPierId}`,
        spanIndex: span,
        type: 'deck',
        pierId,
        startWeek: deckStart,
        endWeek: deckEnd,
        position: [0, avgH + 3.8, midZ],
        dimensions: [14.0, 0.4, SPAN_SPACING_METERS],
        concreteSpec: {
          grade: "f'c 35 MPa (K-400 Cast-in-Place)",
          slump: '12 ± 2 cm',
          maxAggregate: '20 mm',
          wcRatio: 0.40,
          cementType: 'Type I OPC',
        },
        volumeM3: 88.0,
        steelKg: 13200,
        formworkM2: 160.0,
        rfi: {
          number: `RFI-DCK-${pierId}-${nextPierId}-045`,
          date: `Week ${deckEnd}, 2026`,
          status: 'APPROVED',
          leadQc: 'Ir. Ahmad Zarkasih, ST',
          consultant: 'Dr. Ir. Taufik Hidayat',
          checkItems: [
            { id: 'c1', label: 'Deck rebar top & bottom mat spacing 150mm D16 inspected', checked: true },
            { id: 'c2', label: 'Stay-in-place precast panel joint sealant & water-stop check', checked: true },
            { id: 'c3', label: 'Continuous screed leveler rails calibrated for cross-slope 2.0%', checked: true },
            { id: 'c4', label: 'Deck finishing broom texture depth > 1.5mm confirmed', checked: true },
          ],
        },
      });

      // 6. Asphalt Paving & Wearing Course
      elements.push({
        id: `ASP-${pierId}-${nextPierId}`,
        name: `Asphalt Wearing Course (AC-WC 5cm) ${pierId}-${nextPierId}`,
        spanIndex: span,
        type: 'asphalt',
        pierId,
        startWeek: asphaltStart,
        endWeek: asphaltEnd,
        position: [0, avgH + 4.05, midZ],
        dimensions: [13.5, 0.1, SPAN_SPACING_METERS],
        concreteSpec: {
          grade: 'AC-WC (Asphalt Concrete Wearing Course 5cm)',
          slump: 'Marshall Stability > 1000 kg',
          maxAggregate: '19 mm Superpave',
          wcRatio: 0,
          cementType: 'Penetration Grade 60/70 Bitumen (5.8% AC)',
        },
        volumeM3: 42.0,
        steelKg: 0,
        formworkM2: 0,
        rfi: {
          number: `RFI-ASP-${pierId}-${nextPierId}-052`,
          date: `Week ${asphaltEnd}, 2026`,
          status: 'APPROVED',
          leadQc: 'Budi Santoso, ST (Paving Lead)',
          consultant: 'Ir. Bambang S., IPM',
          checkItems: [
            { id: 'c1', label: 'Tack coat application rate 0.25 L/m2 uniformly cured', checked: true },
            { id: 'c2', label: 'Mix laydown temperature > 135°C at asphalt finisher paver', checked: true },
            { id: 'c3', label: 'Tandem roller breakdown rolling & pneumatic tired roller pass', checked: true },
            { id: 'c4', label: 'Density core drill test > 98% of laboratory Marshall density', checked: true },
          ],
        },
      });
    }
  }

  return elements;
}

// Heavy Cranes on site with 360° sweep radiuses
export const SITE_CRANES: CraneConfig[] = [
  {
    id: 'CR-01',
    name: 'South Approach Heavy Crawler',
    model: 'Kobelco CKE2500 (250 Ton)',
    capacityTon: 250,
    position: [-28, 0, -650],
    radiusMeters: 52,
    boomLengthMeters: 61,
    activeFromWeek: 8,
    activeToWeek: 75,
  },
  {
    id: 'CR-02',
    name: 'River South Bank Heavy Lift',
    model: 'Liebherr LR 1300 (300 Ton)',
    capacityTon: 300,
    position: [-32, 0, -70],
    radiusMeters: 68,
    boomLengthMeters: 78,
    activeFromWeek: 16,
    activeToWeek: 92,
  },
  {
    id: 'CR-03',
    name: 'River North Bank Super Lift',
    model: 'Sany SCC2600A (260 Ton)',
    capacityTon: 260,
    position: [-26, 0, 40],
    radiusMeters: 68,
    boomLengthMeters: 72,
    activeFromWeek: 16,
    activeToWeek: 92,
  },
  {
    id: 'CR-04',
    name: 'North Viaduct Rough Terrain',
    model: 'Tadano GR-1000XL (100 Ton)',
    capacityTon: 100,
    position: [-26, 0, 680],
    radiusMeters: 46,
    boomLengthMeters: 51,
    activeFromWeek: 24,
    activeToWeek: 85,
  },
];

// Detect Crane Collision Overlap Zones
export function getCraneCollisionPairs(cranes: CraneConfig[]): CraneCollisionPair[] {
  const collisions: CraneCollisionPair[] = [];

  for (let i = 0; i < cranes.length; i++) {
    for (let j = i + 1; j < cranes.length; j++) {
      const c1 = cranes[i];
      const c2 = cranes[j];
      const dx = c1.position[0] - c2.position[0];
      const dz = c1.position[2] - c2.position[2];
      const dist = Math.sqrt(dx * dx + dz * dz);
      const sumRadius = c1.radiusMeters + c2.radiusMeters;

      if (dist < sumRadius) {
        const overlap = Number((sumRadius - dist).toFixed(1));
        collisions.push({
          crane1Id: c1.id,
          crane2Id: c2.id,
          overlapDistance: overlap,
          warningMessage: `CRANE COLLISION OVERLAP: ${c1.id} & ${c2.id} overlap by ${overlap}m in River Spans P12-P13. Slewing limiter active.`,
        });
      }
    }
  }

  return collisions;
}

// On-site Concrete Batching Plant Compound Location
export const BATCHING_PLANT_LOCATION: [number, number, number] = [-95, 0, -220];

// Initial Concrete Fleet Mixers
export const INITIAL_TRANSIT_MIXERS: TransitMixer[] = [
  { id: 'TM-01', truckNumber: 'B 9142 UCR', capacityM3: 7.0, currentVolumeM3: 7.0, state: 'HAULING_TO_PUMP', progress: 0.65, targetPierId: 'P-12', speed: 0.0035 },
  { id: 'TM-02', truckNumber: 'B 9205 SBR', capacityM3: 7.0, currentVolumeM3: 7.0, state: 'DISCHARGING_AT_PUMP', progress: 1.0, targetPierId: 'P-12', speed: 0.003 },
  { id: 'TM-03', truckNumber: 'B 9318 XCR', capacityM3: 7.0, currentVolumeM3: 0.0, state: 'RETURNING_TO_PLANT', progress: 0.35, targetPierId: 'P-12', speed: 0.004 },
  { id: 'TM-04', truckNumber: 'B 9481 PQR', capacityM3: 7.0, currentVolumeM3: 7.0, state: 'LOADING_AT_PLANT', progress: 0.0, targetPierId: 'P-13', speed: 0.0035 },
  { id: 'TM-05', truckNumber: 'B 9552 TKL', capacityM3: 7.0, currentVolumeM3: 7.0, state: 'HAULING_TO_PUMP', progress: 0.2, targetPierId: 'P-13', speed: 0.0032 },
  { id: 'TM-06', truckNumber: 'B 9630 WKA', capacityM3: 7.0, currentVolumeM3: 0.0, state: 'RETURNING_TO_PLANT', progress: 0.8, targetPierId: 'P-13', speed: 0.0038 },
];
