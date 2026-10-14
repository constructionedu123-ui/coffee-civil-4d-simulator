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

  // Dynamic Manpower Calculations
  const totalDailyCrewCost = calculateTotalDailyCrewCost(config);
  const crewStats = calculateTotalCrewHeadcount(config);

  // Quick Preset Handlers
  const applyPreset = (presetName: string) => {
    if (presetName === 'urban') {
      onChangeConfig({
        ...config,
        scope: {
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
    } else if (presetName === 'highway') {
      onChangeConfig({
        ...config,
        scope: {
          activity: 'excavation',
          volumeM3: 8000,
          materialType: 'tanah_keras',
          haulDistanceKm: 7.5,
        },
        machine: {
          ...config.machine,
          excavatorModel: 'PC300',
          excavatorCount: 2,
          truckCapacityM3: 16,
          truckCount: 9,
        },
        method: {
          ...config.method,
          workingHoursPerDay: 14,
          efficiencyFactor: 0.82,
        },
      });
    } else if (presetName === 'pier') {
      onChangeConfig({
        ...config,
        scope: {
          activity: 'excavation',
          volumeM3: 3200,
          materialType: 'lempung_basah',
          haulDistanceKm: 3.0,
        },
        machine: {
          ...config.machine,
          excavatorModel: 'PC200',
          excavatorCount: 1,
          truckCapacityM3: 8,
          truckCount: 4,
        },
        method: {
          ...config.method,
          workingHoursPerDay: 8,
          efficiencyFactor: 0.7,
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

      {/* Quick Project Presets Bar */}
      <div className="px-4 py-2 bg-slate-950/60 border-b border-slate-800/80 flex items-center gap-1.5 overflow-x-auto text-[11px] shrink-0">
        <span className="text-slate-500 font-medium shrink-0">Presets:</span>
        <button
          onClick={() => applyPreset('urban')}
          className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 whitespace-nowrap transition"
        >
          Urban (1.2k m³)
        </button>
        <button
          onClick={() => applyPreset('highway')}
          className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 whitespace-nowrap transition"
        >
          Highway (8k m³)
        </button>
        <button
          onClick={() => applyPreset('pier')}
          className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 whitespace-nowrap transition"
        >
          River Pier (3.2k m³)
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
              <span>Project Scope & Volume</span>
            </div>
            {openSections.scope ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </button>

          {openSections.scope && (
            <div className="p-3 pt-0 space-y-3 border-t border-slate-800/60">
              {/* Work Activity */}
              <div>
                <label className="text-[11px] text-slate-400 block mb-1 font-medium">Work Activity:</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    [
                      { id: 'excavation', label: 'Earth Excavation' },
                      { id: 'embankment', label: 'Embankment Fill' },
                      { id: 'concrete', label: 'Concrete Pour' },
                    ] as { id: WorkActivity; label: string }[]
                  ).map((act) => (
                    <button
                      key={act.id}
                      onClick={() =>
                        onChangeConfig({
                          ...config,
                          scope: { ...config.scope, activity: act.id },
                        })
                      }
                      className={`py-1.5 px-2 rounded-xl text-center text-[10px] font-semibold border transition ${
                        config.scope.activity === act.id
                          ? 'bg-sky-500/20 text-sky-300 border-sky-500/50 shadow-sm'
                          : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:text-slate-200'
                      }`}
                    >
                      {act.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Work Volume Input + Slider */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] text-slate-400 font-medium">Work Volume (m³):</label>
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
                            volumeM3: Math.max(50, Math.min(25000, Number(e.target.value) || 100)),
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

                {/* Quick Volume Pills */}
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

              {/* Soil / Material Type */}
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
                      <div className="font-semibold text-[10px] leading-tight">{soil.label}</div>
                      <div className="text-[9px] opacity-75 font-mono">{soil.sf}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Haul Distance Slider */}
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
                      scope: { ...config.scope, haulDistanceKm: Number(e.target.value) },
                    })
                  }
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* ================= STEP 2: 4M RESOURCE COMPONENTS ================= */}

        {/* 1. MACHINE (ALAT BERAT) */}
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
              <span>Machine (Excavator & Trucks)</span>
            </div>
            {openSections.machine ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </button>

          {openSections.machine && (
            <div className="p-3 pt-0 space-y-3.5 border-t border-slate-800/60">
              {/* Excavator Configuration */}
              <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-amber-400 text-[11px]">Excavator Fleet:</span>
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
                          machine: { ...config.machine, excavatorCount: Number(e.target.value) },
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

              {/* Dump Truck Fleet Configuration */}
              <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sky-400 text-[11px]">Dump Truck Fleet:</span>
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

                {/* Truck Count Slider */}
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
                        machine: { ...config.machine, truckCount: Number(e.target.value) },
                      })
                    }
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div>
                    <label className="text-slate-400 block mb-0.5">Rental (/hr/unit):</label>
                    <input
                      type="number"
                      step={5000}
                      value={config.machine.truckRentalPerHour}
                      onChange={(e) =>
                        onChangeConfig({
                          ...config,
                          machine: {
                            ...config.machine,
                            truckRentalPerHour: Number(e.target.value),
                          },
                        })
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-1 text-white font-mono text-right"
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-0.5">Speed Loaded / Empty:</label>
                    <div className="flex gap-1 font-mono">
                      <input
                        type="number"
                        value={config.machine.speedLoadedKmH}
                        onChange={(e) =>
                          onChangeConfig({
                            ...config,
                            machine: {
                              ...config.machine,
                              speedLoadedKmH: Number(e.target.value),
                            },
                          })
                        }
                        className="w-1/2 bg-slate-900 border border-slate-700 rounded-lg p-1 text-white text-center"
                        title="Speed Loaded (km/h)"
                      />
                      <input
                        type="number"
                        value={config.machine.speedEmptyKmH}
                        onChange={(e) =>
                          onChangeConfig({
                            ...config,
                            machine: {
                              ...config.machine,
                              speedEmptyKmH: Number(e.target.value),
                            },
                          })
                        }
                        className="w-1/2 bg-slate-900 border border-slate-700 rounded-lg p-1 text-white text-center"
                        title="Speed Empty (km/h)"
                      />
                    </div>
                  </div>
                </div>
              </div>
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
              {openSections.manpower ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </div>
          </button>

          {openSections.manpower && (
            <div className="p-3 pt-0 space-y-2.5 border-t border-slate-800/60 text-[11px]">
              <div className="text-[10px] text-slate-400 bg-slate-950/50 p-2 rounded-xl border border-slate-800/80 flex items-center justify-between">
                <span>Total Active Site Crew:</span>
                <span className="font-mono font-bold text-emerald-300">{crewStats.total} Persons on Site</span>
              </div>

              {/* 1. Heavy Equipment Operators (Auto-synced with Excavator Units) */}
              <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-base">🚜</span>
                    <span className="font-semibold text-white">Operator Alat Berat</span>
                  </div>
                  <span className="font-mono font-bold text-sky-400 bg-sky-950/80 border border-sky-800/80 text-[10px] px-2 py-0.5 rounded-md">
                    {config.machine.excavatorCount} Orang (Auto-Sync)
                  </span>
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-slate-400">Upah Harian:</span>
                  <div className="flex items-center gap-1">
                    <span className="text-slate-500">Rp</span>
                    <input
                      type="number"
                      step={5000}
                      value={config.manpower.operatorWage}
                      onChange={(e) =>
                        onChangeConfig({
                          ...config,
                          manpower: { ...config.manpower, operatorWage: Number(e.target.value) || 0 },
                        })
                      }
                      className="w-24 bg-slate-900 border border-slate-700 rounded-lg p-1 text-white font-mono text-right"
                    />
                    <span className="text-slate-500">/ hari</span>
                  </div>
                </div>
                <div className="text-[9px] text-slate-500 text-right font-mono">
                  Subtotal: {formatIDR(config.machine.excavatorCount * config.manpower.operatorWage)} / hari
                </div>
              </div>

              {/* 2. Dump Truck Drivers (Auto-synced with Truck Fleet) */}
              <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-base">🚛</span>
                    <span className="font-semibold text-white">Driver Dump Truck</span>
                  </div>
                  <span className="font-mono font-bold text-sky-400 bg-sky-950/80 border border-sky-800/80 text-[10px] px-2 py-0.5 rounded-md">
                    {config.machine.truckCount} Orang (Auto-Sync)
                  </span>
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-slate-400">Upah Harian:</span>
                  <div className="flex items-center gap-1">
                    <span className="text-slate-500">Rp</span>
                    <input
                      type="number"
                      step={5000}
                      value={config.manpower.driverWage}
                      onChange={(e) =>
                        onChangeConfig({
                          ...config,
                          manpower: { ...config.manpower, driverWage: Number(e.target.value) || 0 },
                        })
                      }
                      className="w-24 bg-slate-900 border border-slate-700 rounded-lg p-1 text-white font-mono text-right"
                    />
                    <span className="text-slate-500">/ hari</span>
                  </div>
                </div>
                <div className="text-[9px] text-slate-500 text-right font-mono">
                  Subtotal: {formatIDR(config.machine.truckCount * config.manpower.driverWage)} / hari
                </div>
              </div>

              {/* 3. Mandor / Field Supervisor */}
              <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-base">👷</span>
                    <span className="font-semibold text-white">Mandor / Pengawas</span>
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
                  <span className="text-slate-400">Upah Harian:</span>
                  <div className="flex items-center gap-1">
                    <span className="text-slate-500">Rp</span>
                    <input
                      type="number"
                      step={5000}
                      value={config.manpower.mandorWage}
                      onChange={(e) =>
                        onChangeConfig({
                          ...config,
                          manpower: { ...config.manpower, mandorWage: Number(e.target.value) || 0 },
                        })
                      }
                      className="w-24 bg-slate-900 border border-slate-700 rounded-lg p-1 text-white font-mono text-right"
                    />
                    <span className="text-slate-500">/ hari</span>
                  </div>
                </div>
                <div className="text-[9px] text-slate-500 text-right font-mono">
                  Subtotal: {formatIDR(config.manpower.mandorCount * config.manpower.mandorWage)} / hari
                </div>
              </div>

              {/* 4. Spotters / Flagmen (Traffic & K3) */}
              <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-base">🦺</span>
                    <div>
                      <span className="font-semibold text-white block">Spotter / Flagman</span>
                      <span className="text-[9px] text-slate-500 block">Traffic Pit & Haul Ramp K3</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800">
                    {[1, 2, 3, 4].map((cnt) => (
                      <button
                        key={cnt}
                        onClick={() =>
                          onChangeConfig({
                            ...config,
                            manpower: { ...config.manpower, spotterCount: cnt },
                          })
                        }
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition ${
                          config.manpower.spotterCount === cnt
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
                  <span className="text-slate-400">Upah Harian:</span>
                  <div className="flex items-center gap-1">
                    <span className="text-slate-500">Rp</span>
                    <input
                      type="number"
                      step={5000}
                      value={config.manpower.spotterWage}
                      onChange={(e) =>
                        onChangeConfig({
                          ...config,
                          manpower: { ...config.manpower, spotterWage: Number(e.target.value) || 0 },
                        })
                      }
                      className="w-24 bg-slate-900 border border-slate-700 rounded-lg p-1 text-white font-mono text-right"
                    />
                    <span className="text-slate-500">/ hari</span>
                  </div>
                </div>
                <div className="text-[9px] text-slate-500 text-right font-mono">
                  Subtotal: {formatIDR(config.manpower.spotterCount * config.manpower.spotterWage)} / hari
                </div>
              </div>

              {/* 5. Pekerja / General Helpers */}
              <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-base">⛏️</span>
                    <div>
                      <span className="font-semibold text-white block">Pekerja / Helper</span>
                      <span className="text-[9px] text-slate-500 block">Manual Trimming & Pit Cleanup</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800">
                    {[0, 1, 2, 3, 4, 6].map((cnt) => (
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
                  <span className="text-slate-400">Upah Harian:</span>
                  <div className="flex items-center gap-1">
                    <span className="text-slate-500">Rp</span>
                    <input
                      type="number"
                      step={5000}
                      value={config.manpower.helperWage}
                      onChange={(e) =>
                        onChangeConfig({
                          ...config,
                          manpower: { ...config.manpower, helperWage: Number(e.target.value) || 0 },
                        })
                      }
                      className="w-24 bg-slate-900 border border-slate-700 rounded-lg p-1 text-white font-mono text-right"
                    />
                    <span className="text-slate-500">/ hari</span>
                  </div>
                </div>
                <div className="text-[9px] text-slate-500 text-right font-mono">
                  Subtotal: {formatIDR(config.manpower.helperCount * config.manpower.helperWage)} / hari
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
                  <span>Active Crew: {crewStats.total} Persons ({crewStats.summaryText})</span>
                  <span>{formatIDR(Math.round(totalDailyCrewCost / config.method.workingHoursPerDay))}/hr</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 3. MATERIAL & FUEL (BBM & PEMBUANGAN) */}
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
              <span>Material & Fuel (Solar & Disposal)</span>
            </div>
            {openSections.fuel ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
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
              </div>
            </div>
          )}
        </div>

        {/* 4. METHOD & EFFICIENCY */}
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
            {openSections.method ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </button>

          {openSections.method && (
            <div className="p-3 pt-0 space-y-3 border-t border-slate-800/60">
              {/* Working Hours */}
              <div>
                <label className="text-[11px] text-slate-400 block mb-1 font-medium">
                  Working Hours / Shift:
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { hours: 8, label: '8h (1 Shift)' },
                    { hours: 14, label: '14h (2 Shifts)' },
                    { hours: 24, label: '24h (Non-Stop)' },
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

              {/* Efficiency Factor E */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Site Efficiency (E):</span>
                  <span className="font-mono font-bold text-white">
                    {config.method.efficiencyFactor.toFixed(2)} ({config.method.efficiencyFactor >= 0.8 ? 'Good' : config.method.efficiencyFactor >= 0.7 ? 'Fair' : 'Poor'})
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
          <span>Est: {metrics.estimatedDurationDays} Days</span>
          <span>Unit: {formatIDR(metrics.unitRatePerM3)} / m³</span>
        </div>
      </div>
    </div>
  );
};
