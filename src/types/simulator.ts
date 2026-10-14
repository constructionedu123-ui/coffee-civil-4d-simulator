export type WorkActivity = 'excavation' | 'embankment' | 'concrete';

export type SoilType = 'tanah_biasa' | 'tanah_keras' | 'lempung_basah';

export type ExcavatorModel = 'PC200' | 'PC300';

export interface ProjectScope {
  activity: WorkActivity;
  volumeM3: number;
  materialType: SoilType;
  haulDistanceKm: number;
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

  // Productivity Benchmarks & Permen PUPR AHSP
  benchmarks: ProductivityBenchmarks;
}

export interface AhspItem {
  id: string;
  category: 'A. TENAGA KERJA' | 'B. BAHAN' | 'C. PERALATAN';
  name: string;
  unit: 'OH' | 'Liter' | 'Rit' | 'Jam';
  coefficient: number;
  unitPriceIdr: number;
  subtotalIdr: number;
}

export interface ProductivityBenchmarks {
  // Excavator
  excavatorHourlyQ: number; // m3/hour
  excavatorCoeffJamPerM3: number; // Jam/m3

  // Dump Truck
  truckHourlyQ: number; // m3/hour
  truckCoeffJamPerM3: number; // Jam/m3

  // Manpower
  crewOutputM3PerDay: number; // m3/day
  crewOutputM3PerManDay: number; // m3/man-day
  totalLaborCoeffOhPerM3: number; // OH/m3
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

  // Monte Carlo Output Variations (m3/hour)
  outputRateP10: number; // Optimistic (m3/hr)
  outputRateP50: number; // Expected (m3/hr)
  outputRateP90: number; // Worst-Case Congested (m3/hr)

  // Standard Permen PUPR AHSP Table
  ahspTable: AhspItem[];
  subtotalTenagaKerja: number;
  subtotalBahan: number;
  subtotalPeralatan: number;
  totalUnitPricePermenPupr: number; // Total HSP (Rp/m3)
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
