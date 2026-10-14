import React, { useState } from 'react';
import {
  SimulatorConfig,
  ProductivityMetrics,
  WorkActivity,
  SoilType,
  ExcavatorModel,
} from '../types/simulator';
import {
  Wrench,
  Fuel,
  Users,
  Clock,
  Sparkles,
  RotateCcw,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Layers,
} from 'lucide-react';
import {
  calculateTotalDailyCrewCost,
  calculateTotalCrewHeadcount,
} from '../utils/productivityEngine';

interface ConfigurationPanelProps {
  config: SimulatorConfig;
  onChangeConfig: (newConfig: SimulatorConfig) => void;
  metrics: ProductivityMetrics;
  onRunMonteCarlo: () => void;
  onResetDefaults: () => void;
}

interface WorkPackageOption {
  id: WorkActivity;
  label: string;
  sublabel: string;
  icon: string;
  unit: string;
}

const WORK_PACKAGES: WorkPackageOption[] = [
  {
    id: 'excavation',
    label: 'Galian Tanah & Buang',
    sublabel: 'Excavation & Disposal',
    icon: '🚜',
    unit: 'm³',
  },
  {
    id: 'embankment',
    label: 'Timbunan & Pemadatan',
    sublabel: 'Embankment & Vibro',
    icon: '🚜',
    unit: 'm³',
  },
  {
    id: 'rigid_pavement',
    label: 'Perkerasan Kaku (Rigid)',
    sublabel: 'Concrete Road Slab',
    icon: '🛣️',
    unit: 'm³',
  },
  {
    id: 'uditch',
    label: 'Saluran U-Ditch Precast',
    sublabel: 'Precast Trench Line',
    icon: '💧',
    unit: "m'",
  },
];

export const ConfigurationPanel: React.FC<ConfigurationPanelProps> = ({
  config,
  onChangeConfig,
  metrics,
  onRunMonteCarlo,
  onResetDefaults,
}) => {
  // Collapsible accordion sections
  const [openSections, setOpenSections] = useState<{
    scope: boolean;
    machine: boolean;
    manpower: boolean;
    fuel: boolean;
    method: boolean;
  }>({
    scope: true,
    machine: true,
    manpower: false,
    fuel: false,
    method: true,
  });

  const toggleSection = (key: keyof typeof openSections) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const activity = config.scope.activity;
  const isExcavation = activity === 'excavation' || activity === 'concrete';
  const isEmbankment = activity === 'embankment';
  const isRigidPavement = activity === 'rigid_pavement';
  const isUDitch = activity === 'uditch';

  // Sub-configs with fallbacks
  const embConfig = config.scope.embankment ?? {
    layerThicknessM: 0.25,
    rollerPasses: 8,
    vibroRollerCount: 1,
    vibroRollerRentalPerHour: 240000,
    bulldozerCount: 1,
    bulldozerRentalPerHour: 320000,
    waterTankerCount: 1,
    waterTankerRentalPerHour: 180000,
    waterPricePerM3: 35000,
  };

  const rpConfig = config.scope.rigidPavement ?? {
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
  };

  const udConfig = config.scope.uditch ?? {
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
  };

  // Dynamic Manpower Calculations
  const totalDailyCrewCost = calculateTotalDailyCrewCost(config);
  const crewStats = calculateTotalCrewHeadcount(config);

  // Switch Work Package
  const handleSelectPackage = (newAct: WorkActivity) => {
    let nextVolume = config.scope.volumeM3;
    if (newAct === 'rigid_pavement') {
      nextVolume = Math.round(rpConfig.pavementAreaM2 * (rpConfig.slabThicknessCm / 100));
    } else if (newAct === 'uditch') {
      nextVolume = udConfig.trenchLengthM;
    } else if (newAct === 'embankment') {
      nextVolume = config.scope.volumeM3 > 0 ? config.scope.volumeM3 : 3500;
    } else {
      nextVolume = config.scope.volumeM3 > 0 ? config.scope.volumeM3 : 1000;
    }

    onChangeConfig({
      ...config,
      scope: {
        ...config.scope,
        activity: newAct,
        volumeM3: nextVolume,
        embankment: embConfig,
        rigidPavement: rpConfig,
        uditch: udConfig,
      },
    });
  };

  // Quick Preset Handlers
  const applyPreset = (presetName: string) => {
    if (presetName === 'excavation_urban') {
      onChangeConfig({
        ...config,
        scope: {
          ...config.scope,
          activity: 'excavation',
          volumeM3: 1200,
          materialType: 'tanah_biasa',
          haulDistanceKm: 4.5,
        },
        machine: {
          ...config.machine,
          excavatorModel: 'PC200',
          excavatorCount: 1,
          truckCapacityM3: 8,
          truckCount: 5,
        },
        method: {
          ...config.method,
          workingHoursPerDay: 8,
          efficiencyFactor: 0.75,
        },
      });
    } else if (presetName === 'embankment_highway') {
      onChangeConfig({
        ...config,
        scope: {
          ...config.scope,
          activity: 'embankment',
          volumeM3: 6500,
          materialType: 'tanah_biasa',
          haulDistanceKm: 2.0,
          embankment: {
            ...embConfig,
            layerThicknessM: 0.25,
            rollerPasses: 8,
            vibroRollerCount: 2,
            bulldozerCount: 1,
            waterTankerCount: 1,
          },
        },
        method: {
          ...config.method,
          workingHoursPerDay: 14,
          efficiencyFactor: 0.82,
        },
      });
    } else if (presetName === 'rigid_toll') {
      const area = 5000;
      const thick = 25;
      onChangeConfig({
        ...config,
        scope: {
          ...config.scope,
          activity: 'rigid_pavement',
          volumeM3: Math.round(area * (thick / 100)),
          rigidPavement: {
            ...rpConfig,
            pavementAreaM2: area,
            slabThicknessCm: thick,
            concreteGrade: 'FS45',
            concretePumpCount: 1,
            transitMixerCount: 8,
          },
        },
        method: {
          ...config.method,
          workingHoursPerDay: 14,
          efficiencyFactor: 0.8,
        },
      });
    } else if (presetName === 'uditch_drainage') {
      const len = 800;
      onChangeConfig({
        ...config,
        scope: {
          ...config.scope,
          activity: 'uditch',
          volumeM3: len,
          uditch: {
            ...udConfig,
            trenchLengthM: len,
            uDitchSize: 'U-100',
            mobileCraneCount: 1,
            miniExcavatorCount: 1,
            flatbedTruckCount: 2,
          },
        },
        method: {
          ...config.method,
          workingHoursPerDay: 8,
          efficiencyFactor: 0.75,
        },
      });
    }
  };

  // Format IDR currency
  const formatIDR = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  return (
    <div className="w-full h-full bg-[#070b14]/95 backdrop-blur-xl border-r border-slate-800/90 flex flex-col overflow-hidden text-slate-200 text-xs">
      {/* Header */}
      <div className="p-4 border-b border-slate-800/80 bg-slate-900/60 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-bold text-white text-sm">Scope & 4M Configuration</h2>
            <p className="text-[10px] text-slate-400">Machine, Manpower, Material, Method</p>
          </div>
        </div>

        <button
          onClick={onResetDefaults}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          title="Reset to default values"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* ================= TOP-LEVEL CIVIL WORKS SCOPE SELECTOR ================= */}
      <div className="p-3 bg-gradient-to-b from-slate-900 to-slate-950 border-b border-slate-800 shrink-0">
        <label className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block mb-2 flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5" />
          <span>Pekerjaan Konstruksi Sipil (Civil Work Package)</span>
        </label>

        <div className="grid grid-cols-2 gap-1.5">
          {WORK_PACKAGES.map((pkg) => {
            const isSelected = config.scope.activity === pkg.id;
            return (
              <button
                key={pkg.id}
                onClick={() => handleSelectPackage(pkg.id)}
                className={`p-2 rounded-xl text-left border transition-all duration-150 flex flex-col justify-between ${
                  isSelected
                    ? 'bg-amber-500/20 border-amber-500/70 shadow-md shadow-amber-500/10 text-white'
                    : 'bg-slate-900/70 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span className="text-base">{pkg.icon}</span>
                  <span
                    className={`text-[9px] font-mono px-1.5 py-0.2 rounded font-semibold ${
                      isSelected
                        ? 'bg-amber-400 text-slate-950'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {pkg.unit}
                  </span>
                </div>
                <div>
                  <div
                    className={`font-bold text-[11px] leading-tight line-clamp-1 ${
                      isSelected ? 'text-amber-300' : 'text-slate-200'
                    }`}
                  >
                    {pkg.label}
                  </div>
                  <div className="text-[9px] text-slate-400 leading-tight mt-0.5 line-clamp-1">
                    {pkg.sublabel}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Quick Project Presets Bar */}
      <div className="px-4 py-2 bg-slate-950/80 border-b border-slate-800/80 flex items-center gap-1.5 overflow-x-auto text-[11px] shrink-0">
        <span className="text-slate-500 font-medium shrink-0">Quick Presets:</span>
        <button
          onClick={() => applyPreset('excavation_urban')}
          className={`px-2.5 py-1 rounded-lg border whitespace-nowrap transition ${
            isExcavation
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
              : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
          }`}
        >
          🚜 Galian Urban (1.2k m³)
        </button>
        <button
          onClick={() => applyPreset('embankment_highway')}
          className={`px-2.5 py-1 rounded-lg border whitespace-nowrap transition ${
            isEmbankment
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
              : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
          }`}
        >
          🚜 Timbunan Jalan (6.5k m³)
        </button>
        <button
          onClick={() => applyPreset('rigid_toll')}
          className={`px-2.5 py-1 rounded-lg border whitespace-nowrap transition ${
            isRigidPavement
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
              : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
          }`}
        >
          🛣️ Rigid Tol (1.25k m³)
        </button>
        <button
          onClick={() => applyPreset('uditch_drainage')}
          className={`px-2.5 py-1 rounded-lg border whitespace-nowrap transition ${
            isUDitch
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
              : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
          }`}
        >
          💧 U-Ditch Drain (800 m')
        </button>
      </div>

      {/* Scrollable Form Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
        {/* ================= STEP 1: PROJECT SCOPE ================= */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
          <button
            onClick={() => toggleSection('scope')}
            className="w-full p-3 flex items-center justify-between text-left font-bold text-white hover:bg-slate-800/40 transition"
          >
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center font-mono text-[10px]">
                1
              </span>
              <span>
                {isExcavation && 'Volume Galian & Karakteristik Tanah'}
                {isEmbankment && 'Volume Timbunan & Parameter Pemadatan'}
                {isRigidPavement && 'Geometri Slab & Mutu Beton Rigid'}
                {isUDitch && 'Panjang Trase & Spesifikasi Precast U-Ditch'}
              </span>
            </div>
            {openSections.scope ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </button>

          {openSections.scope && (
            <div className="p-3 pt-0 space-y-3.5 border-t border-slate-800/60">
              {/* 1A. EXCAVATION SCOPE INPUTS */}
              {isExcavation && (
                <>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] text-slate-400 font-medium">
                        Work Volume (m³ bank):
                      </label>
                      <div className="flex items-center gap-1 font-mono">
                        <input
                          type="number"
                          min={100}
                          max={25000}
                          step={50}
                          value={config.scope.volumeM3}
                          onChange={(e) =>
                            onChangeConfig({
                              ...config,
                              scope: {
                                ...config.scope,
                                volumeM3: Math.max(
                                  50,
                                  Math.min(25000, Number(e.target.value) || 100)
                                ),
                              },
                            })
                          }
                          className="w-24 bg-slate-950 border border-slate-700 rounded-lg px-2 py-0.5 text-right font-bold text-white text-xs focus:ring-1 focus:ring-sky-500"
                        />
                        <span className="text-[10px] text-slate-400">m³</span>
                      </div>
                    </div>

                    <input
                      type="range"
                      min={100}
                      max={15000}
                      step={50}
                      value={config.scope.volumeM3}
                      onChange={(e) =>
                        onChangeConfig({
                          ...config,
                          scope: { ...config.scope, volumeM3: Number(e.target.value) },
                        })
                      }
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
                    />

                    <div className="flex justify-between gap-1 text-[9px] font-mono text-slate-400">
                      {[500, 1000, 2500, 5000, 10000].map((v) => (
                        <button
                          key={v}
                          onClick={() =>
                            onChangeConfig({
                              ...config,
                              scope: { ...config.scope, volumeM3: v },
                            })
                          }
                          className={`px-1.5 py-0.5 rounded border transition ${
                            config.scope.volumeM3 === v
                              ? 'bg-sky-500 text-slate-950 border-sky-400 font-bold'
                              : 'bg-slate-950 border-slate-800 hover:text-white'
                          }`}
                        >
                          {v >= 1000 ? `${v / 1000}k` : v}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1 font-medium">
                      Soil / Material Classification:
                    </label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(
                        [
                          { id: 'tanah_biasa', label: 'Tanah Biasa', sf: 'Sf=1.20' },
                          { id: 'tanah_keras', label: 'Tanah Keras', sf: 'Sf=1.40' },
                          { id: 'lempung_basah', label: 'Lempung Basah', sf: 'Sf=1.30' },
                        ] as { id: SoilType; label: string; sf: string }[]
                      ).map((soil) => (
                        <button
                          key={soil.id}
                          onClick={() =>
                            onChangeConfig({
                              ...config,
                              scope: { ...config.scope, materialType: soil.id },
                            })
                          }
                          className={`p-1.5 rounded-xl text-center border transition ${
                            config.scope.materialType === soil.id
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm'
                              : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:text-slate-200'
                          }`}
                        >
                          <div className="font-semibold text-[10px] leading-tight">
                            {soil.label}
                          </div>
                          <div className="text-[9px] opacity-75 font-mono">{soil.sf}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Disposal / Haul Distance:</span>
                      <span className="font-mono font-bold text-sky-400">
                        {config.scope.haulDistanceKm} km
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0.5}
                      max={20}
                      step={0.5}
                      value={config.scope.haulDistanceKm}
                      onChange={(e) =>
                        onChangeConfig({
                          ...config,
                          scope: {
                            ...config.scope,
                            haulDistanceKm: Number(e.target.value),
                          },
                        })
                      }
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
                    />
                  </div>
                </>
              )}

              {/* 1B. EMBANKMENT (TIMBUNAN) SCOPE INPUTS */}
              {isEmbankment && (
                <>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] text-slate-400 font-medium">
                        Volume Timbunan Padat (m³):
                      </label>
                      <div className="flex items-center gap-1 font-mono">
                        <input
                          type="number"
                          min={200}
                          max={35000}
                          step={100}
                          value={config.scope.volumeM3}
                          onChange={(e) =>
                            onChangeConfig({
                              ...config,
                              scope: {
                                ...config.scope,
                                volumeM3: Math.max(100, Number(e.target.value) || 500),
                              },
                            })
                          }
                          className="w-24 bg-slate-950 border border-slate-700 rounded-lg px-2 py-0.5 text-right font-bold text-white text-xs focus:ring-1 focus:ring-amber-500"
                        />
                        <span className="text-[10px] text-slate-400">m³</span>
                      </div>
                    </div>

                    <input
                      type="range"
                      min={500}
                      max={20000}
                      step={100}
                      value={config.scope.volumeM3}
                      onChange={(e) =>
                        onChangeConfig({
                          ...config,
                          scope: { ...config.scope, volumeM3: Number(e.target.value) },
                        })
                      }
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div className="p-2 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1">
                      <label className="text-slate-400 block font-medium">
                        Tebal Hamparan Lepas (t):
                      </label>
                      <div className="flex items-center justify-between font-mono">
                        <span className="text-amber-400 font-bold">
                          {embConfig.layerThicknessM} m ({embConfig.layerThicknessM * 100} cm)
                        </span>
                        <select
                          value={embConfig.layerThicknessM}
                          onChange={(e) =>
                            onChangeConfig({
                              ...config,
                              scope: {
                                ...config.scope,
                                embankment: {
                                  ...embConfig,
                                  layerThicknessM: Number(e.target.value),
                                },
                              },
                            })
                          }
                          className="bg-slate-900 border border-slate-700 rounded p-1 text-white text-[10px]"
                        >
                          <option value={0.2}>0.20 m (20 cm)</option>
                          <option value={0.25}>0.25 m (25 cm)</option>
                          <option value={0.3}>0.30 m (30 cm)</option>
                          <option value={0.35}>0.35 m (35 cm)</option>
                        </select>
                      </div>
                    </div>

                    <div className="p-2 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1">
                      <label className="text-slate-400 block font-medium">
                        Jumlah Lintasan Vibro (N):
                      </label>
                      <div className="flex items-center justify-between font-mono">
                        <span className="text-amber-400 font-bold">
                          {embConfig.rollerPasses} Lintasan (Pass)
                        </span>
                        <select
                          value={embConfig.rollerPasses}
                          onChange={(e) =>
                            onChangeConfig({
                              ...config,
                              scope: {
                                ...config.scope,
                                embankment: {
                                  ...embConfig,
                                  rollerPasses: Number(e.target.value),
                                },
                              },
                            })
                          }
                          className="bg-slate-900 border border-slate-700 rounded p-1 text-white text-[10px]"
                        >
                          <option value={6}>6 Pass (Ringan)</option>
                          <option value={8}>8 Pass (Standar PUPR)</option>
                          <option value={10}>10 Pass (Kerapatan 95%)</option>
                          <option value={12}>12 Pass (Heavy)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* 1C. RIGID PAVEMENT SCOPE INPUTS */}
              {isRigidPavement && (
                <>
                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div className="space-y-1">
                      <label className="text-slate-400 block font-medium">
                        Luas Jalan Rigid (m²):
                      </label>
                      <input
                        type="number"
                        step={100}
                        value={rpConfig.pavementAreaM2}
                        onChange={(e) => {
                          const newArea = Math.max(100, Number(e.target.value) || 1000);
                          const totalVol = Math.round(newArea * (rpConfig.slabThicknessCm / 100));
                          onChangeConfig({
                            ...config,
                            scope: {
                              ...config.scope,
                              volumeM3: totalVol,
                              rigidPavement: { ...rpConfig, pavementAreaM2: newArea },
                            },
                          });
                        }}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-1.5 text-white font-mono text-right font-bold"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-slate-400 block font-medium">
                        Tebal Slab Beton (cm):
                      </label>
                      <select
                        value={rpConfig.slabThicknessCm}
                        onChange={(e) => {
                          const newThick = Number(e.target.value);
                          const totalVol = Math.round(
                            rpConfig.pavementAreaM2 * (newThick / 100)
                          );
                          onChangeConfig({
                            ...config,
                            scope: {
                              ...config.scope,
                              volumeM3: totalVol,
                              rigidPavement: { ...rpConfig, slabThicknessCm: newThick },
                            },
                          });
                        }}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-1.5 text-white font-mono"
                      >
                        <option value={20}>20 cm (Jalan Lokal)</option>
                        <option value={25}>25 cm (Jalan Provinsi)</option>
                        <option value={28}>28 cm (Jalan Nasional)</option>
                        <option value={30}>30 cm (Jalan Tol Heavy)</option>
                      </select>
                    </div>
                  </div>

                  {/* Calculated Concrete Volume Summary Badge */}
                  <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">Total Volume Pengecoran:</span>
                    <span className="font-mono font-bold text-sky-400 text-sm">
                      {config.scope.volumeM3.toLocaleString()} m³ Beton
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div>
                      <label className="text-slate-400 block mb-0.5">Mutu Beton Ready-Mix:</label>
                      <div className="flex gap-1 font-mono">
                        {(['FS45', 'K350', 'K300'] as const).map((grade) => (
                          <button
                            key={grade}
                            onClick={() =>
                              onChangeConfig({
                                ...config,
                                scope: {
                                  ...config.scope,
                                  rigidPavement: { ...rpConfig, concreteGrade: grade },
                                },
                              })
                            }
                            className={`flex-1 py-1 rounded text-center border font-bold transition ${
                              rpConfig.concreteGrade === grade
                                ? 'bg-sky-500 text-slate-950 border-sky-400'
                                : 'bg-slate-950 text-slate-400 border-slate-800'
                            }`}
                          >
                            {grade}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-slate-400 block mb-0.5">Dowel & Tie Bar (kg/m²):</label>
                      <input
                        type="number"
                        step={0.5}
                        value={rpConfig.dowelSteelKgPerM2}
                        onChange={(e) =>
                          onChangeConfig({
                            ...config,
                            scope: {
                              ...config.scope,
                              rigidPavement: {
                                ...rpConfig,
                                dowelSteelKgPerM2: Number(e.target.value) || 0,
                              },
                            },
                          })
                        }
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-1 text-white font-mono text-right"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* 1D. U-DITCH PRECAST SCOPE INPUTS */}
              {isUDitch && (
                <>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] text-slate-400 font-medium">
                        Panjang Saluran Trase (meter lari):
                      </label>
                      <div className="flex items-center gap-1 font-mono">
                        <input
                          type="number"
                          min={50}
                          max={5000}
                          step={50}
                          value={udConfig.trenchLengthM}
                          onChange={(e) => {
                            const newLen = Math.max(50, Number(e.target.value) || 100);
                            onChangeConfig({
                              ...config,
                              scope: {
                                ...config.scope,
                                volumeM3: newLen,
                                uditch: { ...udConfig, trenchLengthM: newLen },
                              },
                            });
                          }}
                          className="w-24 bg-slate-950 border border-slate-700 rounded-lg px-2 py-0.5 text-right font-bold text-white text-xs focus:ring-1 focus:ring-sky-500"
                        />
                        <span className="text-[10px] text-slate-400">m'</span>
                      </div>
                    </div>

                    <input
                      type="range"
                      min={100}
                      max={3000}
                      step={50}
                      value={udConfig.trenchLengthM}
                      onChange={(e) => {
                        const newLen = Number(e.target.value);
                        onChangeConfig({
                          ...config,
                          scope: {
                            ...config.scope,
                            volumeM3: newLen,
                            uditch: { ...udConfig, trenchLengthM: newLen },
                          },
                        });
                      }}
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div>
                      <label className="text-slate-400 block mb-0.5">Ukuran Box U-Ditch:</label>
                      <select
                        value={udConfig.uDitchSize}
                        onChange={(e) => {
                          const size = e.target.value as 'U-60' | 'U-80' | 'U-100' | 'U-120';
                          const priceMap = {
                            'U-60': 580000,
                            'U-80': 820000,
                            'U-100': 1150000,
                            'U-120': 1650000,
                          };
                          onChangeConfig({
                            ...config,
                            scope: {
                              ...config.scope,
                              uditch: {
                                ...udConfig,
                                uDitchSize: size,
                                uDitchPricePerPcs: priceMap[size],
                              },
                            },
                          });
                        }}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-1 text-white font-mono"
                      >
                        <option value="U-60">U-60 (60x60x120 cm)</option>
                        <option value="U-80">U-80 (80x80x120 cm)</option>
                        <option value="U-100">U-100 (100x100x120 cm)</option>
                        <option value="U-120">U-120 (120x120x120 cm)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-slate-400 block mb-0.5">Harga Precast (Rp/pcs):</label>
                      <input
                        type="number"
                        step={10000}
                        value={udConfig.uDitchPricePerPcs}
                        onChange={(e) =>
                          onChangeConfig({
                            ...config,
                            scope: {
                              ...config.scope,
                              uditch: {
                                ...udConfig,
                                uDitchPricePerPcs: Number(e.target.value) || 0,
                              },
                            },
                          })
                        }
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-1 text-white font-mono text-right"
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* ================= STEP 2: 4M RESOURCE COMPONENTS (MACHINE) ================= */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
          <button
            onClick={() => toggleSection('machine')}
            className="w-full p-3 flex items-center justify-between text-left font-bold text-white hover:bg-slate-800/40 transition"
          >
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center font-mono text-[10px]">
                2
              </span>
              <Wrench className="w-3.5 h-3.5 text-amber-400" />
              <span>
                {isExcavation && 'Machine (Excavator & Dump Trucks)'}
                {isEmbankment && 'Machine (Vibro Roller & Bulldozer)'}
                {isRigidPavement && 'Machine (Concrete Pump & Transit Mixers)'}
                {isUDitch && 'Machine (Mobile Crane & Mini Excavator)'}
              </span>
            </div>
            {openSections.machine ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </button>

          {openSections.machine && (
            <div className="p-3 pt-0 space-y-3.5 border-t border-slate-800/60">
              {/* 2A. EXCAVATION MACHINERY */}
              {isExcavation && (
                <>
                  <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-amber-400 text-[11px]">
                        Excavator Fleet:
                      </span>
                      <div className="flex items-center gap-1.5">
                        {(['PC200', 'PC300'] as ExcavatorModel[]).map((m) => (
                          <button
                            key={m}
                            onClick={() =>
                              onChangeConfig({
                                ...config,
                                machine: { ...config.machine, excavatorModel: m },
                              })
                            }
                            className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold border ${
                              config.machine.excavatorModel === m
                                ? 'bg-amber-500 text-slate-950 border-amber-400'
                                : 'bg-slate-900 text-slate-400 border-slate-800'
                            }`}
                          >
                            {m}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <div>
                        <label className="text-slate-400 block mb-0.5">Excavator Units:</label>
                        <select
                          value={config.machine.excavatorCount}
                          onChange={(e) =>
                            onChangeConfig({
                              ...config,
                              machine: {
                                ...config.machine,
                                excavatorCount: Number(e.target.value),
                              },
                            })
                          }
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg p-1 text-white font-mono"
                        >
                          {[1, 2, 3, 4].map((n) => (
                            <option key={n} value={n}>
                              {n} Unit ({config.machine.excavatorModel})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-slate-400 block mb-0.5">Rental Rate (/hr):</label>
                        <input
                          type="number"
                          step={5000}
                          value={config.machine.excavatorRentalPerHour}
                          onChange={(e) =>
                            onChangeConfig({
                              ...config,
                              machine: {
                                ...config.machine,
                                excavatorRentalPerHour: Number(e.target.value),
                              },
                            })
                          }
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg p-1 text-white font-mono text-right"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sky-400 text-[11px]">
                        Dump Truck Fleet:
                      </span>
                      <div className="flex items-center gap-1.5">
                        {[8, 16].map((cap) => (
                          <button
                            key={cap}
                            onClick={() =>
                              onChangeConfig({
                                ...config,
                                machine: { ...config.machine, truckCapacityM3: cap },
                              })
                            }
                            className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold border ${
                              config.machine.truckCapacityM3 === cap
                                ? 'bg-sky-500 text-slate-950 border-sky-400'
                                : 'bg-slate-900 text-slate-400 border-slate-800'
                            }`}
                          >
                            {cap} m³
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-400">Fleet Count:</span>
                        <span className="font-mono font-bold text-sky-300">
                          {config.machine.truckCount} Units
                        </span>
                      </div>
                      <input
                        type="range"
                        min={1}
                        max={12}
                        step={1}
                        value={config.machine.truckCount}
                        onChange={(e) =>
                          onChangeConfig({
                            ...config,
                            machine: {
                              ...config.machine,
                              truckCount: Number(e.target.value),
                            },
                          })
                        }
                        className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* 2B. EMBANKMENT MACHINERY */}
              {isEmbankment && (
                <>
                  <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-amber-400 text-[11px]">
                        🚜 Vibratory Roller (10-12 Ton):
                      </span>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3].map((cnt) => (
                          <button
                            key={cnt}
                            onClick={() =>
                              onChangeConfig({
                                ...config,
                                scope: {
                                  ...config.scope,
                                  embankment: { ...embConfig, vibroRollerCount: cnt },
                                },
                              })
                            }
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                              embConfig.vibroRollerCount === cnt
                                ? 'bg-amber-500 text-slate-950'
                                : 'bg-slate-900 text-slate-400'
                            }`}
                          >
                            {cnt} Unit
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-slate-400">Sewa Alat (/jam):</span>
                      <input
                        type="number"
                        step={5000}
                        value={embConfig.vibroRollerRentalPerHour}
                        onChange={(e) =>
                          onChangeConfig({
                            ...config,
                            scope: {
                              ...config.scope,
                              embankment: {
                                ...embConfig,
                                vibroRollerRentalPerHour: Number(e.target.value),
                              },
                            },
                          })
                        }
                        className="w-28 bg-slate-900 border border-slate-700 rounded p-1 text-white font-mono text-right"
                      />
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sky-400 text-[11px]">
                        🚜 Bulldozer D65P (Spreading):
                      </span>
                      <div className="flex items-center gap-1">
                        {[1, 2].map((cnt) => (
                          <button
                            key={cnt}
                            onClick={() =>
                              onChangeConfig({
                                ...config,
                                scope: {
                                  ...config.scope,
                                  embankment: { ...embConfig, bulldozerCount: cnt },
                                },
                              })
                            }
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                              embConfig.bulldozerCount === cnt
                                ? 'bg-sky-500 text-slate-950'
                                : 'bg-slate-900 text-slate-400'
                            }`}
                          >
                            {cnt} Unit
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-slate-400">Sewa Bulldozer (/jam):</span>
                      <input
                        type="number"
                        step={5000}
                        value={embConfig.bulldozerRentalPerHour}
                        onChange={(e) =>
                          onChangeConfig({
                            ...config,
                            scope: {
                              ...config.scope,
                              embankment: {
                                ...embConfig,
                                bulldozerRentalPerHour: Number(e.target.value),
                              },
                            },
                          })
                        }
                        className="w-28 bg-slate-900 border border-slate-700 rounded p-1 text-white font-mono text-right"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* 2C. RIGID PAVEMENT MACHINERY */}
              {isRigidPavement && (
                <>
                  <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sky-400 text-[11px]">
                        🚛 Concrete Pump Truck:
                      </span>
                      <div className="flex items-center gap-1">
                        {[1, 2].map((cnt) => (
                          <button
                            key={cnt}
                            onClick={() =>
                              onChangeConfig({
                                ...config,
                                scope: {
                                  ...config.scope,
                                  rigidPavement: { ...rpConfig, concretePumpCount: cnt },
                                },
                              })
                            }
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                              rpConfig.concretePumpCount === cnt
                                ? 'bg-sky-500 text-slate-950'
                                : 'bg-slate-900 text-slate-400'
                            }`}
                          >
                            {cnt} Unit
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-slate-400">Sewa Pump (/jam):</span>
                      <input
                        type="number"
                        step={10000}
                        value={rpConfig.concretePumpRentalPerHour}
                        onChange={(e) =>
                          onChangeConfig({
                            ...config,
                            scope: {
                              ...config.scope,
                              rigidPavement: {
                                ...rpConfig,
                                concretePumpRentalPerHour: Number(e.target.value),
                              },
                            },
                          })
                        }
                        className="w-28 bg-slate-900 border border-slate-700 rounded p-1 text-white font-mono text-right"
                      />
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-amber-400 text-[11px]">
                        🚚 Transit Mixer Fleet:
                      </span>
                      <span className="font-mono text-white text-[11px]">
                        {rpConfig.transitMixerCount} Unit ({rpConfig.transitMixerCapacityM3} m³)
                      </span>
                    </div>
                    <input
                      type="range"
                      min={2}
                      max={14}
                      step={1}
                      value={rpConfig.transitMixerCount}
                      onChange={(e) =>
                        onChangeConfig({
                          ...config,
                          scope: {
                            ...config.scope,
                            rigidPavement: {
                              ...rpConfig,
                              transitMixerCount: Number(e.target.value),
                            },
                          },
                        })
                      }
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                    />
                  </div>
                </>
              )}

              {/* 2D. U-DITCH MACHINERY */}
              {isUDitch && (
                <>
                  <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-amber-400 text-[11px]">
                        🏗️ Mobile Crane 25 Ton:
                      </span>
                      <div className="flex items-center gap-1">
                        {[1, 2].map((cnt) => (
                          <button
                            key={cnt}
                            onClick={() =>
                              onChangeConfig({
                                ...config,
                                scope: {
                                  ...config.scope,
                                  uditch: { ...udConfig, mobileCraneCount: cnt },
                                },
                              })
                            }
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                              udConfig.mobileCraneCount === cnt
                                ? 'bg-amber-500 text-slate-950'
                                : 'bg-slate-900 text-slate-400'
                            }`}
                          >
                            {cnt} Unit
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-slate-400">Sewa Crane (/jam):</span>
                      <input
                        type="number"
                        step={10000}
                        value={udConfig.mobileCraneRentalPerHour}
                        onChange={(e) =>
                          onChangeConfig({
                            ...config,
                            scope: {
                              ...config.scope,
                              uditch: {
                                ...udConfig,
                                mobileCraneRentalPerHour: Number(e.target.value),
                              },
                            },
                          })
                        }
                        className="w-28 bg-slate-900 border border-slate-700 rounded p-1 text-white font-mono text-right"
                      />
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sky-400 text-[11px]">
                        🚜 Mini Excavator PC75 (Trimming Galian):
                      </span>
                      <span className="font-mono text-white text-[11px]">
                        {udConfig.miniExcavatorCount} Unit
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-slate-400">Sewa Mini Excavator (/jam):</span>
                      <input
                        type="number"
                        step={5000}
                        value={udConfig.miniExcavatorRentalPerHour}
                        onChange={(e) =>
                          onChangeConfig({
                            ...config,
                            scope: {
                              ...config.scope,
                              uditch: {
                                ...udConfig,
                                miniExcavatorRentalPerHour: Number(e.target.value),
                              },
                            },
                          })
                        }
                        className="w-28 bg-slate-900 border border-slate-700 rounded p-1 text-white font-mono text-right"
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* ================= STEP 3: MANPOWER & SITE CREW ================= */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
          <button
            onClick={() => toggleSection('manpower')}
            className="w-full p-3 flex items-center justify-between text-left font-bold text-white hover:bg-slate-800/40 transition"
          >
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-mono text-[10px]">
                3
              </span>
              <Users className="w-3.5 h-3.5 text-emerald-400" />
              <span>Manpower (Crew Cost & Headcount)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline-block font-mono text-[10px] bg-emerald-950/80 text-emerald-300 border border-emerald-800/80 px-2 py-0.5 rounded-full">
                {crewStats.total} Crew • {formatIDR(totalDailyCrewCost)}/d
              </span>
              {openSections.manpower ? (
                <ChevronUp className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              )}
            </div>
          </button>

          {openSections.manpower && (
            <div className="p-3 pt-0 space-y-2.5 border-t border-slate-800/60 text-[11px]">
              <div className="text-[10px] text-slate-400 bg-slate-950/50 p-2 rounded-xl border border-slate-800/80 flex items-center justify-between">
                <span>Total Active Site Crew:</span>
                <span className="font-mono font-bold text-emerald-300">
                  {crewStats.total} Persons on Site ({crewStats.summaryText})
                </span>
              </div>

              {/* Roles Breakdown */}
              <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-base">🚜</span>
                    <span className="font-semibold text-white">
                      Operator Peralatan ({crewStats.operators} Org)
                    </span>
                  </div>
                  <span className="font-mono text-sky-400 text-[10px]">Auto-Synced</span>
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-slate-400">Upah Operator / hari:</span>
                  <input
                    type="number"
                    step={5000}
                    value={config.manpower.operatorWage}
                    onChange={(e) =>
                      onChangeConfig({
                        ...config,
                        manpower: {
                          ...config.manpower,
                          operatorWage: Number(e.target.value) || 0,
                        },
                      })
                    }
                    className="w-24 bg-slate-900 border border-slate-700 rounded-lg p-1 text-white font-mono text-right"
                  />
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-base">👷</span>
                    <span className="font-semibold text-white">Mandor / Pengawas Lapangan</span>
                  </div>
                  <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800">
                    {[1, 2, 3].map((cnt) => (
                      <button
                        key={cnt}
                        onClick={() =>
                          onChangeConfig({
                            ...config,
                            manpower: { ...config.manpower, mandorCount: cnt },
                          })
                        }
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition ${
                          config.manpower.mandorCount === cnt
                            ? 'bg-emerald-500 text-slate-950'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {cnt}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-slate-400">Upah Mandor / hari:</span>
                  <input
                    type="number"
                    step={5000}
                    value={config.manpower.mandorWage}
                    onChange={(e) =>
                      onChangeConfig({
                        ...config,
                        manpower: {
                          ...config.manpower,
                          mandorWage: Number(e.target.value) || 0,
                        },
                      })
                    }
                    className="w-24 bg-slate-900 border border-slate-700 rounded-lg p-1 text-white font-mono text-right"
                  />
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-base">⛏️</span>
                    <div>
                      <span className="font-semibold text-white block">Pekerja / Helper</span>
                      <span className="text-[9px] text-slate-500 block">
                        Perapihan & Bantu Lapangan
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800">
                    {[1, 2, 3, 4, 6].map((cnt) => (
                      <button
                        key={cnt}
                        onClick={() =>
                          onChangeConfig({
                            ...config,
                            manpower: { ...config.manpower, helperCount: cnt },
                          })
                        }
                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition ${
                          config.manpower.helperCount === cnt
                            ? 'bg-amber-500 text-slate-950'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {cnt}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-slate-400">Upah Helper / hari:</span>
                  <input
                    type="number"
                    step={5000}
                    value={config.manpower.helperWage}
                    onChange={(e) =>
                      onChangeConfig({
                        ...config,
                        manpower: {
                          ...config.manpower,
                          helperWage: Number(e.target.value) || 0,
                        },
                      })
                    }
                    className="w-24 bg-slate-900 border border-slate-700 rounded-lg p-1 text-white font-mono text-right"
                  />
                </div>
              </div>

              {/* Total Manpower Summary Card */}
              <div className="p-3 bg-gradient-to-br from-emerald-950/60 to-slate-900 border border-emerald-800/80 rounded-xl space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-semibold">Total Daily Crew Cost:</span>
                  <span className="font-mono font-bold text-emerald-400 text-sm">
                    {formatIDR(totalDailyCrewCost)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                  <span>{crewStats.total} Orang Aktif</span>
                  <span>
                    {formatIDR(
                      Math.round(totalDailyCrewCost / config.method.workingHoursPerDay)
                    )}
                    /jam
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ================= STEP 4: MATERIAL & FUEL ================= */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
          <button
            onClick={() => toggleSection('fuel')}
            className="w-full p-3 flex items-center justify-between text-left font-bold text-white hover:bg-slate-800/40 transition"
          >
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-violet-500/20 text-violet-400 flex items-center justify-center font-mono text-[10px]">
                4
              </span>
              <Fuel className="w-3.5 h-3.5 text-violet-400" />
              <span>Material & Fuel (Bahan & BBM Solar)</span>
            </div>
            {openSections.fuel ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </button>

          {openSections.fuel && (
            <div className="p-3 pt-0 space-y-2.5 border-t border-slate-800/60 text-[10px]">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-400 block mb-0.5">Solar Industri (Rp/L):</label>
                  <input
                    type="number"
                    step={500}
                    value={config.materialFuel.fuelPricePerLiter}
                    onChange={(e) =>
                      onChangeConfig({
                        ...config,
                        materialFuel: {
                          ...config.materialFuel,
                          fuelPricePerLiter: Number(e.target.value),
                        },
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-1 text-white font-mono text-right"
                  />
                </div>

                {isExcavation && (
                  <div>
                    <label className="text-slate-400 block mb-0.5">Tipping Fee (Rp/rit):</label>
                    <input
                      type="number"
                      step={1000}
                      value={config.materialFuel.tippingFeePerRit}
                      onChange={(e) =>
                        onChangeConfig({
                          ...config,
                          materialFuel: {
                            ...config.materialFuel,
                            tippingFeePerRit: Number(e.target.value),
                          },
                        })
                      }
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-1 text-white font-mono text-right"
                    />
                  </div>
                )}

                {isEmbankment && (
                  <div>
                    <label className="text-slate-400 block mb-0.5">Air Bersih (Rp/m³):</label>
                    <input
                      type="number"
                      step={1000}
                      value={embConfig.waterPricePerM3}
                      onChange={(e) =>
                        onChangeConfig({
                          ...config,
                          scope: {
                            ...config.scope,
                            embankment: {
                              ...embConfig,
                              waterPricePerM3: Number(e.target.value),
                            },
                          },
                        })
                      }
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-1 text-white font-mono text-right"
                    />
                  </div>
                )}

                {isRigidPavement && (
                  <div>
                    <label className="text-slate-400 block mb-0.5">Harga Beton Ready-Mix (Rp/m³):</label>
                    <input
                      type="number"
                      step={25000}
                      value={rpConfig.concretePricePerM3}
                      onChange={(e) =>
                        onChangeConfig({
                          ...config,
                          scope: {
                            ...config.scope,
                            rigidPavement: {
                              ...rpConfig,
                              concretePricePerM3: Number(e.target.value),
                            },
                          },
                        })
                      }
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-1 text-white font-mono text-right"
                    />
                  </div>
                )}

                {isUDitch && (
                  <div>
                    <label className="text-slate-400 block mb-0.5">Pasir Bedding (Rp/m³):</label>
                    <input
                      type="number"
                      step={5000}
                      value={udConfig.sandPricePerM3}
                      onChange={(e) =>
                        onChangeConfig({
                          ...config,
                          scope: {
                            ...config.scope,
                            uditch: {
                              ...udConfig,
                              sandPricePerM3: Number(e.target.value),
                            },
                          },
                        })
                      }
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-1 text-white font-mono text-right"
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ================= STEP 5: METHOD & EFFICIENCY ================= */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
          <button
            onClick={() => toggleSection('method')}
            className="w-full p-3 flex items-center justify-between text-left font-bold text-white hover:bg-slate-800/40 transition"
          >
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-mono text-[10px]">
                5
              </span>
              <Clock className="w-3.5 h-3.5 text-blue-400" />
              <span>Method & Job Efficiency</span>
            </div>
            {openSections.method ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </button>

          {openSections.method && (
            <div className="p-3 pt-0 space-y-3 border-t border-slate-800/60">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1 font-medium">
                  Jam Kerja / Shift:
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { hours: 8, label: '8 Jam (1 Shift)' },
                    { hours: 14, label: '14 Jam (2 Shift)' },
                    { hours: 24, label: '24 Jam (Non-Stop)' },
                  ].map((s) => (
                    <button
                      key={s.hours}
                      onClick={() =>
                        onChangeConfig({
                          ...config,
                          method: {
                            ...config.method,
                            workingHoursPerDay: s.hours as 8 | 14 | 24,
                          },
                        })
                      }
                      className={`py-1.5 px-1 rounded-xl text-center text-[10px] font-semibold border transition ${
                        config.method.workingHoursPerDay === s.hours
                          ? 'bg-blue-500/20 text-blue-300 border-blue-500/50 shadow-sm'
                          : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:text-slate-200'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Efisiensi Kerja (E):</span>
                  <span className="font-mono font-bold text-white">
                    {config.method.efficiencyFactor.toFixed(2)} (
                    {config.method.efficiencyFactor >= 0.8
                      ? 'Baik'
                      : config.method.efficiencyFactor >= 0.7
                      ? 'Sedang'
                      : 'Kurang'}
                    )
                  </span>
                </div>
                <input
                  type="range"
                  min={0.5}
                  max={0.9}
                  step={0.02}
                  value={config.method.efficiencyFactor}
                  onChange={(e) =>
                    onChangeConfig({
                      ...config,
                      method: {
                        ...config.method,
                        efficiencyFactor: Number(e.target.value),
                      },
                    })
                  }
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* Real-Time Match Factor Preview Banner */}
        <div
          className={`p-3 rounded-2xl border transition-all ${
            metrics.matchFactorStatus === 'balanced'
              ? 'bg-emerald-950/40 border-emerald-800/80 text-emerald-200'
              : metrics.matchFactorStatus === 'under_trucked'
              ? 'bg-amber-950/50 border-amber-800/80 text-amber-200 animate-pulse'
              : 'bg-blue-950/50 border-blue-800/80 text-blue-200'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="font-bold flex items-center gap-1.5 text-xs">
              {metrics.matchFactorStatus === 'balanced' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-400" />
              )}
              <span>Fleet Match Factor: {metrics.matchFactor.toFixed(2)}</span>
            </span>
            <span className="font-mono text-[10px] uppercase font-bold">
              {metrics.matchFactorStatus.replace('_', ' ')}
            </span>
          </div>
          <p className="text-[11px] leading-relaxed text-slate-300">
            {metrics.matchFactorAdvice}
          </p>
        </div>
      </div>

      {/* Footer: Monte Carlo Trigger Action */}
      <div className="p-4 border-t border-slate-800/90 bg-slate-900/80 shrink-0 space-y-2">
        <button
          onClick={onRunMonteCarlo}
          className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 via-amber-600 to-sky-500 hover:from-amber-400 hover:to-sky-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-xl shadow-amber-500/20 transition transform active:scale-[0.98]"
        >
          <Sparkles className="w-4 h-4 fill-current" />
          <span>Run Monte Carlo Analysis (1,000 Runs)</span>
        </button>

        <div className="flex justify-between text-[10px] text-slate-400 font-mono px-1">
          <span>Est: {metrics.estimatedDurationDays} Hari Kerja</span>
          <span>
            HSP: {formatIDR(metrics.unitRatePerM3)} / {metrics.unitLabel}
          </span>
        </div>
      </div>
    </div>
  );
};
