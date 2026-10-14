export type ElementType = 'pile' | 'column' | 'cap' | 'girder' | 'deck' | 'asphalt';

export type ConstructionStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';

export type RFIStatus = 'APPROVED' | 'IN_PROGRESS' | 'SCHEDULED' | 'REJECTED';

export interface InspectionCheckItem {
  id: string;
  label: string;
  checked: boolean;
  notes?: string;
}

export interface StructuralElement {
  id: string;
  name: string;
  spanIndex: number;
  type: ElementType;
  pierId: string; // e.g. "P-12"
  startWeek: number;
  endWeek: number;
  position: [number, number, number]; // [x, y, z] in Three.js world units
  dimensions: [number, number, number]; // [width/radius, height, length/depth]
  concreteSpec: {
    grade: string; // e.g. "f'c 35 MPa (K-400)"
    slump: string; // e.g. "12 ± 2 cm"
    maxAggregate: string; // e.g. "20 mm"
    wcRatio: number; // e.g. 0.42
    cementType: string; // e.g. "Type V (Sulfate Resistant)" or "Type I OPC"
  };
  volumeM3: number;
  steelKg: number;
  formworkM2: number;
  rfi: {
    number: string;
    date: string;
    status: RFIStatus;
    leadQc: string;
    consultant: string;
    checkItems: InspectionCheckItem[];
  };
}

export interface CraneConfig {
  id: string;
  name: string;
  model: string;
  capacityTon: number;
  position: [number, number, number]; // [x, y, z]
  radiusMeters: number;
  boomLengthMeters: number;
  activeFromWeek: number;
  activeToWeek: number;
  currentAngleDeg?: number;
}

export interface CraneCollisionPair {
  crane1Id: string;
  crane2Id: string;
  overlapDistance: number;
  warningMessage: string;
}

export type MixerState = 'LOADING_AT_PLANT' | 'HAULING_TO_PUMP' | 'DISCHARGING_AT_PUMP' | 'RETURNING_TO_PLANT';

export interface TransitMixer {
  id: string;
  truckNumber: string;
  capacityM3: number;
  currentVolumeM3: number;
  state: MixerState;
  progress: number; // 0.0 to 1.0 along route
  targetPierId: string;
  speed: number;
}

export interface Milestone {
  week: number;
  title: string;
  phase: 'earthwork' | 'substructure' | 'girder' | 'paving';
  description: string;
}

export interface SCurvePoint {
  week: number;
  plannedPercent: number;
  actualPercent: number;
}

export interface TelemetryData {
  dailyVolumePouredM3: number;
  fleetCycleTimeMins: number;
  equipmentUtilizationRate: number;
  activeCranesCount: number;
  activeMixersCount: number;
  totalPouredCorridorM3: number;
  totalSteelTons: number;
}

export interface WeatherState {
  rainfallMmHour: number; // 0 - 80 mm/hr
  isPouringSuspended: boolean;
  cumulativeDelayDays: number;
  suspendedReason: string | null;
}
