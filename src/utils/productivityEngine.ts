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
    embankment: {
      layerThicknessM: 0.25,
      rollerPasses: 8,
      vibroRollerCount: 1,
      vibroRollerRentalPerHour: 240000,
      bulldozerCount: 1,
      bulldozerRentalPerHour: 320000,
      waterTankerCount: 1,
      waterTankerRentalPerHour: 180000,
      waterPricePerM3: 35000,
    },
    rigidPavement: {
      slabThicknessCm: 25,
      pavementAreaM2: 4000,
      concreteGrade: 'FS45',
      concretePricePerM3: 1150000,
      concretePumpCount: 1,
      concretePumpRentalPerHour: 450000,
      transitMixerCount: 6,
      transitMixerCapacityM3: 7,
      transitMixerRentalPerHour: 180000,
      vibratorCount: 2,
      vibratorRentalPerHour: 50000,
      dowelSteelKgPerM2: 12,
      dowelSteelPricePerKg: 16500,
      curingCompoundPricePerM2: 25000,
    },
    uditch: {
      trenchLengthM: 600,
      uDitchSize: 'U-80',
      uDitchLengthPerPcs: 1.2,
      uDitchPricePerPcs: 820000,
      sandBeddingM3PerM: 0.08,
      sandPricePerM3: 280000,
      mortarJointPricePerM: 45000,
      mobileCraneCount: 1,
      mobileCraneRentalPerHour: 360000,
      miniExcavatorCount: 1,
      miniExcavatorRentalPerHour: 190000,
      flatbedTruckCount: 2,
      flatbedTruckRentalPerHour: 160000,
    },
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
      return { swellFactor: 1.4, fillFactor: 0.9, name: 'Tanah Keras / Bebatuan' };
    case 'lempung_basah':
      return { swellFactor: 1.3, fillFactor: 0.85, name: 'Lempung Basah (Sticky Clay)' };
    case 'tanah_biasa':
    default:
      return { swellFactor: 1.2, fillFactor: 1.0, name: 'Tanah Biasa (Common Earth)' };
  }
}

/**
 * Standard Excavator Specs
 */
export function getExcavatorSpecs(model: SimulatorConfig['machine']['excavatorModel']) {
  switch (model) {
    case 'PC300':
      return { bucketM3: 1.4, cycleSec: 25, defaultFuelLHr: 26, label: 'Komatsu PC300 (1.40 m³)' };
    case 'PC200':
    default:
      return { bucketM3: 0.93, cycleSec: 22, defaultFuelLHr: 18, label: 'Komatsu PC200 (0.93 m³)' };
  }
}

/**
 * Calculate total daily crew cost across all active site roles
 */
export function calculateTotalDailyCrewCost(config: SimulatorConfig): number {
  const { machine, manpower, scope } = config;
  const opWage = manpower.operatorWage ?? 250000;
  const drvWage = manpower.driverWage ?? 200000;
  const mndWage = manpower.mandorWage ?? 220000;
  const sptWage = manpower.spotterWage ?? 160000;
  const hlpWage = manpower.helperWage ?? 140000;

  if (scope.activity === 'embankment') {
    const emb = scope.embankment;
    const rollerCount = emb?.vibroRollerCount ?? 1;
    const dozerCount = emb?.bulldozerCount ?? 1;
    const tankerCount = emb?.waterTankerCount ?? 1;
    const totalOperators = rollerCount + dozerCount;
    const totalDrivers = tankerCount;
    const mandor = manpower.mandorCount ?? 1;
    const surveyors = manpower.spotterCount ?? 2;
    const helpers = manpower.helperCount ?? 2;
    return (
      totalOperators * opWage +
      totalDrivers * drvWage +
      mandor * mndWage +
      surveyors * sptWage +
      helpers * hlpWage
    );
  }

  if (scope.activity === 'rigid_pavement') {
    const rp = scope.rigidPavement;
    const pumpCount = rp?.concretePumpCount ?? 1;
    const vibratorCount = rp?.vibratorCount ?? 2;
    const mixerCount = rp?.transitMixerCount ?? 6;
    const mandor = manpower.mandorCount ?? 1;
    const finishers = (manpower.spotterCount ?? 2) + 2;
    const helpers = manpower.helperCount ?? 4;
    return (
      (pumpCount + vibratorCount) * opWage +
      mixerCount * drvWage +
      mandor * mndWage +
      finishers * 180000 +
      helpers * hlpWage
    );
  }

  if (scope.activity === 'uditch') {
    const ud = scope.uditch;
    const craneCount = ud?.mobileCraneCount ?? 1;
    const excCount = ud?.miniExcavatorCount ?? 1;
    const flatbedCount = ud?.flatbedTruckCount ?? 2;
    const mandor = manpower.mandorCount ?? 1;
    const riggers = manpower.spotterCount ?? 2;
    const helpers = manpower.helperCount ?? 3;
    return (
      (craneCount + excCount) * opWage +
      flatbedCount * drvWage +
      mandor * mndWage +
      riggers * sptWage +
      helpers * hlpWage
    );
  }

  // Default excavation
  const opCount = machine.excavatorCount;
  const drvCount = machine.truckCount;
  const mndCount = manpower.mandorCount ?? 1;
  const sptCount = manpower.spotterCount ?? 2;
  const hlpCount = manpower.helperCount ?? 2;

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
  const { machine, manpower, scope } = config;
  const mandor = manpower.mandorCount ?? 1;

  if (scope.activity === 'embankment') {
    const emb = scope.embankment;
    const operators = (emb?.vibroRollerCount ?? 1) + (emb?.bulldozerCount ?? 1);
    const drivers = emb?.waterTankerCount ?? 1;
    const spotters = manpower.spotterCount ?? 2; // Grade checker / Surveyor
    const helpers = manpower.helperCount ?? 2;
    const total = operators + drivers + mandor + spotters + helpers;
    const summaryText = `${mandor} Mandor, ${operators + drivers} Operators/Drivers, ${spotters + helpers} Field Crew`;
    return { total, operators, drivers, mandor, spotters, helpers, summaryText };
  }

  if (scope.activity === 'rigid_pavement') {
    const rp = scope.rigidPavement;
    const operators = (rp?.concretePumpCount ?? 1) + (rp?.vibratorCount ?? 2);
    const drivers = rp?.transitMixerCount ?? 6;
    const spotters = (manpower.spotterCount ?? 2) + 2; // Tukang Cor & Finisher
    const helpers = manpower.helperCount ?? 4;
    const total = operators + drivers + mandor + spotters + helpers;
    const summaryText = `${mandor} Mandor Cor, ${spotters} Tukang/Finisher, ${operators + drivers} Eq. Crew, ${helpers} Helpers`;
    return { total, operators, drivers, mandor, spotters, helpers, summaryText };
  }

  if (scope.activity === 'uditch') {
    const ud = scope.uditch;
    const operators = (ud?.mobileCraneCount ?? 1) + (ud?.miniExcavatorCount ?? 1);
    const drivers = ud?.flatbedTruckCount ?? 2;
    const spotters = manpower.spotterCount ?? 2; // Riggers / Slingers K3
    const helpers = manpower.helperCount ?? 3;
    const total = operators + drivers + mandor + spotters + helpers;
    const summaryText = `${mandor} Mandor Pasang, ${spotters} Riggers, ${operators + drivers} Eq. Crew, ${helpers} Helpers`;
    return { total, operators, drivers, mandor, spotters, helpers, summaryText };
  }

  const operators = machine.excavatorCount;
  const drivers = machine.truckCount;
  const spotters = manpower.spotterCount ?? 2;
  const helpers = manpower.helperCount ?? 2;
  const total = operators + drivers + mandor + spotters + helpers;
  const summaryText = `${mandor} Mandor, ${operators + drivers} Operators/Drivers, ${spotters + helpers} Field Crew`;

  return { total, operators, drivers, mandor, spotters, helpers, summaryText };
}

/**
 * Calculate standard Productivity Benchmarks & Permen PUPR AHSP Cost Components
 */
export function calculateProductivityBenchmarks(
  config: SimulatorConfig,
  systemHourlyQ: number,
  primaryHourlyQ: number,
  secondaryHourlyQ: number,
  outputP10 = 0,
  outputP50 = 0,
  outputP90 = 0
): ProductivityBenchmarks {
  const { machine, manpower, materialFuel, method, scope } = config;
  const soil = getSoilProperties(scope.materialType);
  const dailyQ = Math.max(1, systemHourlyQ * method.workingHoursPerDay);

  const crewStats = calculateTotalCrewHeadcount(config);
  const crewOutputPerManDay = dailyQ / Math.max(1, crewStats.total);
  const totalLaborCoeffOhPerM3 = 1 / Math.max(0.1, crewOutputPerManDay);

  const operatorCoeffOh = crewStats.operators / dailyQ;
  const driverCoeffOh = crewStats.drivers / dailyQ;
  const mandorCoeffOh = crewStats.mandor / dailyQ;
  const spotterCoeffOh = crewStats.spotters / dailyQ;
  const helperCoeffOh = crewStats.helpers / dailyQ;

  // Defaults for P10/P50/P90
  const defP50 = outputP50 > 0 ? outputP50 : Math.round(systemHourlyQ * 10) / 10;
  const defP10 = outputP10 > 0 ? outputP10 : Math.round(systemHourlyQ * 1.18 * 10) / 10;
  const defP90 = outputP90 > 0 ? outputP90 : Math.round(systemHourlyQ * 0.78 * 10) / 10;

  // ================= 1. EMBANKMENT (TIMBUNAN) =================
  if (scope.activity === 'embankment') {
    const emb = scope.embankment;
    const rollerQ = Math.max(0.1, primaryHourlyQ);
    const dozerQ = Math.max(0.1, secondaryHourlyQ);
    const rollerRental = emb?.vibroRollerRentalPerHour ?? 240000;
    const dozerRental = emb?.bulldozerRentalPerHour ?? 320000;
    const tankerRental = emb?.waterTankerRentalPerHour ?? 180000;
    const waterPrice = emb?.waterPricePerM3 ?? 35000;

    const rollerCoeff = 1 / rollerQ;
    const dozerCoeff = 1 / dozerQ;
    const tankerCoeff = 1 / Math.max(1, 140);
    const fuelIndex = Number((14 / rollerQ + 22 / dozerQ).toFixed(3));

    const ahspTable: AhspItem[] = [
      { id: 'A1', category: 'A. TENAGA KERJA', name: 'Pekerja / Helper (Perapihan Tanah)', unit: 'OH', coefficient: Number(helperCoeffOh.toFixed(4)), unitPriceIdr: manpower.helperWage, subtotalIdr: Math.round(helperCoeffOh * manpower.helperWage) },
      { id: 'A2', category: 'A. TENAGA KERJA', name: 'Mandor Pemadatan Tanah', unit: 'OH', coefficient: Number(mandorCoeffOh.toFixed(4)), unitPriceIdr: manpower.mandorWage, subtotalIdr: Math.round(mandorCoeffOh * manpower.mandorWage) },
      { id: 'A3', category: 'A. TENAGA KERJA', name: 'Operator Vibro Roller (10-12 Ton)', unit: 'OH', coefficient: Number((1 / (rollerQ * 7)).toFixed(4)), unitPriceIdr: manpower.operatorWage, subtotalIdr: Math.round((1 / (rollerQ * 7)) * manpower.operatorWage) },
      { id: 'A4', category: 'A. TENAGA KERJA', name: 'Operator Bulldozer (D65P)', unit: 'OH', coefficient: Number((1 / (dozerQ * 7)).toFixed(4)), unitPriceIdr: manpower.operatorWage, subtotalIdr: Math.round((1 / (dozerQ * 7)) * manpower.operatorWage) },
      { id: 'A5', category: 'A. TENAGA KERJA', name: 'Driver Truk Tangki Air (Water Tanker)', unit: 'OH', coefficient: Number(driverCoeffOh.toFixed(4)), unitPriceIdr: manpower.driverWage, subtotalIdr: Math.round(driverCoeffOh * manpower.driverWage) },
      { id: 'A6', category: 'A. TENAGA KERJA', name: 'Grade Checker / Surveyor Elevasi', unit: 'OH', coefficient: Number(spotterCoeffOh.toFixed(4)), unitPriceIdr: manpower.spotterWage, subtotalIdr: Math.round(spotterCoeffOh * manpower.spotterWage) },

      { id: 'B1', category: 'B. BAHAN', name: 'Minyak Solar Industri (HSD)', unit: 'Liter', coefficient: fuelIndex, unitPriceIdr: materialFuel.fuelPricePerLiter, subtotalIdr: Math.round(fuelIndex * materialFuel.fuelPricePerLiter) },
      { id: 'B2', category: 'B. BAHAN', name: 'Air Bersih Pembasahan (Optimal Moisture)', unit: 'm³', coefficient: 0.045, unitPriceIdr: waterPrice, subtotalIdr: Math.round(0.045 * waterPrice) },

      { id: 'C1', category: 'C. PERALATAN', name: 'Vibratory Roller 10-12 Ton', unit: 'Jam', coefficient: Number(rollerCoeff.toFixed(4)), unitPriceIdr: rollerRental, subtotalIdr: Math.round(rollerCoeff * rollerRental) },
      { id: 'C2', category: 'C. PERALATAN', name: 'Bulldozer D65P (Spreading)', unit: 'Jam', coefficient: Number(dozerCoeff.toFixed(4)), unitPriceIdr: dozerRental, subtotalIdr: Math.round(dozerCoeff * dozerRental) },
      { id: 'C3', category: 'C. PERALATAN', name: 'Water Tanker Truck 5000L', unit: 'Jam', coefficient: Number(tankerCoeff.toFixed(4)), unitPriceIdr: tankerRental, subtotalIdr: Math.round(tankerCoeff * tankerRental) },
    ];

    const subtotalTenagaKerja = ahspTable.filter((i) => i.category === 'A. TENAGA KERJA').reduce((acc, i) => acc + i.subtotalIdr, 0);
    const subtotalBahan = ahspTable.filter((i) => i.category === 'B. BAHAN').reduce((acc, i) => acc + i.subtotalIdr, 0);
    const subtotalPeralatan = ahspTable.filter((i) => i.category === 'C. PERALATAN').reduce((acc, i) => acc + i.subtotalIdr, 0);
    const totalUnitPricePermenPupr = subtotalTenagaKerja + subtotalBahan + subtotalPeralatan;

    return {
      unitLabel: 'm³',
      primaryEquipLabel: '🚜 Vibro Roller',
      primaryEquipOutput: Math.round(rollerQ * 10) / 10,
      primaryEquipCoeff: Number(rollerCoeff.toFixed(4)),
      secondaryEquipLabel: '🚜 Bulldozer D65',
      secondaryEquipOutput: Math.round(dozerQ * 10) / 10,
      secondaryEquipCoeff: Number(dozerCoeff.toFixed(4)),
      excavatorHourlyQ: Math.round(rollerQ * 10) / 10,
      excavatorCoeffJamPerM3: Number(rollerCoeff.toFixed(4)),
      truckHourlyQ: Math.round(dozerQ * 10) / 10,
      truckCoeffJamPerM3: Number(dozerCoeff.toFixed(4)),
      crewOutputM3PerDay: Math.round(dailyQ * 10) / 10,
      crewOutputM3PerManDay: Math.round(crewOutputPerManDay * 10) / 10,
      totalLaborCoeffOhPerM3: Number(totalLaborCoeffOhPerM3.toFixed(4)),
      operatorCoeffOh: Number(operatorCoeffOh.toFixed(4)),
      driverCoeffOh: Number(driverCoeffOh.toFixed(4)),
      mandorCoeffOh: Number(mandorCoeffOh.toFixed(4)),
      spotterCoeffOh: Number(spotterCoeffOh.toFixed(4)),
      helperCoeffOh: Number(helperCoeffOh.toFixed(4)),
      fuelIndexLitersPerM3: fuelIndex,
      tippingCoeffRitPerM3: 0,
      excavatorFleetCoeffJamPerM3: Number(rollerCoeff.toFixed(4)),
      truckFleetCoeffJamPerM3: Number(dozerCoeff.toFixed(4)),
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

  // ================= 2. RIGID PAVEMENT (PERKERASAN KAKU) =================
  if (scope.activity === 'rigid_pavement') {
    const rp = scope.rigidPavement;
    const pumpQ = Math.max(0.1, primaryHourlyQ);
    const mixerQ = Math.max(0.1, secondaryHourlyQ);
    const pumpRental = rp?.concretePumpRentalPerHour ?? 450000;
    const mixerRental = rp?.transitMixerRentalPerHour ?? 180000;
    const vibratorRental = rp?.vibratorRentalPerHour ?? 50000;
    const concretePrice = rp?.concretePricePerM3 ?? 1150000;
    const dowelPrice = rp?.dowelSteelPricePerKg ?? 16500;

    const pumpCoeff = 1 / pumpQ;
    const mixerCoeff = 1 / mixerQ;
    const vibratorCoeff = 0.045;
    const fuelIndex = Number((18 / pumpQ + 8 / mixerQ).toFixed(3));

    const ahspTable: AhspItem[] = [
      { id: 'A1', category: 'A. TENAGA KERJA', name: 'Tukang Cor & Finisher Pavement', unit: 'OH', coefficient: 0.052, unitPriceIdr: 180000, subtotalIdr: Math.round(0.052 * 180000) },
      { id: 'A2', category: 'A. TENAGA KERJA', name: 'Pekerja Cor / Helper', unit: 'OH', coefficient: Number(helperCoeffOh.toFixed(4)), unitPriceIdr: manpower.helperWage, subtotalIdr: Math.round(helperCoeffOh * manpower.helperWage) },
      { id: 'A3', category: 'A. TENAGA KERJA', name: 'Mandor Pengecoran Beton', unit: 'OH', coefficient: Number(mandorCoeffOh.toFixed(4)), unitPriceIdr: manpower.mandorWage, subtotalIdr: Math.round(mandorCoeffOh * manpower.mandorWage) },
      { id: 'A4', category: 'A. TENAGA KERJA', name: 'Operator Pompa Beton (Concrete Pump)', unit: 'OH', coefficient: 0.024, unitPriceIdr: manpower.operatorWage, subtotalIdr: Math.round(0.024 * manpower.operatorWage) },
      { id: 'A5', category: 'A. TENAGA KERJA', name: 'Operator Concrete Vibrator', unit: 'OH', coefficient: 0.035, unitPriceIdr: 200000, subtotalIdr: Math.round(0.035 * 200000) },

      { id: 'B1', category: 'B. BAHAN', name: `Beton Ready-Mix (${rp?.concreteGrade ?? 'FS45'} / K-350)`, unit: 'm³', coefficient: 1.03, unitPriceIdr: concretePrice, subtotalIdr: Math.round(1.03 * concretePrice) },
      { id: 'B2', category: 'B. BAHAN', name: 'Besi Tulangan Dowel & Tie Bar (U-32)', unit: 'kg', coefficient: 48.0, unitPriceIdr: dowelPrice, subtotalIdr: Math.round(48.0 * dowelPrice) },
      { id: 'B3', category: 'B. BAHAN', name: 'Plastik Cor / Membran Kedap Air', unit: 'm²', coefficient: 4.1, unitPriceIdr: 8500, subtotalIdr: Math.round(4.1 * 8500) },
      { id: 'B4', category: 'B. BAHAN', name: 'Curing Compound & Joint Sealant', unit: 'm²', coefficient: 4.0, unitPriceIdr: 25000, subtotalIdr: Math.round(4.0 * 25000) },
      { id: 'B5', category: 'B. BAHAN', name: 'Minyak Solar Industri (HSD)', unit: 'Liter', coefficient: fuelIndex, unitPriceIdr: materialFuel.fuelPricePerLiter, subtotalIdr: Math.round(fuelIndex * materialFuel.fuelPricePerLiter) },

      { id: 'C1', category: 'C. PERALATAN', name: 'Concrete Pump Boom Truck', unit: 'Jam', coefficient: Number(pumpCoeff.toFixed(4)), unitPriceIdr: pumpRental, subtotalIdr: Math.round(pumpCoeff * pumpRental) },
      { id: 'C2', category: 'C. PERALATAN', name: 'Concrete Vibrator (2 Unit)', unit: 'Jam', coefficient: Number(vibratorCoeff.toFixed(4)), unitPriceIdr: vibratorRental, subtotalIdr: Math.round(vibratorCoeff * vibratorRental) },
      { id: 'C3', category: 'C. PERALATAN', name: `Transit Mixer Fleet (${rp?.transitMixerCapacityM3 ?? 7} m³)`, unit: 'Jam', coefficient: Number(mixerCoeff.toFixed(4)), unitPriceIdr: mixerRental, subtotalIdr: Math.round(mixerCoeff * mixerRental) },
    ];

    const subtotalTenagaKerja = ahspTable.filter((i) => i.category === 'A. TENAGA KERJA').reduce((acc, i) => acc + i.subtotalIdr, 0);
    const subtotalBahan = ahspTable.filter((i) => i.category === 'B. BAHAN').reduce((acc, i) => acc + i.subtotalIdr, 0);
    const subtotalPeralatan = ahspTable.filter((i) => i.category === 'C. PERALATAN').reduce((acc, i) => acc + i.subtotalIdr, 0);
    const totalUnitPricePermenPupr = subtotalTenagaKerja + subtotalBahan + subtotalPeralatan;

    return {
      unitLabel: 'm³',
      primaryEquipLabel: '🚛 Concrete Pump',
      primaryEquipOutput: Math.round(pumpQ * 10) / 10,
      primaryEquipCoeff: Number(pumpCoeff.toFixed(4)),
      secondaryEquipLabel: '🚚 Transit Mixer',
      secondaryEquipOutput: Math.round(mixerQ * 10) / 10,
      secondaryEquipCoeff: Number(mixerCoeff.toFixed(4)),
      excavatorHourlyQ: Math.round(pumpQ * 10) / 10,
      excavatorCoeffJamPerM3: Number(pumpCoeff.toFixed(4)),
      truckHourlyQ: Math.round(mixerQ * 10) / 10,
      truckCoeffJamPerM3: Number(mixerCoeff.toFixed(4)),
      crewOutputM3PerDay: Math.round(dailyQ * 10) / 10,
      crewOutputM3PerManDay: Math.round(crewOutputPerManDay * 10) / 10,
      totalLaborCoeffOhPerM3: Number(totalLaborCoeffOhPerM3.toFixed(4)),
      operatorCoeffOh: Number(operatorCoeffOh.toFixed(4)),
      driverCoeffOh: Number(driverCoeffOh.toFixed(4)),
      mandorCoeffOh: Number(mandorCoeffOh.toFixed(4)),
      spotterCoeffOh: Number(spotterCoeffOh.toFixed(4)),
      helperCoeffOh: Number(helperCoeffOh.toFixed(4)),
      fuelIndexLitersPerM3: fuelIndex,
      tippingCoeffRitPerM3: 0,
      excavatorFleetCoeffJamPerM3: Number(pumpCoeff.toFixed(4)),
      truckFleetCoeffJamPerM3: Number(mixerCoeff.toFixed(4)),
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

  // ================= 3. U-DITCH PRECAST =================
  if (scope.activity === 'uditch') {
    const ud = scope.uditch;
    const craneQ = Math.max(0.1, primaryHourlyQ);
    const excQ = Math.max(0.1, secondaryHourlyQ);
    const craneRental = ud?.mobileCraneRentalPerHour ?? 360000;
    const excRental = ud?.miniExcavatorRentalPerHour ?? 190000;
    const flatbedRental = ud?.flatbedTruckRentalPerHour ?? 160000;
    const uDitchPrice = ud?.uDitchPricePerPcs ?? 820000;
    const sandPrice = ud?.sandPricePerM3 ?? 280000;

    const craneCoeff = 1 / craneQ;
    const excCoeff = 1 / excQ;
    const flatbedCoeff = 0.055;
    const fuelIndex = Number((12 / craneQ + 9 / excQ).toFixed(3));

    const ahspTable: AhspItem[] = [
      { id: 'A1', category: 'A. TENAGA KERJA', name: 'Tukang Pasang Precast U-Ditch', unit: 'OH', coefficient: 0.065, unitPriceIdr: 180000, subtotalIdr: Math.round(0.065 * 180000) },
      { id: 'A2', category: 'A. TENAGA KERJA', name: 'Pekerja Galian & Urug', unit: 'OH', coefficient: Number(helperCoeffOh.toFixed(4)), unitPriceIdr: manpower.helperWage, subtotalIdr: Math.round(helperCoeffOh * manpower.helperWage) },
      { id: 'A3', category: 'A. TENAGA KERJA', name: 'Mandor Pemasangan Saluran', unit: 'OH', coefficient: Number(mandorCoeffOh.toFixed(4)), unitPriceIdr: manpower.mandorWage, subtotalIdr: Math.round(mandorCoeffOh * manpower.mandorWage) },
      { id: 'A4', category: 'A. TENAGA KERJA', name: 'Rigger / Slinger K3 Crane', unit: 'OH', coefficient: Number(spotterCoeffOh.toFixed(4)), unitPriceIdr: 170000, subtotalIdr: Math.round(spotterCoeffOh * 170000) },
      { id: 'A5', category: 'A. TENAGA KERJA', name: 'Operator Mobile Crane (5-8 Ton)', unit: 'OH', coefficient: 0.075, unitPriceIdr: manpower.operatorWage, subtotalIdr: Math.round(0.075 * manpower.operatorWage) },
      { id: 'A6', category: 'A. TENAGA KERJA', name: 'Operator Mini Excavator', unit: 'OH', coefficient: 0.065, unitPriceIdr: manpower.operatorWage, subtotalIdr: Math.round(0.065 * manpower.operatorWage) },

      { id: 'B1', category: 'B. BAHAN', name: `Box U-Ditch Precast (${ud?.uDitchSize ?? 'U-80'})`, unit: 'buah', coefficient: 0.833, unitPriceIdr: uDitchPrice, subtotalIdr: Math.round(0.833 * uDitchPrice) },
      { id: 'B2', category: 'B. BAHAN', name: 'Pasir Urug Landasan Bedding (t=10cm)', unit: 'm³', coefficient: 0.08, unitPriceIdr: sandPrice, subtotalIdr: Math.round(0.08 * sandPrice) },
      { id: 'B3', category: 'B. BAHAN', name: 'Mortar Joint Grouting Sela Sambungan', unit: 'm³', coefficient: 0.02, unitPriceIdr: 1250000, subtotalIdr: Math.round(0.02 * 1250000) },
      { id: 'B4', category: 'B. BAHAN', name: 'Minyak Solar Industri (HSD)', unit: 'Liter', coefficient: fuelIndex, unitPriceIdr: materialFuel.fuelPricePerLiter, subtotalIdr: Math.round(fuelIndex * materialFuel.fuelPricePerLiter) },

      { id: 'C1', category: 'C. PERALATAN', name: 'Mobile Crane 5-8 Ton (Lifting & Setting)', unit: 'Jam', coefficient: Number(craneCoeff.toFixed(4)), unitPriceIdr: craneRental, subtotalIdr: Math.round(craneCoeff * craneRental) },
      { id: 'C2', category: 'C. PERALATAN', name: 'Mini Excavator PC75/PC100 (Trenching)', unit: 'Jam', coefficient: Number(excCoeff.toFixed(4)), unitPriceIdr: excRental, subtotalIdr: Math.round(excCoeff * excRental) },
      { id: 'C3', category: 'C. PERALATAN', name: 'Flatbed Truck Pengangkut Precast', unit: 'Jam', coefficient: Number(flatbedCoeff.toFixed(4)), unitPriceIdr: flatbedRental, subtotalIdr: Math.round(flatbedCoeff * flatbedRental) },
    ];

    const subtotalTenagaKerja = ahspTable.filter((i) => i.category === 'A. TENAGA KERJA').reduce((acc, i) => acc + i.subtotalIdr, 0);
    const subtotalBahan = ahspTable.filter((i) => i.category === 'B. BAHAN').reduce((acc, i) => acc + i.subtotalIdr, 0);
    const subtotalPeralatan = ahspTable.filter((i) => i.category === 'C. PERALATAN').reduce((acc, i) => acc + i.subtotalIdr, 0);
    const totalUnitPricePermenPupr = subtotalTenagaKerja + subtotalBahan + subtotalPeralatan;

    return {
      unitLabel: "m'",
      primaryEquipLabel: '🏗️ Mobile Crane',
      primaryEquipOutput: Math.round(craneQ * 10) / 10,
      primaryEquipCoeff: Number(craneCoeff.toFixed(4)),
      secondaryEquipLabel: '🚜 Mini Excavator',
      secondaryEquipOutput: Math.round(excQ * 10) / 10,
      secondaryEquipCoeff: Number(excCoeff.toFixed(4)),
      excavatorHourlyQ: Math.round(craneQ * 10) / 10,
      excavatorCoeffJamPerM3: Number(craneCoeff.toFixed(4)),
      truckHourlyQ: Math.round(excQ * 10) / 10,
      truckCoeffJamPerM3: Number(excCoeff.toFixed(4)),
      crewOutputM3PerDay: Math.round(dailyQ * 10) / 10,
      crewOutputM3PerManDay: Math.round(crewOutputPerManDay * 10) / 10,
      totalLaborCoeffOhPerM3: Number(totalLaborCoeffOhPerM3.toFixed(4)),
      operatorCoeffOh: Number(operatorCoeffOh.toFixed(4)),
      driverCoeffOh: Number(driverCoeffOh.toFixed(4)),
      mandorCoeffOh: Number(mandorCoeffOh.toFixed(4)),
      spotterCoeffOh: Number(spotterCoeffOh.toFixed(4)),
      helperCoeffOh: Number(helperCoeffOh.toFixed(4)),
      fuelIndexLitersPerM3: fuelIndex,
      tippingCoeffRitPerM3: 0,
      excavatorFleetCoeffJamPerM3: Number(craneCoeff.toFixed(4)),
      truckFleetCoeffJamPerM3: Number(excCoeff.toFixed(4)),
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

  // ================= 4. EXCAVATION (GALIAN TANAH & BUANG) =================
  const bankTruckCap = Math.max(1, machine.truckCapacityM3 / soil.swellFactor);
  const excQ = Math.max(0.1, primaryHourlyQ);
  const excCoeffJamPerM3 = 1 / excQ;
  const trkQ = Math.max(0.1, secondaryHourlyQ);
  const trkCoeffJamPerM3 = 1 / trkQ;

  const ritsPerM3 = 1 / bankTruckCap;
  const truckKmPerM3 = ritsPerM3 * (scope.haulDistanceKm * 2);
  const truckFuelPerM3 = truckKmPerM3 * materialFuel.truckFuelConsumptionLKm;

  const excFleetCoeffJamPerM3 = machine.excavatorCount / Math.max(0.1, systemHourlyQ);
  const excFuelPerM3 = excFleetCoeffJamPerM3 * materialFuel.excavatorFuelConsumptionLHr;
  const fuelIndexLitersPerM3 = truckFuelPerM3 + excFuelPerM3;

  const truckFleetCoeffJamPerM3 = machine.truckCount / Math.max(0.1, systemHourlyQ);
  const tippingCoeffRitPerM3 = ritsPerM3;

  const ahspTable: AhspItem[] = [
    { id: 'A1', category: 'A. TENAGA KERJA', name: 'Pekerja / Helper (Trimming & Site Cleanup)', unit: 'OH', coefficient: Number(helperCoeffOh.toFixed(4)), unitPriceIdr: manpower.helperWage, subtotalIdr: Math.round(helperCoeffOh * manpower.helperWage) },
    { id: 'A2', category: 'A. TENAGA KERJA', name: 'Mandor / Pengawas Lapangan', unit: 'OH', coefficient: Number(mandorCoeffOh.toFixed(4)), unitPriceIdr: manpower.mandorWage, subtotalIdr: Math.round(mandorCoeffOh * manpower.mandorWage) },
    { id: 'A3', category: 'A. TENAGA KERJA', name: `Operator Alat Berat (${machine.excavatorModel})`, unit: 'OH', coefficient: Number(operatorCoeffOh.toFixed(4)), unitPriceIdr: manpower.operatorWage, subtotalIdr: Math.round(operatorCoeffOh * manpower.operatorWage) },
    { id: 'A4', category: 'A. TENAGA KERJA', name: `Driver Dump Truck (${machine.truckCapacityM3} m³)`, unit: 'OH', coefficient: Number(driverCoeffOh.toFixed(4)), unitPriceIdr: manpower.driverWage, subtotalIdr: Math.round(driverCoeffOh * manpower.driverWage) },
    { id: 'A5', category: 'A. TENAGA KERJA', name: 'Spotter / Flagman (Traffic Pit & Ramp K3)', unit: 'OH', coefficient: Number(spotterCoeffOh.toFixed(4)), unitPriceIdr: manpower.spotterWage, subtotalIdr: Math.round(spotterCoeffOh * manpower.spotterWage) },

    { id: 'B1', category: 'B. BAHAN', name: 'Minyak Solar Industri (HSD / Bio Solar)', unit: 'Liter', coefficient: Number(fuelIndexLitersPerM3.toFixed(4)), unitPriceIdr: materialFuel.fuelPricePerLiter, subtotalIdr: Math.round(fuelIndexLitersPerM3 * materialFuel.fuelPricePerLiter) },
    { id: 'B2', category: 'B. BAHAN', name: 'Biaya Retribusi Pembuangan (Tipping Fee)', unit: 'Rit', coefficient: Number(tippingCoeffRitPerM3.toFixed(4)), unitPriceIdr: materialFuel.tippingFeePerRit, subtotalIdr: Math.round(tippingCoeffRitPerM3 * materialFuel.tippingFeePerRit) },

    { id: 'C1', category: 'C. PERALATAN', name: `Excavator Backhoe (${machine.excavatorModel} / ${getExcavatorSpecs(machine.excavatorModel).bucketM3} m³)`, unit: 'Jam', coefficient: Number(excFleetCoeffJamPerM3.toFixed(4)), unitPriceIdr: machine.excavatorRentalPerHour, subtotalIdr: Math.round(excFleetCoeffJamPerM3 * machine.excavatorRentalPerHour) },
    { id: 'C2', category: 'C. PERALATAN', name: `Dump Truck Kapasitas ${machine.truckCapacityM3} m³`, unit: 'Jam', coefficient: Number(truckFleetCoeffJamPerM3.toFixed(4)), unitPriceIdr: machine.truckRentalPerHour, subtotalIdr: Math.round(truckFleetCoeffJamPerM3 * machine.truckRentalPerHour) },
  ];

  const subtotalTenagaKerja = ahspTable.filter((i) => i.category === 'A. TENAGA KERJA').reduce((acc, i) => acc + i.subtotalIdr, 0);
  const subtotalBahan = ahspTable.filter((i) => i.category === 'B. BAHAN').reduce((acc, i) => acc + i.subtotalIdr, 0);
  const subtotalPeralatan = ahspTable.filter((i) => i.category === 'C. PERALATAN').reduce((acc, i) => acc + i.subtotalIdr, 0);
  const totalUnitPricePermenPupr = subtotalTenagaKerja + subtotalBahan + subtotalPeralatan;

  return {
    unitLabel: 'm³',
    primaryEquipLabel: '🚜 Excavator',
    primaryEquipOutput: Math.round(excQ * 10) / 10,
    primaryEquipCoeff: Number(excCoeffJamPerM3.toFixed(4)),
    secondaryEquipLabel: '🚛 Dump Truck',
    secondaryEquipOutput: Math.round(trkQ * 10) / 10,
    secondaryEquipCoeff: Number(trkCoeffJamPerM3.toFixed(4)),
    excavatorHourlyQ: Math.round(excQ * 10) / 10,
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
  const act = config.scope.activity;
  const packageTitle =
    act === 'embankment'
      ? 'PEKERJAAN TIMBUNAN TANAH & PEMADATAN (VIBRO ROLLER)'
      : act === 'rigid_pavement'
      ? 'PEKERJAAN PERKERASAN KAKU (RIGID PAVEMENT BETON)'
      : act === 'uditch'
      ? 'PEKERJAAN SALURAN DRAINASE U-DITCH PRECAST'
      : 'PEKERJAAN TANAH (GALIAN & ANGKUT)';

  const unit = benchmarks.unitLabel || 'm³';
  lines.push(`ANALISIS HARGA SATUAN PEKERJAAN (AHSP) - ${packageTitle}`);
  lines.push(`Pedoman Permen PUPR • Proyek: Coffee Civil 4D Simulator`);
  lines.push(`Volume: ${config.scope.volumeM3} ${unit} | Material/Kategori: ${config.scope.materialType}`);
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

  lines.push(`TOTAL HARGA SATUAN (HSP / ${unit})\t\t\t\t${benchmarks.totalUnitPricePermenPupr}`);
  return lines.join('\n');
}

/**
 * Format AHSP table into CSV format for file download
 */
export function formatAhspForCsv(benchmarks: ProductivityBenchmarks, config: SimulatorConfig): string {
  const lines: string[] = [];
  const act = config.scope.activity;
  const packageTitle =
    act === 'embankment'
      ? 'PEKERJAAN TIMBUNAN TANAH & PEMADATAN'
      : act === 'rigid_pavement'
      ? 'PEKERJAAN PERKERASAN KAKU RIGID PAVEMENT'
      : act === 'uditch'
      ? 'PEKERJAAN SALURAN DRAINASE U-DITCH PRECAST'
      : 'PEKERJAAN TANAH (GALIAN & ANGKUT)';

  const unit = benchmarks.unitLabel || 'm3';
  lines.push(`ANALISIS HARGA SATUAN PEKERJAAN (AHSP) - ${packageTitle}`);
  lines.push(`Proyek,Coffee Civil 4D Construction Productivity Simulator`);
  lines.push(`Volume Scope,${config.scope.volumeM3} ${unit}`);
  lines.push(`Efisiensi Lapangan (E),${config.method.efficiencyFactor}`);
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

  lines.push(`TOTAL HARGA SATUAN (HSP / ${unit}),,,,${benchmarks.totalUnitPricePermenPupr}`);
  return lines.join('\n');
}

/**
 * Calculate deterministic productivity & fleet match factor
 */
export function calculateProductivity(config: SimulatorConfig): ProductivityMetrics {
  const { scope, machine, materialFuel, method } = config;
  const soil = getSoilProperties(scope.materialType);
  const excSpecs = getExcavatorSpecs(machine.excavatorModel);
  const E = method.efficiencyFactor;

  // ================= 1. EMBANKMENT (TIMBUNAN TANAH & PEMADATAN) =================
  if (scope.activity === 'embankment') {
    const emb = scope.embankment;
    const t = emb?.layerThicknessM ?? 0.25;
    const N = emb?.rollerPasses ?? 8;
    const W = 1.9; // Effective drum width
    const v = 3.2; // km/h
    const rollerCount = emb?.vibroRollerCount ?? 1;
    const dozerCount = emb?.bulldozerCount ?? 1;
    const tankerCount = emb?.waterTankerCount ?? 1;

    // Compactor Productivity (Permen PUPR formula: Q = W * v * 1000 * t * E / N)
    const singleRollerQ = (W * v * 1000 * t * E) / N;
    const rollerFleetHourlyQ = singleRollerQ * rollerCount;

    // Bulldozer spreading productivity (Q = q * 60 * E / Cm)
    const singleDozerQ = (3.5 * 60 * E) / 1.8;
    const dozerFleetHourlyQ = singleDozerQ * dozerCount;

    // Water tanker supply
    const waterFleetHourlyQ = 140 * tankerCount;

    const systemHourlyQ = Math.min(rollerFleetHourlyQ, dozerFleetHourlyQ, waterFleetHourlyQ);
    const dailyOutputM3 = Math.max(1, systemHourlyQ * method.workingHoursPerDay);
    const estimatedDurationDays = scope.volumeM3 / dailyOutputM3;

    // Match Factor: Spreading vs Compaction balance
    const matchFactor = dozerFleetHourlyQ / Math.max(0.1, rollerFleetHourlyQ);
    let matchFactorStatus: 'under_trucked' | 'balanced' | 'over_trucked' = 'balanced';
    let matchFactorAdvice = '';
    let excUtil = 98;
    let truckUtil = 98;

    if (matchFactor < 0.95) {
      matchFactorStatus = 'under_trucked';
      excUtil = Math.round(matchFactor * 100);
      truckUtil = 100;
      matchFactorAdvice = `Spreading Deficit (MF=${matchFactor.toFixed(2)}): Kapasitas Bulldozer meratakan tanah lebih lambat dari Vibro Roller. Tambahkan armada dozer agar compactor tidak standby.`;
    } else if (matchFactor > 1.05) {
      matchFactorStatus = 'over_trucked';
      excUtil = 100;
      truckUtil = Math.round((1 / matchFactor) * 100);
      matchFactorAdvice = `Compactor Bottleneck (MF=${matchFactor.toFixed(2)}): Penghamparan tanah lebih cepat daripada laju pemadatan. Tambahkan unit Vibro Roller agar tebal gembur tidak menumpuk.`;
    } else {
      matchFactorStatus = 'balanced';
      matchFactorAdvice = `Compaction Balanced (MF=${matchFactor.toFixed(2)}): Kapasitas penghamparan dozer dan pemadatan roller berada dalam kesetimbangan prima (98% Proctor Density).`;
    }

    const hourlyMachineCost =
      rollerCount * (emb?.vibroRollerRentalPerHour ?? 240000) +
      dozerCount * (emb?.bulldozerRentalPerHour ?? 320000) +
      tankerCount * (emb?.waterTankerRentalPerHour ?? 180000);

    const totalDailyLaborCost = calculateTotalDailyCrewCost(config);
    const hourlyLaborCost = totalDailyLaborCost / method.workingHoursPerDay;
    const crewStats = calculateTotalCrewHeadcount(config);

    const hourlyFuelCost =
      (rollerCount * 14 + dozerCount * 22 + tankerCount * 10) * materialFuel.fuelPricePerLiter;
    const hourlyTippingCost = systemHourlyQ * 0.045 * (emb?.waterPricePerM3 ?? 35000);

    const totalHourlyCost = hourlyMachineCost + hourlyLaborCost + hourlyFuelCost + hourlyTippingCost;
    const totalHours = scope.volumeM3 / Math.max(0.1, systemHourlyQ);
    const totalEstimatedCostIdr = totalHours * totalHourlyCost;
    const unitRatePerM3 = totalEstimatedCostIdr / Math.max(1, scope.volumeM3);

    const benchmarks = calculateProductivityBenchmarks(
      config,
      systemHourlyQ,
      singleRollerQ,
      singleDozerQ
    );

    return {
      bucketCapacityM3: 3.5,
      excavatorCycleSec: 25,
      swellFactor: 1.15,
      bucketFillFactor: 1.0,
      excavatorHourlyQ: Math.round(singleRollerQ),
      excavatorTotalHourlyQ: Math.round(rollerFleetHourlyQ),
      truckPasses: 8,
      truckLoadTimeMin: 3.5,
      truckHaulTimeMin: 12.0,
      truckDumpTimeMin: 2.0,
      truckReturnTimeMin: 10.0,
      truckCycleTimeMin: 27.5,
      truckFleetHourlyQ: Math.round(dozerFleetHourlyQ),
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
      unitLabel: 'm³',
      workPackageTitle: 'Timbunan Tanah & Pemadatan (Vibro Compactor)',
      benchmarks,
    };
  }

  // ================= 2. RIGID PAVEMENT (PERKERASAN KAKU) =================
  if (scope.activity === 'rigid_pavement') {
    const rp = scope.rigidPavement;
    const pumpCount = rp?.concretePumpCount ?? 1;
    const mixerCount = rp?.transitMixerCount ?? 6;
    const mixerCap = rp?.transitMixerCapacityM3 ?? 7;

    const singlePumpQ = 45 * E;
    const pumpFleetHourlyQ = singlePumpQ * pumpCount;

    const mixerCycleMin = 65; // Batching, travel, discharge, return
    const singleMixerQ = (60 / mixerCycleMin) * mixerCap * E;
    const mixerFleetHourlyQ = singleMixerQ * mixerCount;

    const systemHourlyQ = Math.min(pumpFleetHourlyQ, mixerFleetHourlyQ);
    const dailyOutputM3 = Math.max(1, systemHourlyQ * method.workingHoursPerDay);
    const estimatedDurationDays = scope.volumeM3 / dailyOutputM3;

    const matchFactor = mixerFleetHourlyQ / Math.max(0.1, pumpFleetHourlyQ);
    let matchFactorStatus: 'under_trucked' | 'balanced' | 'over_trucked' = 'balanced';
    let matchFactorAdvice = '';
    let excUtil = 98;
    let truckUtil = 98;

    if (matchFactor < 0.95) {
      matchFactorStatus = 'under_trucked';
      excUtil = Math.round(matchFactor * 100);
      truckUtil = 100;
      matchFactorAdvice = `Mixer Deficit (MF=${matchFactor.toFixed(2)}): Pasokan truk mixer kurang. Risiko sambungan dingin (cold joint) pada slab beton perkerasan. Tambahkan armada transit mixer!`;
    } else if (matchFactor > 1.05) {
      matchFactorStatus = 'over_trucked';
      excUtil = 100;
      truckUtil = Math.round((1 / matchFactor) * 100);
      matchFactorAdvice = `Mixer Congestion (MF=${matchFactor.toFixed(2)}): Truk mixer antre di lokasi pengecoran. Waspadai penurunan slump beton dan resiko beton setting di drum mixer.`;
    } else {
      matchFactorStatus = 'balanced';
      matchFactorAdvice = `Concrete Delivery Balanced (MF=${matchFactor.toFixed(2)}): Rasio suplai batching plant dan kapasitas pompa beton sinkron sempurna untuk pengecoran kontinu.`;
    }

    const hourlyMachineCost =
      pumpCount * (rp?.concretePumpRentalPerHour ?? 450000) +
      mixerCount * (rp?.transitMixerRentalPerHour ?? 180000) +
      (rp?.vibratorCount ?? 2) * (rp?.vibratorRentalPerHour ?? 50000);

    const totalDailyLaborCost = calculateTotalDailyCrewCost(config);
    const hourlyLaborCost = totalDailyLaborCost / method.workingHoursPerDay;
    const crewStats = calculateTotalCrewHeadcount(config);

    const hourlyFuelCost = (pumpCount * 18 + mixerCount * 8 + 4) * materialFuel.fuelPricePerLiter;
    const slabThickness = (rp?.slabThicknessCm ?? 25) / 100;
    const hourlyMaterialCost =
      systemHourlyQ *
      ((rp?.concretePricePerM3 ?? 1150000) * 1.03 +
        (rp?.dowelSteelKgPerM2 ?? 12) * (1 / slabThickness) * (rp?.dowelSteelPricePerKg ?? 16500) +
        (rp?.curingCompoundPricePerM2 ?? 25000) * (1 / slabThickness));

    const totalHourlyCost = hourlyMachineCost + hourlyLaborCost + hourlyFuelCost + hourlyMaterialCost;
    const totalHours = scope.volumeM3 / Math.max(0.1, systemHourlyQ);
    const totalEstimatedCostIdr = totalHours * totalHourlyCost;
    const unitRatePerM3 = totalEstimatedCostIdr / Math.max(1, scope.volumeM3);

    const benchmarks = calculateProductivityBenchmarks(
      config,
      systemHourlyQ,
      singlePumpQ,
      singleMixerQ
    );

    return {
      bucketCapacityM3: 7.0,
      excavatorCycleSec: 60,
      swellFactor: 1.0,
      bucketFillFactor: 1.0,
      excavatorHourlyQ: Math.round(singlePumpQ),
      excavatorTotalHourlyQ: Math.round(pumpFleetHourlyQ),
      truckPasses: 1,
      truckLoadTimeMin: 12.0,
      truckHaulTimeMin: 20.0,
      truckDumpTimeMin: 15.0,
      truckReturnTimeMin: 18.0,
      truckCycleTimeMin: 65.0,
      truckFleetHourlyQ: Math.round(mixerFleetHourlyQ),
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
      hourlyTippingCost: Math.round(hourlyMaterialCost),
      totalEstimatedCostIdr: Math.round(totalEstimatedCostIdr),
      unitRatePerM3: Math.round(unitRatePerM3),
      totalDailyLaborCost: Math.round(totalDailyLaborCost),
      totalCrewHeadcount: crewStats.total,
      crewBreakdownText: crewStats.summaryText,
      operatorCount: crewStats.operators,
      driverCount: crewStats.drivers,
      unitLabel: 'm³',
      workPackageTitle: 'Perkerasan Kaku (Rigid Concrete Pavement)',
      benchmarks,
    };
  }

  // ================= 3. U-DITCH PRECAST =================
  if (scope.activity === 'uditch') {
    const ud = scope.uditch;
    const craneCount = ud?.mobileCraneCount ?? 1;
    const excCount = ud?.miniExcavatorCount ?? 1;
    const flatbedCount = ud?.flatbedTruckCount ?? 2;

    const singleCraneQ = (1.2 / (4.5 / 60)) * E; // ~12 m'/hr
    const craneFleetHourlyQ = singleCraneQ * craneCount;

    const singleExcQ = 16 * E; // ~12 m'/hr
    const excFleetHourlyQ = singleExcQ * excCount;

    const flatbedFleetHourlyQ = 16 * flatbedCount;

    const systemHourlyQ = Math.min(craneFleetHourlyQ, excFleetHourlyQ, flatbedFleetHourlyQ);
    const dailyOutputM3 = Math.max(1, systemHourlyQ * method.workingHoursPerDay);
    const estimatedDurationDays = scope.volumeM3 / dailyOutputM3;

    const matchFactor = craneFleetHourlyQ / Math.max(0.1, excFleetHourlyQ);
    let matchFactorStatus: 'under_trucked' | 'balanced' | 'over_trucked' = 'balanced';
    let matchFactorAdvice = '';
    let excUtil = 98;
    let truckUtil = 98;

    if (matchFactor < 0.95) {
      matchFactorStatus = 'under_trucked';
      excUtil = Math.round(matchFactor * 100);
      truckUtil = 100;
      matchFactorAdvice = `Crane Slower Than Trenching (MF=${matchFactor.toFixed(2)}): Galian parit terlalu cepat dibanding setting precast. Parit terbuka berisiko longsor saat hujan. Percepat crane cycle atau tambah unit crane.`;
    } else if (matchFactor > 1.05) {
      matchFactorStatus = 'over_trucked';
      excUtil = 100;
      truckUtil = Math.round((1 / matchFactor) * 100);
      matchFactorAdvice = `Excavator Trenching Bottleneck (MF=${matchFactor.toFixed(2)}): Mobile crane standby menunggu parit digali. Tambahkan mini excavator untuk membuka galian saluran.`;
    } else {
      matchFactorStatus = 'balanced';
      matchFactorAdvice = `Precast Installation Balanced (MF=${matchFactor.toFixed(2)}): Galian trench dan lifting setting box U-Ditch sinkron sempurna.`;
    }

    const hourlyMachineCost =
      craneCount * (ud?.mobileCraneRentalPerHour ?? 360000) +
      excCount * (ud?.miniExcavatorRentalPerHour ?? 190000) +
      flatbedCount * (ud?.flatbedTruckRentalPerHour ?? 160000);

    const totalDailyLaborCost = calculateTotalDailyCrewCost(config);
    const hourlyLaborCost = totalDailyLaborCost / method.workingHoursPerDay;
    const crewStats = calculateTotalCrewHeadcount(config);

    const hourlyFuelCost = (craneCount * 12 + excCount * 9 + flatbedCount * 7) * materialFuel.fuelPricePerLiter;
    const hourlyMaterialCost =
      systemHourlyQ *
      ((ud?.uDitchPricePerPcs ?? 820000) / (ud?.uDitchLengthPerPcs ?? 1.2) +
        (ud?.sandBeddingM3PerM ?? 0.08) * (ud?.sandPricePerM3 ?? 280000) +
        (ud?.mortarJointPricePerM ?? 45000));

    const totalHourlyCost = hourlyMachineCost + hourlyLaborCost + hourlyFuelCost + hourlyMaterialCost;
    const totalHours = scope.volumeM3 / Math.max(0.1, systemHourlyQ);
    const totalEstimatedCostIdr = totalHours * totalHourlyCost;
    const unitRatePerM3 = totalEstimatedCostIdr / Math.max(1, scope.volumeM3);

    const benchmarks = calculateProductivityBenchmarks(
      config,
      systemHourlyQ,
      singleCraneQ,
      singleExcQ
    );

    return {
      bucketCapacityM3: 0.8,
      excavatorCycleSec: 45,
      swellFactor: 1.0,
      bucketFillFactor: 1.0,
      excavatorHourlyQ: Math.round(singleCraneQ),
      excavatorTotalHourlyQ: Math.round(craneFleetHourlyQ),
      truckPasses: 1,
      truckLoadTimeMin: 4.5,
      truckHaulTimeMin: 15.0,
      truckDumpTimeMin: 5.0,
      truckReturnTimeMin: 15.0,
      truckCycleTimeMin: 39.5,
      truckFleetHourlyQ: Math.round(excFleetHourlyQ),
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
      hourlyTippingCost: Math.round(hourlyMaterialCost),
      totalEstimatedCostIdr: Math.round(totalEstimatedCostIdr),
      unitRatePerM3: Math.round(unitRatePerM3),
      totalDailyLaborCost: Math.round(totalDailyLaborCost),
      totalCrewHeadcount: crewStats.total,
      crewBreakdownText: crewStats.summaryText,
      operatorCount: crewStats.operators,
      driverCount: crewStats.drivers,
      unitLabel: "m'",
      workPackageTitle: 'Saluran Drainase U-Ditch Precast',
      benchmarks,
    };
  }

  // ================= 4. EXCAVATION (GALIAN TANAH & BUANG) =================
  const bucketQ = excSpecs.bucketM3;
  const cycleSec = excSpecs.cycleSec;
  const Sf = soil.swellFactor;
  const Ff = soil.fillFactor;

  const excHourlyQ = (bucketQ * 3600 * E * Ff) / (cycleSec * Sf);
  const excTotalHourlyQ = excHourlyQ * machine.excavatorCount;

  const looseTruckCapacity = machine.truckCapacityM3;
  const passesPerTruck = Math.max(1, Math.round(looseTruckCapacity / (bucketQ * Ff)));
  const truckLoadTimeMin = (passesPerTruck * cycleSec) / 60;
  const truckHaulTimeMin = (scope.haulDistanceKm / Math.max(5, machine.speedLoadedKmH)) * 60;
  const truckDumpTimeMin = machine.dumpTimeMin;
  const truckReturnTimeMin = (scope.haulDistanceKm / Math.max(5, machine.speedEmptyKmH)) * 60;
  const truckSpotTimeMin = machine.spotTimeMin;

  const truckCycleTimeMin =
    truckLoadTimeMin + truckHaulTimeMin + truckDumpTimeMin + truckReturnTimeMin + truckSpotTimeMin;

  const bankCapacityPerTrip = looseTruckCapacity / Sf;
  const tripsPerHourPerTruck = 60 / Math.max(1, truckCycleTimeMin);
  const truckFleetHourlyQ = machine.truckCount * bankCapacityPerTrip * tripsPerHourPerTruck * E;

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

  const systemHourlyQ = Math.min(excTotalHourlyQ, truckFleetHourlyQ);
  const dailyOutputM3 = Math.max(1, systemHourlyQ * method.workingHoursPerDay);
  const estimatedDurationDays = scope.volumeM3 / dailyOutputM3;

  const hourlyMachineCost =
    machine.excavatorCount * machine.excavatorRentalPerHour +
    machine.truckCount * machine.truckRentalPerHour;

  const totalDailyLaborCost = calculateTotalDailyCrewCost(config);
  const hourlyLaborCost = totalDailyLaborCost / method.workingHoursPerDay;
  const crewStats = calculateTotalCrewHeadcount(config);

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
    unitLabel: 'm³',
    workPackageTitle: 'Galian Tanah & Buang (Excavation & Disposal)',
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
 */
export function runMonteCarloSimulation(config: SimulatorConfig, iterations = 1000): MonteCarloResult {
  const baseDet = calculateProductivity(config);
  const { scope, method } = config;
  const samplesDays: number[] = [];
  const samplesCosts: number[] = [];
  const samplesHourlyQ: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const simE = Math.min(0.92, Math.max(0.48, randomNormal(method.efficiencyFactor, 0.05)));
    const breakdownDelayHours = Math.random() < 0.05 ? 0.75 : 0;
    const simCyclePerturb = Math.max(0.75, randomNormal(1.0, 0.09));

    const simSystemHourly = Math.max(1, (baseDet.systemHourlyQ * (simE / method.efficiencyFactor)) / simCyclePerturb);
    samplesHourlyQ.push(simSystemHourly);

    const dailyHours = Math.max(1, method.workingHoursPerDay - breakdownDelayHours);
    const simDailyOutput = simSystemHourly * dailyHours;
    const simDurationDays = Math.max(0.5, scope.volumeM3 / Math.max(0.1, simDailyOutput));
    samplesDays.push(simDurationDays);

    const hourlyCostPerturb = baseDet.hourlyMachineCost + baseDet.hourlyLaborCost + baseDet.hourlyFuelCost + baseDet.hourlyTippingCost;
    const simTotalCost = simDurationDays * dailyHours * hourlyCostPerturb * (1 + randomNormal(0, 0.04));
    samplesCosts.push(Math.round(simTotalCost));
  }

  samplesDays.sort((a, b) => a - b);
  samplesCosts.sort((a, b) => a - b);

  const p10Days = Number(samplesDays[Math.floor(iterations * 0.1)].toFixed(1));
  const p50Days = Number(samplesDays[Math.floor(iterations * 0.5)].toFixed(1));
  const p90Days = Number(samplesDays[Math.floor(iterations * 0.9)].toFixed(1));

  const p10Cost = samplesCosts[Math.floor(iterations * 0.1)];
  const p50Cost = samplesCosts[Math.floor(iterations * 0.5)];
  const p90Cost = samplesCosts[Math.floor(iterations * 0.9)];

  const minDays = samplesDays[0];
  const maxDays = samplesDays[samplesDays.length - 1];

  const sumDays = samplesDays.reduce((a, b) => a + b, 0);
  const meanDays = sumDays / iterations;
  const meanCost = Math.round(samplesCosts.reduce((a, b) => a + b, 0) / iterations);
  const varianceDays =
    samplesDays.reduce((acc, val) => acc + Math.pow(val - meanDays, 2), 0) / iterations;
  const stdDevDays = Number(Math.sqrt(varianceDays).toFixed(1));

  const binCount = 14;
  const range = Math.max(1, maxDays - minDays);
  const binWidth = range / binCount;
  const histogramBins: HistogramBin[] = [];

  for (let b = 0; b < binCount; b++) {
    const bMin = minDays + b * binWidth;
    const bMax = bMin + binWidth;
    const inBin = samplesDays.filter((d) => (b === binCount - 1 ? d >= bMin && d <= bMax : d >= bMin && d < bMax));
    const count = inBin.length;
    const percentage = Number(((count / iterations) * 100).toFixed(1));

    const isP10 = p10Days >= bMin && p10Days <= bMax;
    const isP50 = p50Days >= bMin && p50Days <= bMax;
    const isP90 = p90Days >= bMin && p90Days <= bMax;

    histogramBins.push({
      binMin: Number(bMin.toFixed(1)),
      binMax: Number(bMax.toFixed(1)),
      binLabel: `${bMin.toFixed(0)}-${bMax.toFixed(0)}d`,
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

  const mcBenchmarks = calculateProductivityBenchmarks(
    config,
    outputP50,
    baseDet.benchmarks.primaryEquipOutput,
    baseDet.benchmarks.secondaryEquipOutput,
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
    meanDays: Number(meanDays.toFixed(1)),
    stdDevDays,
    p10Cost,
    p50Cost,
    p90Cost,
    meanCost,
    unitRateP50: Math.round(p50Cost / Math.max(1, scope.volumeM3)),
    histogramBins,
    costBreakdown: {
      machineCost: Math.round(p50Days * method.workingHoursPerDay * baseDet.hourlyMachineCost),
      manpowerCost: Math.round(p50Days * method.workingHoursPerDay * baseDet.hourlyLaborCost),
      fuelCost: Math.round(p50Days * method.workingHoursPerDay * baseDet.hourlyFuelCost),
      tippingCost: Math.round(p50Days * method.workingHoursPerDay * baseDet.hourlyTippingCost),
    },
    outputP10,
    outputP50,
    outputP90,
    benchmarks: mcBenchmarks,
  };
}
