import React, { useState } from 'react';
import {
  Coffee,
  CloudRain,
  AlertTriangle,
  Sparkles,
  Info,
  HardHat,
  Layers,
  Activity,
} from 'lucide-react';
import { WeatherState, TelemetryData, CraneCollisionPair } from './types';
import { MILESTONES } from './corridorData';

interface SimulatorHeaderProps {
  currentWeek: number;
  weather: WeatherState;
  telemetry: TelemetryData;
  activeCameraPreset: string;
  onSelectCameraPreset: (preset: string) => void;
  onTriggerConfetti: () => void;
  collisionPairs: CraneCollisionPair[];
}

export const SimulatorHeader: React.FC<SimulatorHeaderProps> = ({
  currentWeek,
  weather,
  telemetry,
  activeCameraPreset,
  onSelectCameraPreset,
  onTriggerConfetti,
  collisionPairs,
}) => {
  const [showSpecsModal, setShowSpecsModal] = useState(false);

  // Active milestone
  const activeMilestone = [...MILESTONES]
    .reverse()
    .find((m) => currentWeek >= m.week) || MILESTONES[0];

  const presets = [
    { key: 'overview', label: 'Corridor 2.5km' },
    { key: 'river', label: 'River Span' },
    { key: 'batching', label: 'Batching Plant' },
    { key: 'cranes', label: 'Crane Zone' },
    { key: 'topdown', label: 'Top-down' },
  ];

  return (
    <header className="h-14 bg-[#070b14]/95 backdrop-blur-xl border-b border-slate-800/90 px-4 sm:px-6 flex items-center justify-between text-slate-100 z-30 shrink-0 select-none shadow-xl">
      {/* Left: Coffee Civil Brand & Simulator Title */}
      <div className="flex items-center gap-3">
        {/* Brand Icon Badge */}
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500/20 via-amber-600/30 to-sky-500/20 border border-amber-500/50 flex items-center justify-center shadow-lg shadow-amber-500/10 text-amber-400">
            <Coffee className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold tracking-tight text-white text-sm sm:text-base font-sans">
                Coffee Civil
              </span>
              <span className="hidden sm:inline-block text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                4D SIMULATOR
              </span>
            </div>
            <div className="hidden lg:flex items-center gap-1.5 text-[11px] text-slate-400">
              <span className="font-medium text-slate-300">
                4D Construction Phasing & Site Logistics Simulator
              </span>
              <span>•</span>
              <span className="text-slate-400">STA 12+450 – STA 14+950 (2.5 km Viaduct)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Center: Camera Presets Quick Switcher */}
      <div className="hidden md:flex items-center bg-slate-900/90 border border-slate-800 rounded-xl p-1 gap-1">
        {presets.map((p) => (
          <button
            key={p.key}
            onClick={() => onSelectCameraPreset(p.key)}
            className={`px-3 py-1 text-xs rounded-lg font-medium transition-all ${
              activeCameraPreset === p.key
                ? 'bg-sky-500 text-white shadow-sm shadow-sky-500/40 font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Right: Weather / Collision Indicators & Actions */}
      <div className="flex items-center gap-2.5">
        {/* Live Daily Pour Rate Telemetry Pill */}
        <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-900/80 border border-slate-800 text-xs">
          <Activity className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-slate-400 font-mono text-[11px]">
            {weather.isPouringSuspended ? (
              <span className="text-red-400 font-bold">POUR HALTED</span>
            ) : (
              <>
                <span className="text-white font-bold">{telemetry.dailyVolumePouredM3}</span>{' '}
                <span className="text-slate-500">m³/d</span>
              </>
            )}
          </span>
        </div>

        {/* Crane Conflict Pill */}
        {collisionPairs.length > 0 && (
          <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-950/70 border border-amber-500/60 text-amber-300 text-xs animate-pulse">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-semibold text-[11px]">Crane Conflict Active</span>
          </div>
        )}

        {/* Weather Indicator Pill */}
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-xs font-semibold transition-all ${
            weather.isPouringSuspended
              ? 'bg-red-950/80 border-red-500 text-red-200 animate-pulse shadow-md shadow-red-900/30'
              : weather.rainfallMmHour > 0
              ? 'bg-blue-950/70 border-blue-500/60 text-blue-200'
              : 'bg-slate-900/80 border-slate-800 text-emerald-400'
          }`}
        >
          <CloudRain className="w-3.5 h-3.5" />
          <span className="text-[11px]">
            {weather.isPouringSuspended
              ? 'POUR SUSPENDED'
              : weather.rainfallMmHour > 0
              ? `${weather.rainfallMmHour} mm/h`
              : 'Optimal Pour'}
          </span>
        </div>

        {/* Milestone Confetti Celebration Button */}
        <button
          onClick={onTriggerConfetti}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-gradient-to-r from-amber-500/20 to-sky-500/20 hover:from-amber-500/30 hover:to-sky-500/30 border border-amber-500/40 text-amber-300 text-xs font-semibold shadow-sm transition"
          title="Trigger Milestone & Handover Confetti Celebration"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span className="hidden sm:inline">Celebrate Handover</span>
        </button>

        {/* Project Specs Modal Toggle */}
        <button
          onClick={() => setShowSpecsModal(true)}
          className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition"
          title="Project Structural Specifications"
        >
          <Info className="w-4 h-4" />
        </button>
      </div>

      {/* Civil Engineering Specifications Modal */}
      {showSpecsModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#0d1322] border border-slate-700/80 rounded-2xl p-6 shadow-2xl text-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <HardHat className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-white text-base">
                  Civil Engineering Project Specifications
                </h3>
              </div>
              <button
                onClick={() => setShowSpecsModal(false)}
                className="text-slate-400 hover:text-white text-sm px-2 py-1 rounded-lg bg-slate-800"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3">
                <span className="text-slate-400">Total Corridor Length:</span>
                <p className="font-mono font-bold text-white text-sm mt-0.5">2,500 Meters (2.5 km)</p>
                <span className="text-[10px] text-slate-500">25 Piers • 24 Bridge Spans</span>
              </div>

              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3">
                <span className="text-slate-400">Deep River Crossing:</span>
                <p className="font-mono font-bold text-sky-400 text-sm mt-0.5">Cisadane River Valley</p>
                <span className="text-[10px] text-slate-500">Piers P12–P14 • 16m Clear Height</span>
              </div>

              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3">
                <span className="text-slate-400">Concrete Strength Grades:</span>
                <p className="font-mono font-semibold text-white mt-0.5">f'c 30 – 50 MPa (K-350 to K-600)</p>
                <span className="text-[10px] text-slate-500">SNI 7656:2012 / ACI 211 Standards</span>
              </div>

              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3">
                <span className="text-slate-400">Seismic Design Standard:</span>
                <p className="font-mono font-semibold text-white mt-0.5">SNI 2833:2016 Zone 4</p>
                <span className="text-[10px] text-slate-500">PGA 0.45g • Lead Rubber Bearings</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3">
                <span className="text-slate-400">Total Concrete Poured:</span>
                <p className="font-mono font-bold text-emerald-400 text-sm mt-0.5">{telemetry.totalPouredCorridorM3.toLocaleString()} m³</p>
                <span className="text-[10px] text-slate-500">Across 25 piers to date</span>
              </div>
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3">
                <span className="text-slate-400">Structural Rebar Placed:</span>
                <p className="font-mono font-bold text-amber-400 text-sm mt-0.5">{telemetry.totalSteelTons.toLocaleString()} Tons</p>
                <span className="text-[10px] text-slate-500">High-yield deform steel</span>
              </div>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 space-y-1.5 text-xs">
              <div className="font-semibold text-amber-300 flex items-center gap-1.5">
                <Layers className="w-4 h-4" />
                <span>Current Corridor Phasing Status</span>
              </div>
              <p className="text-slate-300">
                <strong className="text-white">Week {currentWeek} of 104:</strong> {activeMilestone.title} ({activeMilestone.phase.toUpperCase()}).
              </p>
              <p className="text-slate-400 text-[11px]">
                {activeMilestone.description}
              </p>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowSpecsModal(false)}
                className="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs rounded-xl transition"
              >
                Close Specifications
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
