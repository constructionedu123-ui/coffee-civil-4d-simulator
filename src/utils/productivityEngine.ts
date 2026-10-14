import {
  SimulatorConfig,
  ProductivityMetrics,
  MonteCarloResult,
  HistogramBin,
  ProductivityBenchmarks,
  AhspItem,
} from '../types/simulator';

/**
 * Standard default parameters for the 4M Construction Simulator
 */
export const DEFAULT_CONFIG: SimulatorConfig = {
  scope: {
    activity: 'excavation',
    volumeM3: 1000,
    materialType: 'tanah_biasa',
    haulDistanceKm: 4.5,
  },
  machine: {
    excavatorModel: 'PC200',
    excavatorCount: 1,
    excavatorRentalPerHour: 275000,
    truckCapacityM3: 8,
    truckCount: 5,
    truckRentalPerHour: 180000,
    speedLoadedKmH: 25,
    speedEmptyKmH: 35,
    dumpTimeMin: 2.0,
    spotTimeMin: 1.5,
  },
  manpower: {
    dailyCost: 2070000,
    crewDescription: '1 Mandor, 6 Operators/Drivers, 4 Field Crew',
    operatorWage: 250000,
    driverWage: 200000,
    mandorCount: 1,
    mandorWage: 220000,
    spotterCount: 2,
    spotterWage: 160000,
    helperCount: 2,
    helperWage: 140000,
  },
  materialFuel: {
    fuelPricePerLiter: 18000,
    excavatorFuelConsumptionLHr: 18,
    truckFuelConsumptionLKm: 0.35,
    tippingFeePerRit: 45000,
  },
  method: {
    workingHoursPerDay: 8,
    efficiencyFactor: 0.75,
  },
};

/**
 * Soil Swell and Fill factors
 */
export function getSoilProperties(type: SimulatorConfig['scope']['materialType']) {
  switch (type) {
    case 'tanah_keras':
      return { swellFactor: 1.4, fillFactor: 0.9, label: 'Tanah Keras / Batuan Lapuk' };
    case 'lempung_basah':
      return { swellFactor: 1.3, fillFactor: 1.05, label: 'Lempung Basah (Wet Clay)' };
    case 'tanah_biasa':
    default:
      return { swellFactor: 1.2, fillFactor: 1.0, label: 'Tanah Biasa (Common Earth)' };
  }
}

/**
 * Excavator standard specs
 */
export function getExcavatorSpecs(model: SimulatorConfig['machine']['excavatorModel']) {
  switch (model) {
    case 'PC300':
      return { bucketM3: 1.4, cycleSec: 25, defaultFuelLHr: 24, label: 'Komatsu PC300 (1.40 m³)' };
    case 'PC200':
    default:
      return { bucketM3: 0.93, cycleSec: 22, defaultFuelLHr: 18, label: 'Komatsu PC200 (0.93 m³)' };
  }
}

/**
 * Calculate total daily crew cost across all active site roles
 */
export function calculateTotalDailyCrewCost(config: SimulatorConfig): number {
  const { machine, manpower } = config;
  const opCount = machine.excavatorCount;
  const drvCount = machine.truckCount;
  const mndCount = manpower.mandorCount ?? 1;
  const sptCount = manpower.spotterCount ?? 2;
  const hlpCount = manpower.helperCount ?? 2;

  const opWage = manpower.operatorWage ?? 250000;
  const drvWage = manpower.driverWage ?? 200000;
  const mndWage = manpower.mandorWage ?? 220000;
  const sptWage = manpower.spotterWage ?? 160000;
  const hlpWage = manpower.helperWage ?? 140000;

  return (
    opCount * opWage +
    drvCount * drvWage +
    mndCount * mndWage +
    sptCount * sptWage +
    hlpCount * hlpWage
  );
}

/**
 * Calculate site crew headcount statistics and breakdown summary
 */
export function calculateTotalCrewHeadcount(config: SimulatorConfig): {
  total: number;
  operators: number;
  drivers: number;
  mandor: number;
  spotters: number;
  helpers: number;
  summaryText: string;
} {
  const operators = config.machine.excavatorCount;
  const drivers = config.machine.truckCount;
  const mandor = config.manpower.mandorCount ?? 1;
  const spotters = config.manpower.spotterCount ?? 2;
  const helpers = config.manpower.helperCount ?? 2;
  const total = operators + drivers + mandor + spotters + helpers;

  const summaryText = `${mandor} Mandor, ${operators + drivers} Operators/Drivers, ${spotters + helpers} Field Crew`;

  return {
    total,
    operators,
    drivers,
    mandor,
    spotters,
    helpers,
    summaryText,
  };
}

/**
 * Calculate standard Productivity Benchmarks & Permen PUPR AHSP Cost Components
 */
export function calculateProductivityBenchmarks(
  config: SimulatorConfig,
  systemHourlyQ: number,
  excHourlyQ: number,
  truckHourlyQ: number,
  outputP10 = 0,
  outputP50 = 0,
  outputP90 = 0
): ProductivityBenchmarks {
  const { machine, manpower, materialFuel, method, scope } = config;
  const soil = getSoilProperties(scope.materialType);
  const bankTruckCap = Math.max(1, machine.truckCapacityM3 / soil.swellFactor);

  // 1. Excavator Unit Productivity & Coefficient
  const excQ = Math.max(0.1, excHourlyQ);
  const excCoeffJamPerM3 = 1 / excQ;

  // 2. Dump Truck Unit Productivity & Coefficient
  const trkQ = Math.max(0.1, truckHourlyQ);
  const trkCoeffJamPerM3 = 1 / trkQ;

  // 3. System Daily Output
  const dailyQ = Math.max(1, systemHourlyQ * method.workingHoursPerDay);

  // 4. Manpower Productivity & Coefficients
  const crewStats = calculateTotalCrewHeadcount(config);
  const crewOutputPerManDay = dailyQ / Math.max(1, crewStats.total);
  const totalLaborCoeffOhPerM3 = 1 / Math.max(0.1, crewOutputPerManDay);

  const operatorCoeffOh = crewStats.operators / dailyQ;
  const driverCoeffOh = crewStats.drivers / dailyQ;
  const mandorCoeffOh = crewStats.mandor / dailyQ;
  const spotterCoeffOh = crewStats.spotters / dailyQ;
  const helperCoeffOh = crewStats.helpers / dailyQ;

  // 5. Specific Fuel Consumption (Fuel Index)
  // For 1 m3 bank volume excavated and hauled:
  const ritsPerM3 = 1 / bankTruckCap;
  const truckKmPerM3 = ritsPerM3 * (scope.haulDistanceKm * 2);
  const truckFuelPerM3 = truckKmPerM3 * materialFuel.truckFuelConsumptionLKm;

  // Excavator operating hours per m3 bank = excavatorCount / systemHourlyQ
  const excFleetCoeffJamPerM3 = machine.excavatorCount / Math.max(0.1, systemHourlyQ);
  const excFuelPerM3 = excFleetCoeffJamPerM3 * materialFuel.excavatorFuelConsumptionLHr;
  const fuelIndexLitersPerM3 = truckFuelPerM3 + excFuelPerM3;

  const truckFleetCoeffJamPerM3 = machine.truckCount / Math.max(0.1, systemHourlyQ);
  const tippingCoeffRitPerM3 = ritsPerM3;

  // 6. Build Standard Permen PUPR AHSP Table Items
  const ahspTable: AhspItem[] = [
    // A. Tenaga Kerja
    {
      id: 'A1',
      category: 'A. TENAGA KERJA',
      name: 'Pekerja / Helper (Trimming & Site Cleanup)',
      unit: 'OH',
      coefficient: Number(helperCoeffOh.toFixed(4)),
      unitPriceIdr: manpower.helperWage,
      subtotalIdr: Math.round(helperCoeffOh * manpower.helperWage),
    },
    {
      id: 'A2',
      category: 'A. TENAGA KERJA',
      name: 'Mandor / Pengawas Lapangan',
      unit: 'OH',
      coefficient: Number(mandorCoeffOh.toFixed(4)),
      unitPriceIdr: manpower.mandorWage,
      subtotalIdr: Math.round(mandorCoeffOh * manpower.mandorWage),
    },
    {
      id: 'A3',
      category: 'A. TENAGA KERJA',
      name: `Operator Alat Berat (${machine.excavatorModel})`,
      unit: 'OH',
      coefficient: Number(operatorCoeffOh.toFixed(4)),
      unitPriceIdr: manpower.operatorWage,
      subtotalIdr: Math.round(operatorCoeffOh * manpower.operatorWage),
    },
    {
      id: 'A4',
      category: 'A. TENAGA KERJA',
      name: `Driver Dump Truck (${machine.truckCapacityM3} m³)`,
      unit: 'OH',
      coefficient: Number(driverCoeffOh.toFixed(4)),
      unitPriceIdr: manpower.driverWage,
      subtotalIdr: Math.round(driverCoeffOh * manpower.driverWage),
    },
    {
      id: 'A5',
      category: 'A. TENAGA KERJA',
      name: 'Spotter / Flagman (Traffic Pit & Ramp K3)',
      unit: 'OH',
      coefficient: Number(spotterCoeffOh.toFixed(4)),
      unitPriceIdr: manpower.spotterWage,
      subtotalIdr: Math.round(spotterCoeffOh * manpower.spotterWage),
    },

    // B. Bahan
    {
      id: 'B1',
      category: 'B. BAHAN',
      name: 'Minyak Solar Industri (HSD / Bio Solar)',
      unit: 'Liter',
      coefficient: Number(fuelIndexLitersPerM3.toFixed(4)),
      unitPriceIdr: materialFuel.fuelPricePerLiter,
      subtotalIdr: Math.round(fuelIndexLitersPerM3 * materialFuel.fuelPricePerLiter),
    },
    {
      id: 'B2',
      category: 'B. BAHAN',
      name: 'Biaya Retribusi Pembuangan (Tipping Fee)',
      unit: 'Rit',
      coefficient: Number(tippingCoeffRitPerM3.toFixed(4)),
      unitPriceIdr: materialFuel.tippingFeePerRit,
      subtotalIdr: Math.round(tippingCoeffRitPerM3 * materialFuel.tippingFeePerRit),
    },

    // C. Peralatan
    {
      id: 'C1',
      category: 'C. PERALATAN',
      name: `Excavator Backhoe (${machine.excavatorModel} / ${getExcavatorSpecs(machine.excavatorModel).bucketM3} m³)`,
      unit: 'Jam',
      coefficient: Number(excFleetCoeffJamPerM3.toFixed(4)),
      unitPriceIdr: machine.excavatorRentalPerHour,
      subtotalIdr: Math.round(excFleetCoeffJamPerM3 * machine.excavatorRentalPerHour),
    },
    {
      id: 'C2',
      category: 'C. PERALATAN',
      name: `Dump Truck Kapasitas ${machine.truckCapacityM3} m³`,
      unit: 'Jam',
      coefficient: Number(truckFleetCoeffJamPerM3.toFixed(4)),
      unitPriceIdr: machine.truckRentalPerHour,
      subtotalIdr: Math.round(truckFleetCoeffJamPerM3 * machine.truckRentalPerHour),
    },
  ];

  const subtotalTenagaKerja = ahspTable
    .filter((i) => i.category === 'A. TENAGA KERJA')
    .reduce((acc, i) => acc + i.subtotalIdr, 0);

  const subtotalBahan = ahspTable
    .filter((i) => i.category === 'B. BAHAN')
    .reduce((acc, i) => acc + i.subtotalIdr, 0);

  const subtotalPeralatan = ahspTable
    .filter((i) => i.category === 'C. PERALATAN')
    .reduce((acc, i) => acc + i.subtotalIdr, 0);

  const totalUnitPricePermenPupr = subtotalTenagaKerja + subtotalBahan + subtotalPeralatan;

  // Defaults for P10/P50/P90 if not passed in from Monte Carlo
  const defP50 = outputP50 > 0 ? outputP50 : Math.round(systemHourlyQ * 10) / 10;
  const defP10 = outputP10 > 0 ? outputP10 : Math.round(systemHourlyQ * 1.18 * 10) / 10;
  const defP90 = outputP90 > 0 ? outputP90 : Math.round(systemHourlyQ * 0.78 * 10) / 10;

  return {
    excavatorHourlyQ: Math.round(excHourlyQ * 10) / 10,
    excavatorCoeffJamPerM3: Number(excCoeffJamPerM3.toFixed(4)),
    truckHourlyQ: Math.round(trkQ * 10) / 10,
    truckCoeffJamPerM3: Number(trkCoeffJamPerM3.toFixed(4)),
    crewOutputM3PerDay: Math.round(dailyQ * 10) / 10,
    crewOutputM3PerManDay: Math.round(crewOutputPerManDay * 10) / 10,
    totalLaborCoeffOhPerM3: Number(totalLaborCoeffOhPerM3.toFixed(4)),
    operatorCoeffOh: Number(operatorCoeffOh.toFixed(4)),
    driverCoeffOh: Number(driverCoeffOh.toFixed(4)),
    mandorCoeffOh: Number(mandorCoeffOh.toFixed(4)),
    spotterCoeffOh: Number(spotterCoeffOh.toFixed(4)),
    helperCoeffOh: Number(helperCoeffOh.toFixed(4)),
    fuelIndexLitersPerM3: Number(fuelIndexLitersPerM3.toFixed(3)),
    tippingCoeffRitPerM3: Number(tippingCoeffRitPerM3.toFixed(4)),
    excavatorFleetCoeffJamPerM3: Number(excFleetCoeffJamPerM3.toFixed(4)),
    truckFleetCoeffJamPerM3: Number(truckFleetCoeffJamPerM3.toFixed(4)),
    outputRateP10: defP10,
    outputRateP50: defP50,
    outputRateP90: defP90,
    ahspTable,
    subtotalTenagaKerja,
    subtotalBahan,
    subtotalPeralatan,
    totalUnitPricePermenPupr,
  };
}

/**
 * Format AHSP table into tab-separated text for direct Excel copy-paste
 */
export function formatAhspForExcel(benchmarks: ProductivityBenchmarks, config: SimulatorConfig): string {
  const lines: string[] = [];
  lines.push(`ANALISIS HARGA SATUAN PEKERJAAN (AHSP) - PEKERJAAN TANAH (GALIAN & ANGKUT)`);
  lines.push(`Pedoman Permen PUPR • Proyek: Coffee Civil 4D Simulator`);
  lines.push(`Volume: ${config.scope.volumeM3} m³ | Jarak Angkut: ${config.scope.haulDistanceKm} km | Material: ${config.scope.materialType}`);
  lines.push('');
  lines.push(`KODE/URAIAN\tSATUAN\tKOEFISIEN\tHARGA SATUAN (RP)\tJUMLAH HARGA (RP)`);

  lines.push(`A. TENAGA KERJA`);
  benchmarks.ahspTable
    .filter((i) => i.category === 'A. TENAGA KERJA')
    .forEach((i) => {
      lines.push(`${i.name}\t${i.unit}\t${i.coefficient.toFixed(4)}\t${i.unitPriceIdr}\t${i.subtotalIdr}`);
    });
  lines.push(`Subtotal Tenaga Kerja\t\t\t\t${benchmarks.subtotalTenagaKerja}`);

  lines.push(`B. BAHAN`);
  benchmarks.ahspTable
    .filter((i) => i.category === 'B. BAHAN')
    .forEach((i) => {
      lines.push(`${i.name}\t${i.unit}\t${i.coefficient.toFixed(4)}\t${i.unitPriceIdr}\t${i.subtotalIdr}`);
    });
  lines.push(`Subtotal Bahan\t\t\t\t${benchmarks.subtotalBahan}`);

  lines.push(`C. PERALATAN`);
  benchmarks.ahspTable
    .filter((i) => i.category === 'C. PERALATAN')
    .forEach((i) => {
      lines.push(`${i.name}\t${i.unit}\t${i.coefficient.toFixed(4)}\t${i.unitPriceIdr}\t${i.subtotalIdr}`);
    });
  lines.push(`Subtotal Peralatan\t\t\t\t${benchmarks.subtotalPeralatan}`);

  lines.push(`TOTAL HARGA SATUAN (HSP / m³)\t\t\t\t${benchmarks.totalUnitPricePermenPupr}`);
  return lines.join('\n');
}

/**
 * Format AHSP table into CSV format for file download
 */
export function formatAhspForCsv(benchmarks: ProductivityBenchmarks, config: SimulatorConfig): string {
  const lines: string[] = [];
  lines.push(`ANALISIS HARGA SATUAN PEKERJAAN (AHSP) - PERMEN PUPR`);
  lines.push(`Proyek,Coffee Civil 4D Construction Productivity Simulator`);
  lines.push(`Volume Scope,${config.scope.volumeM3} m3`);
  lines.push(`Jarak Haul,${config.scope.haulDistanceKm} km`);
  lines.push(`Excavator,${config.machine.excavatorCount} Unit (${config.machine.excavatorModel})`);
  lines.push(`Dump Truck,${config.machine.truckCount} Unit (${config.machine.truckCapacityM3} m3)`);
  lines.push(``);
  lines.push(`Kode/Uraian,Satuan,Koefisien,Harga Satuan (Rp),Jumlah Harga (Rp)`);

  lines.push(`A. TENAGA KERJA,,,,`);
  benchmarks.ahspTable
    .filter((i) => i.category === 'A. TENAGA KERJA')
    .forEach((i) => {
      lines.push(`"${i.name}",${i.unit},${i.coefficient.toFixed(4)},${i.unitPriceIdr},${i.subtotalIdr}`);
    });
  lines.push(`Subtotal Tenaga Kerja,,,,${benchmarks.subtotalTenagaKerja}`);

  lines.push(`B. BAHAN,,,,`);
  benchmarks.ahspTable
    .filter((i) => i.category === 'B. BAHAN')
    .forEach((i) => {
      lines.push(`"${i.name}",${i.unit},${i.coefficient.toFixed(4)},${i.unitPriceIdr},${i.subtotalIdr}`);
    });
  lines.push(`Subtotal Bahan,,,,${benchmarks.subtotalBahan}`);

  lines.push(`C. PERALATAN,,,,`);
  benchmarks.ahspTable
    .filter((i) => i.category === 'C. PERALATAN')
    .forEach((i) => {
      lines.push(`"${i.name}",${i.unit},${i.coefficient.toFixed(4)},${i.unitPriceIdr},${i.subtotalIdr}`);
    });
  lines.push(`Subtotal Peralatan,,,,${benchmarks.subtotalPeralatan}`);

  lines.push(`TOTAL HARGA SATUAN (HSP / m3),,,,${benchmarks.totalUnitPricePermenPupr}`);
  return lines.join('\n');
}

/**
 * Calculate deterministic productivity & fleet match factor
 */
export function calculateProductivity(config: SimulatorConfig): ProductivityMetrics {
  const { scope, machine, materialFuel, method } = config;
  const soil = getSoilProperties(scope.materialType);
  const excSpecs = getExcavatorSpecs(machine.excavatorModel);

  const bucketQ = excSpecs.bucketM3;
  const cycleSec = excSpecs.cycleSec;
  const E = method.efficiencyFactor;
  const Sf = soil.swellFactor;
  const Ff = soil.fillFactor;

  // 1. Excavator hourly bank volume (m3 bank / hr)
  const excHourlyQ = (bucketQ * 3600 * E * Ff) / (cycleSec * Sf);
  const excTotalHourlyQ = excHourlyQ * machine.excavatorCount;

  // 2. Dump Truck loading & cycle
  const looseTruckCapacity = machine.truckCapacityM3;
  const passesPerTruck = Math.max(1, Math.round(looseTruckCapacity / (bucketQ * Ff)));
  const truckLoadTimeMin = (passesPerTruck * cycleSec) / 60;

  const truckHaulTimeMin = (scope.haulDistanceKm / Math.max(5, machine.speedLoadedKmH)) * 60;
  const truckDumpTimeMin = machine.dumpTimeMin;
  const truckReturnTimeMin = (scope.haulDistanceKm / Math.max(5, machine.speedEmptyKmH)) * 60;
  const truckSpotTimeMin = machine.spotTimeMin;

  const truckCycleTimeMin =
    truckLoadTimeMin + truckHaulTimeMin + truckDumpTimeMin + truckReturnTimeMin + truckSpotTimeMin;

  // 3. Truck fleet capacity (bank volume)
  // Bank capacity per trip = looseCapacity / Sf
  const bankCapacityPerTrip = looseTruckCapacity / Sf;
  const tripsPerHourPerTruck = 60 / Math.max(1, truckCycleTimeMin);
  const truckFleetHourlyQ = machine.truckCount * bankCapacityPerTrip * tripsPerHourPerTruck * E;

  // 4. Match Factor
  // MF = (N_truck * T_load) / (N_exc * T_cycle_truck)
  const matchFactor =
    (machine.truckCount * truckLoadTimeMin) /
    (machine.excavatorCount * Math.max(0.1, truckCycleTimeMin));

  let matchFactorStatus: 'under_trucked' | 'balanced' | 'over_trucked' = 'balanced';
  let matchFactorAdvice = '';
  let excUtil = 100;
  let truckUtil = 100;

  if (matchFactor < 0.95) {
    matchFactorStatus = 'under_trucked';
    excUtil = Math.round(matchFactor * 100);
    truckUtil = 100;
    const idlePct = (100 - excUtil).toFixed(0);
    const deficitTrucks = Math.max(
      1,
      Math.ceil((machine.excavatorCount * truckCycleTimeMin) / truckLoadTimeMin - machine.truckCount)
    );
    matchFactorAdvice = `Under-trucked (MF=${matchFactor.toFixed(2)}): Excavator idle ${idlePct}%. Tambahkan ${deficitTrucks} unit Dump Truck agar kapasitas galian optimal.`;
  } else if (matchFactor > 1.05) {
    matchFactorStatus = 'over_trucked';
    excUtil = 100;
    truckUtil = Math.round((1 / matchFactor) * 100);
    const waitTime = ((matchFactor - 1) * truckLoadTimeMin).toFixed(1);
    matchFactorAdvice = `Over-trucked (MF=${matchFactor.toFixed(2)}): Dump Truck antre ±${waitTime} min di pit. Kurangi ${Math.max(1, Math.floor(machine.truckCount - (machine.excavatorCount * truckCycleTimeMin) / truckLoadTimeMin))} truck atau perbesar kapasitas excavator.`;
  } else {
    matchFactorStatus = 'balanced';
    excUtil = 98;
    truckUtil = 98;
    matchFactorAdvice = `Fleet Balanced (MF=${matchFactor.toFixed(2)}): Sinergi excavator dan armada dump truck berada di rasio optimal. Efisiensi biaya maksimal.`;
  }

  // 5. System Output & Duration
  const systemHourlyQ = Math.min(excTotalHourlyQ, truckFleetHourlyQ);
  const dailyOutputM3 = Math.max(1, systemHourlyQ * method.workingHoursPerDay);
  const estimatedDurationDays = scope.volumeM3 / dailyOutputM3;

  // 6. Cost Computations
  const hourlyMachineCost =
    machine.excavatorCount * machine.excavatorRentalPerHour +
    machine.truckCount * machine.truckRentalPerHour;

  const totalDailyLaborCost = calculateTotalDailyCrewCost(config);
  const hourlyLaborCost = totalDailyLaborCost / method.workingHoursPerDay;
  const crewStats = calculateTotalCrewHeadcount(config);

  // Fuel: Excavators + Trucks per hour
  const ritsPerHour = systemHourlyQ / bankCapacityPerTrip;
  const truckKmPerHour = ritsPerHour * (scope.haulDistanceKm * 2);
  const truckFuelLitersPerHour = truckKmPerHour * materialFuel.truckFuelConsumptionLKm;
  const excFuelLitersPerHour = machine.excavatorCount * materialFuel.excavatorFuelConsumptionLHr;
  const hourlyFuelCost = (excFuelLitersPerHour + truckFuelLitersPerHour) * materialFuel.fuelPricePerLiter;

  const hourlyTippingCost = ritsPerHour * materialFuel.tippingFeePerRit;

  const totalHourlyCost = hourlyMachineCost + hourlyLaborCost + hourlyFuelCost + hourlyTippingCost;
  const totalHours = scope.volumeM3 / Math.max(0.1, systemHourlyQ);
  const totalEstimatedCostIdr = totalHours * totalHourlyCost;
  const unitRatePerM3 = totalEstimatedCostIdr / Math.max(1, scope.volumeM3);

  const singleTruckHourlyQ = (looseTruckCapacity * 60 * E) / (truckCycleTimeMin * Sf);
  const benchmarks = calculateProductivityBenchmarks(
    config,
    systemHourlyQ,
    excHourlyQ,
    singleTruckHourlyQ
  );

  return {
    bucketCapacityM3: bucketQ,
    excavatorCycleSec: cycleSec,
    swellFactor: Sf,
    bucketFillFactor: Ff,
    excavatorHourlyQ: Math.round(excHourlyQ),
    excavatorTotalHourlyQ: Math.round(excTotalHourlyQ),
    truckPasses: passesPerTruck,
    truckLoadTimeMin: Number(truckLoadTimeMin.toFixed(2)),
    truckHaulTimeMin: Number(truckHaulTimeMin.toFixed(2)),
    truckDumpTimeMin: Number(truckDumpTimeMin.toFixed(2)),
    truckReturnTimeMin: Number(truckReturnTimeMin.toFixed(2)),
    truckCycleTimeMin: Number(truckCycleTimeMin.toFixed(2)),
    truckFleetHourlyQ: Math.round(truckFleetHourlyQ),
    systemHourlyQ: Math.round(systemHourlyQ),
    dailyOutputM3: Math.round(dailyOutputM3),
    estimatedDurationDays: Number(estimatedDurationDays.toFixed(1)),
    matchFactor: Number(matchFactor.toFixed(2)),
    matchFactorStatus,
    matchFactorAdvice,
    excavatorUtilizationPct: excUtil,
    truckUtilizationPct: truckUtil,
    hourlyMachineCost: Math.round(hourlyMachineCost),
    hourlyLaborCost: Math.round(hourlyLaborCost),
    hourlyFuelCost: Math.round(hourlyFuelCost),
    hourlyTippingCost: Math.round(hourlyTippingCost),
    totalEstimatedCostIdr: Math.round(totalEstimatedCostIdr),
    unitRatePerM3: Math.round(unitRatePerM3),
    totalDailyLaborCost: Math.round(totalDailyLaborCost),
    totalCrewHeadcount: crewStats.total,
    crewBreakdownText: crewStats.summaryText,
    operatorCount: crewStats.operators,
    driverCount: crewStats.drivers,
    benchmarks,
  };
}

/**
 * Standard Normal Box-Muller generator
 */
function randomNormal(mean = 0, stdev = 1): number {
  const u1 = 1 - Math.random();
  const u2 = 1 - Math.random();
  const randStdNormal = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return mean + stdev * randStdNormal;
}

/**
 * Monte Carlo Simulation Engine (1,000 Stochastic Iterations)
 * Simulates cycle variations, traffic delays, minor breakdown probabilities, and soil heterogeneity
 */
export function runMonteCarloSimulation(config: SimulatorConfig, iterations = 1000): MonteCarloResult {
  const { scope, machine, materialFuel, method } = config;
  const soil = getSoilProperties(scope.materialType);
  const excSpecs = getExcavatorSpecs(machine.excavatorModel);

  const samplesDays: number[] = [];
  const samplesCosts: number[] = [];
  const samplesHourlyQ: number[] = [];

  for (let i = 0; i < iterations; i++) {
    // 1. Excavator cycle time variance (Normal distribution: ±2.5s)
    const simCycleSec = Math.max(16, randomNormal(excSpecs.cycleSec, 2.5));

    // 2. Efficiency variance (Job conditions, operator fatigue: ±0.06)
    const simE = Math.min(0.92, Math.max(0.48, randomNormal(method.efficiencyFactor, 0.05)));

    // 3. Soil Swell variance (±6%)
    const simSf = Math.max(1.1, randomNormal(soil.swellFactor, soil.swellFactor * 0.06));
    const simFf = Math.min(1.15, Math.max(0.85, randomNormal(soil.fillFactor, 0.05)));

    const simExcHourlyQ = (excSpecs.bucketM3 * 3600 * simE * simFf) / (simCycleSec * simSf);
    const simExcTotalHourly = simExcHourlyQ * machine.excavatorCount;

    // 4. Truck speed and traffic variance (Traffic congestion delay log-normal)
    const trafficDelayFactor = 1.0 + Math.max(0, randomNormal(0.08, 0.12));
    const simSpeedLoaded = Math.max(12, randomNormal(machine.speedLoadedKmH, 3.5)) / trafficDelayFactor;
    const simSpeedEmpty = Math.max(18, randomNormal(machine.speedEmptyKmH, 4.0)) / trafficDelayFactor;

    // Breakdown stochastic chance (4% probability of 45-min minor breakdown per day)
    const hasBreakdown = Math.random() < 0.05;
    const breakdownDelayHours = hasBreakdown ? 0.75 : 0;

    const passes = Math.max(1, Math.round(machine.truckCapacityM3 / (excSpecs.bucketM3 * simFf)));
    const simLoadTimeMin = (passes * simCycleSec) / 60;
    const simHaulTimeMin = (scope.haulDistanceKm / simSpeedLoaded) * 60;
    const simReturnTimeMin = (scope.haulDistanceKm / simSpeedEmpty) * 60;
    const simDumpTimeMin = Math.max(1.2, randomNormal(machine.dumpTimeMin, 0.4));
    const simSpotTimeMin = Math.max(0.8, randomNormal(machine.spotTimeMin, 0.3));

    const simTruckCycleMin =
      simLoadTimeMin + simHaulTimeMin + simDumpTimeMin + simReturnTimeMin + simSpotTimeMin;

    const bankCap = machine.truckCapacityM3 / simSf;
    const tripsPerHour = 60 / Math.max(1, simTruckCycleMin);
    const simTruckFleetHourly = machine.truckCount * bankCap * tripsPerHour * simE;

    // System bottle-neck
    const simSystemHourly = Math.min(simExcTotalHourly, simTruckFleetHourly);
    samplesHourlyQ.push(simSystemHourly);

    const dailyHours = Math.max(1, method.workingHoursPerDay - breakdownDelayHours);
    const simDailyOutput = Math.max(5, simSystemHourly * dailyHours);

    const simDays = Math.max(0.5, scope.volumeM3 / simDailyOutput);
    samplesDays.push(simDays);

    // Simulated Cost
    const totalHours = simDays * method.workingHoursPerDay;
    const hourlyRental =
      machine.excavatorCount * machine.excavatorRentalPerHour +
      machine.truckCount * machine.truckRentalPerHour;
    const totalDailyLabor = calculateTotalDailyCrewCost(config);
    const hourlyLabor = totalDailyLabor / method.workingHoursPerDay;

    const rits = scope.volumeM3 / bankCap;
    const totalKm = rits * (scope.haulDistanceKm * 2);
    const fuelLiters =
      totalHours * machine.excavatorCount * materialFuel.excavatorFuelConsumptionLHr +
      totalKm * materialFuel.truckFuelConsumptionLKm;
    const fuelCost = fuelLiters * materialFuel.fuelPricePerLiter;
    const tippingCost = rits * materialFuel.tippingFeePerRit;

    const simTotalCost = totalHours * (hourlyRental + hourlyLabor) + fuelCost + tippingCost;
    samplesCosts.push(simTotalCost);
  }

  // Sort samples for percentile extraction
  samplesDays.sort((a, b) => a - b);
  samplesCosts.sort((a, b) => a - b);

  const p10Idx = Math.floor(iterations * 0.1);
  const p50Idx = Math.floor(iterations * 0.5);
  const p90Idx = Math.floor(iterations * 0.9);

  const p10Days = Number(samplesDays[p10Idx].toFixed(1));
  const p50Days = Number(samplesDays[p50Idx].toFixed(1));
  const p90Days = Number(samplesDays[p90Idx].toFixed(1));

  const minDays = Number(samplesDays[0].toFixed(1));
  const maxDays = Number(samplesDays[iterations - 1].toFixed(1));

  const sumDays = samplesDays.reduce((acc, d) => acc + d, 0);
  const meanDays = Number((sumDays / iterations).toFixed(1));

  const varianceDays =
    samplesDays.reduce((acc, d) => acc + Math.pow(d - meanDays, 2), 0) / iterations;
  const stdDevDays = Number(Math.sqrt(varianceDays).toFixed(2));

  const p10Cost = Math.round(samplesCosts[p10Idx]);
  const p50Cost = Math.round(samplesCosts[p50Idx]);
  const p90Cost = Math.round(samplesCosts[p90Idx]);
  const meanCost = Math.round(samplesCosts.reduce((acc, c) => acc + c, 0) / iterations);
  const unitRateP50 = Math.round(p50Cost / Math.max(1, scope.volumeM3));

  // Compute Cost Breakdown for P50
  const p50Hours = p50Days * method.workingHoursPerDay;
  const machineCostP50 = Math.round(
    p50Hours *
      (machine.excavatorCount * machine.excavatorRentalPerHour +
        machine.truckCount * machine.truckRentalPerHour)
  );
  const totalDailyLaborP50 = calculateTotalDailyCrewCost(config);
  const manpowerCostP50 = Math.round(p50Days * totalDailyLaborP50);
  const ritsP50 = scope.volumeM3 / (machine.truckCapacityM3 / soil.swellFactor);
  const kmP50 = ritsP50 * scope.haulDistanceKm * 2;
  const fuelP50 = Math.round(
    (p50Hours * machine.excavatorCount * materialFuel.excavatorFuelConsumptionLHr +
      kmP50 * materialFuel.truckFuelConsumptionLKm) *
      materialFuel.fuelPricePerLiter
  );
  const tippingP50 = Math.round(ritsP50 * materialFuel.tippingFeePerRit);

  // Build Histogram Bins (20 Bins)
  const binCount = 18;
  const span = Math.max(0.1, maxDays - minDays);
  const binWidth = span / binCount;
  const histogramBins: HistogramBin[] = [];

  for (let b = 0; b < binCount; b++) {
    const bMin = minDays + b * binWidth;
    const bMax = bMin + binWidth;
    const count = samplesDays.filter((d) => (b === binCount - 1 ? d >= bMin && d <= bMax : d >= bMin && d < bMax)).length;
    const percentage = Number(((count / iterations) * 100).toFixed(1));
    const binLabel = `${bMin.toFixed(1)}d`;

    const isP10 = p10Days >= bMin && p10Days <= bMax;
    const isP50 = p50Days >= bMin && p50Days <= bMax;
    const isP90 = p90Days >= bMin && p90Days <= bMax;

    histogramBins.push({
      binMin: bMin,
      binMax: bMax,
      binLabel,
      count,
      percentage,
      isP10,
      isP50,
      isP90,
    });
  }

  samplesHourlyQ.sort((a, b) => a - b);
  const outputP90 = Number(samplesHourlyQ[Math.floor(iterations * 0.1)].toFixed(1));
  const outputP50 = Number(samplesHourlyQ[Math.floor(iterations * 0.5)].toFixed(1));
  const outputP10 = Number(samplesHourlyQ[Math.floor(iterations * 0.9)].toFixed(1));

  const baseDet = calculateProductivity(config);
  const mcBenchmarks = calculateProductivityBenchmarks(
    config,
    outputP50,
    baseDet.benchmarks.excavatorHourlyQ,
    baseDet.benchmarks.truckHourlyQ,
    outputP10,
    outputP50,
    outputP90
  );

  return {
    iterationCount: iterations,
    samplesDays,
    samplesCosts,
    p10Days,
    p50Days,
    p90Days,
    minDays,
    maxDays,
    meanDays,
    stdDevDays,
    p10Cost,
    p50Cost,
    p90Cost,
    meanCost,
    unitRateP50,
    outputP10,
    outputP50,
    outputP90,
    costBreakdown: {
      machineCost: machineCostP50,
      manpowerCost: manpowerCostP50,
      fuelCost: fuelP50,
      tippingCost: tippingP50,
    },
    histogramBins,
    benchmarks: mcBenchmarks,
  };
}
