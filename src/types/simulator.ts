export type WorkActivity = 'excavation' | 'embankment' | 'rigid_pavement' | 'uditch' | 'concrete';

export type SoilType = 'tanah_biasa' | 'tanah_keras' | 'lempung_basah';

export type ExcavatorModel = 'PC200' | 'PC300';

export interface EmbankmentParams {
  layerThicknessM: number; // e.g. 0.25 m (0.15 - 0.40)
  rollerPasses: number; // e.g. 8 passes (4 - 12)
  vibroRollerCount: number; // e.g. 1 (1 - 4)
  vibroRollerRentalPerHour: number; // e.g. 240000
  bulldozerCount: number; // e.g. 1 (1 - 3)
  bulldozerRentalPerHour: number; // e.g. 320000
  waterTankerCount: number; // e.g. 1 (1 - 3)
  waterTankerRentalPerHour: number; // e.g. 180000
  waterPricePerM3: number; // e.g. 35000 / m3
}

export interface RigidPavementParams {
  slabThicknessCm: number; // e.g. 25 cm (15 - 35)
  pavementAreaM2: number; // e.g. 4000 m2
  concreteGrade: 'FS45' | 'K350' | 'K300';
  concretePricePerM3: number; // e.g. 1150000
  concretePumpCount: number; // e.g. 1 (1 - 2)
  concretePumpRentalPerHour: number; // e.g. 450000
  transitMixerCount: number; // e.g. 6 (2 - 14)
  transitMixerCapacityM3: number; // e.g. 7 m3
  transitMixerRentalPerHour: number; // e.g. 180000
  vibratorCount: number; // e.g. 2 (1 - 4)
  vibratorRentalPerHour: number; // e.g. 50000
  dowelSteelKgPerM2: number; // e.g. 12 kg/m2
  dowelSteelPricePerKg: number; // e.g. 16500
  curingCompoundPricePerM2: number; // e.g. 25000
}

export interface UDitchParams {
  trenchLengthM: number; // e.g. 600 m'
  uDitchSize: 'U-60' | 'U-80' | 'U-100' | 'U-120';
  uDitchLengthPerPcs: number; // e.g. 1.2 m
  uDitchPricePerPcs: number; // e.g. 820000
  sandBeddingM3PerM: number; // e.g. 0.08 m3/m'
  sandPricePerM3: number; // e.g. 280000
  mortarJointPricePerM: number; // e.g. 45000
  mobileCraneCount: number; // e.g. 1 (1 - 2)
  mobileCraneRentalPerHour: number; // e.g. 360000
  miniExcavatorCount: number; // e.g. 1 (1 - 2)
  miniExcavatorRentalPerHour: number; // e.g. 190000
  flatbedTruckCount: number; // e.g. 2 (1 - 4)
  flatbedTruckRentalPerHour: number; // e.g. 160000
}

export interface ProjectScope {
  activity: WorkActivity;
  volumeM3: number;
  materialType: SoilType;
  haulDistanceKm: number;
  embankment?: EmbankmentParams;
  rigidPavement?: RigidPavementParams;
  uditch?: UDitchParams;
}

export interface MachineConfig {
  excavatorModel: ExcavatorModel;
  excavatorCount: number;
  excavatorRentalPerHour: number;
  truckCapacityM3: number; // 8 or 16
  truckCount: number;
  truckRentalPerHour: number;
  speedLoadedKmH: number;
  speedEmptyKmH: number;
  dumpTimeMin: number;
  spotTimeMin: number;
}

export interface ManpowerConfig {
  dailyCost: number; // Computed total daily crew cost across all on-site roles
  crewDescription: string;
  operatorWage: number; // Heavy Equipment Operator daily wage (default: 250000, count auto-synced with excavatorCount)
  driverWage: number; // Dump Truck Driver daily wage (default: 200000, count auto-synced with truckCount)
  mandorCount: number; // Field Supervisor / Mandor count (1-3, default: 1)
  mandorWage: number; // Mandor daily wage (default: 220000)
  spotterCount: number; // Spotters / Flagmen count (1-4, default: 2)
  spotterWage: number; // Spotter daily wage (default: 160000)
  helperCount: number; // Pekerja / General Helpers count (0-6, default: 2)
  helperWage: number; // Helper daily wage (default: 140000)
}

export interface MaterialFuelConfig {
  fuelPricePerLiter: number;
  excavatorFuelConsumptionLHr: number;
  truckFuelConsumptionLKm: number;
  tippingFeePerRit: number;
}

export interface MethodConfig {
  workingHoursPerDay: 8 | 14 | 24;
  efficiencyFactor: number; // 0.50 - 0.90
}

export interface SimulatorConfig {
  scope: ProjectScope;
  machine: MachineConfig;
  manpower: ManpowerConfig;
  materialFuel: MaterialFuelConfig;
  method: MethodConfig;
}

export interface ProductivityMetrics {
  // Excavator
  bucketCapacityM3: number;
  excavatorCycleSec: number;
  swellFactor: number;
  bucketFillFactor: number;
  excavatorHourlyQ: number; // m3 bank / hr per excavator
  excavatorTotalHourlyQ: number; // m3 bank / hr for fleet

  // Dump Truck
  truckPasses: number;
  truckLoadTimeMin: number;
  truckHaulTimeMin: number;
  truckDumpTimeMin: number;
  truckReturnTimeMin: number;
  truckCycleTimeMin: number;
  truckFleetHourlyQ: number; // m3 bank / hr for truck fleet

  // System & Match Factor
  systemHourlyQ: number; // bottleneck min(exc, truck)
  dailyOutputM3: number;
  estimatedDurationDays: number;
  matchFactor: number;
  matchFactorStatus: 'under_trucked' | 'balanced' | 'over_trucked';
  matchFactorAdvice: string;
  excavatorUtilizationPct: number;
  truckUtilizationPct: number;

  // Cost estimates
  hourlyMachineCost: number;
  hourlyLaborCost: number;
  hourlyFuelCost: number;
  hourlyTippingCost: number;
  totalEstimatedCostIdr: number;
  unitRatePerM3: number;

  // Manpower & Crew Telemetry
  totalDailyLaborCost: number;
  totalCrewHeadcount: number;
  crewBreakdownText: string;
  operatorCount: number;
  driverCount: number;

  // Package & Unit Telemetry
  unitLabel: string; // 'm³' or 'm\''
  workPackageTitle: string;

  // Productivity Benchmarks & Permen PUPR AHSP
  benchmarks: ProductivityBenchmarks;
}

export interface AhspItem {
  id: string;
  category: 'A. TENAGA KERJA' | 'B. BAHAN' | 'C. PERALATAN';
  name: string;
  unit: string;
  coefficient: number;
  unitPriceIdr: number;
  subtotalIdr: number;
}

export interface ProductivityBenchmarks {
  unitLabel: string;
  primaryEquipLabel: string;
  primaryEquipOutput: number;
  primaryEquipCoeff: number;
  secondaryEquipLabel: string;
  secondaryEquipOutput: number;
  secondaryEquipCoeff: number;

  // Excavator (default/excavation)
  excavatorHourlyQ: number; // m3/hour
  excavatorCoeffJamPerM3: number; // Jam/m3

  // Dump Truck
  truckHourlyQ: number; // m3/hour
  truckCoeffJamPerM3: number; // Jam/m3

  // Manpower
  crewOutputM3PerDay: number; // m3/day or m'/day
  crewOutputM3PerManDay: number; // m3/man-day or m'/man-day
  totalLaborCoeffOhPerM3: number; // OH/m3 or OH/m'
  operatorCoeffOh: number; // OH/m3
  driverCoeffOh: number; // OH/m3
  mandorCoeffOh: number; // OH/m3
  spotterCoeffOh: number; // OH/m3
  helperCoeffOh: number; // OH/m3

  // Specific Fuel Consumption & Tipping
  fuelIndexLitersPerM3: number; // Liter/m3
  tippingCoeffRitPerM3: number; // Rit/m3

  // Equipment fleet hours per m3
  excavatorFleetCoeffJamPerM3: number; // Jam/m3
  truckFleetCoeffJamPerM3: number; // Jam/m3

  // Monte Carlo Output Variations (m3/hour or m'/hour)
  outputRateP10: number; // Optimistic (m3/hr)
  outputRateP50: number; // Expected (m3/hr)
  outputRateP90: number; // Worst-Case Congested (m3/hr)

  // Standard Permen PUPR AHSP Table
  ahspTable: AhspItem[];
  subtotalTenagaKerja: number;
  subtotalBahan: number;
  subtotalPeralatan: number;
  totalUnitPricePermenPupr: number; // Total HSP (Rp/m3 or Rp/m')
}

export interface HistogramBin {
  binMin: number;
  binMax: number;
  binLabel: string;
  count: number;
  percentage: number;
  isP10?: boolean;
  isP50?: boolean;
  isP90?: boolean;
}

export interface MonteCarloResult {
  iterationCount: number;
  samplesDays: number[];
  samplesCosts: number[];
  p10Days: number;
  p50Days: number;
  p90Days: number;
  minDays: number;
  maxDays: number;
  meanDays: number;
  stdDevDays: number;

  p10Cost: number;
  p50Cost: number;
  p90Cost: number;
  meanCost: number;
  unitRateP50: number;

  // Productivity output rates (m3/hr)
  outputP10: number; // Optimistic
  outputP50: number; // Expected
  outputP90: number; // Congested

  costBreakdown: {
    machineCost: number;
    manpowerCost: number;
    fuelCost: number;
    tippingCost: number;
  };

  histogramBins: HistogramBin[];
  benchmarks: ProductivityBenchmarks;
}

export interface LiveSimulationState {
  isPlaying: boolean;
  speedMultiplier: number; // 1, 5, 20
  elapsedSimSeconds: number; // Simulated seconds
  excavatedVolumeM3: number;
  remainingVolumeM3: number;
  progressPercent: number;
  totalCostAccruedIdr: number;
  truckRitsCompleted: number;
}
