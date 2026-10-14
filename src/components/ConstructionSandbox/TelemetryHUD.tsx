import React from 'react';
import {
  Truck,
  Activity,
  Timer,
  Gauge,
  AlertTriangle,
  Radio,
} from 'lucide-react';
import { TelemetryData, WeatherState, CraneCollisionPair } from './types';

interface TelemetryHUDProps {
  telemetry: TelemetryData;
  weather: WeatherState;
  showCraneCoverage: boolean;
  onToggleCraneCoverage: () => void;
  showFleetAnimation: boolean;
  onToggleFleetAnimation: () => void;
  collisionPairs: CraneCollisionPair[];
}

export const TelemetryHUD: React.FC<TelemetryHUDProps> = ({
  telemetry,
  weather,
  showCraneCoverage,
  onToggleCraneCoverage,
  showFleetAnimation,
  onToggleFleetAnimation,
  collisionPairs,
}) => {
  return (
    <div className="absolute top-4 left-4 z-10 flex flex-col gap-2 max-w-sm pointer-events-auto">
      {/* Primary Telemetry Bar Container */}
      <div className="bg-[#0f172a]/95 backdrop-blur-xl border border-slate-800 rounded-2xl p-3.5 shadow-2xl space-y-3">
        {/* Section Header */}
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              Site Logistics & Telemetry
            </span>
          </div>
          <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-sky-400 border border-slate-700">
            LIVE IOT FEED
          </span>
        </div>

        {/* 3 Core Telemetry KPIs */}
        <div className="grid grid-cols-3 gap-2">
          {/* 1. Daily Volume Poured */}
          <div className="bg-slate-900/90 border border-slate-800/90 rounded-xl p-2.5 flex flex-col">
            <div className="flex items-center gap-1 text-[10px] text-slate-400 mb-1">
              <Radio className="w-3 h-3 text-sky-400" />
              <span>Volume</span>
            </div>
            <div className="text-sm sm:text-base font-mono font-bold text-white tabular-nums">
              {weather.isPouringSuspended ? (
                <span className="text-red-400 text-xs font-semibold">HALTED</span>
              ) : (
                <>
                  {telemetry.dailyVolumePouredM3} <span className="text-[10px] text-slate-400 font-sans font-normal">m³/d</span>
                </>
              )}
            </div>
            <span className="text-[9px] text-slate-500 mt-0.5">Target: 350 m³</span>
          </div>

          {/* 2. Fleet Cycle Time */}
          <div className="bg-slate-900/90 border border-slate-800/90 rounded-xl p-2.5 flex flex-col">
            <div className="flex items-center gap-1 text-[10px] text-slate-400 mb-1">
              <Timer className="w-3 h-3 text-amber-400" />
              <span>Cycle</span>
            </div>
            <div className="text-sm sm:text-base font-mono font-bold text-white tabular-nums">
              {telemetry.fleetCycleTimeMins} <span className="text-[10px] text-slate-400 font-sans font-normal">min</span>
            </div>
            <span className="text-[9px] text-slate-500 mt-0.5">Round trip</span>
          </div>

          {/* 3. Equipment Utilization Rate */}
          <div className="bg-slate-900/90 border border-slate-800/90 rounded-xl p-2.5 flex flex-col">
            <div className="flex items-center gap-1 text-[10px] text-slate-400 mb-1">
              <Gauge className="w-3 h-3 text-emerald-400" />
              <span>Util.</span>
            </div>
            <div className="text-sm sm:text-base font-mono font-bold text-white tabular-nums">
              {weather.isPouringSuspended ? (
                <span className="text-amber-400 text-xs">22.4%</span>
              ) : (
                `${telemetry.equipmentUtilizationRate.toFixed(1)}%`
              )}
            </div>
            <span className="text-[9px] text-emerald-400 mt-0.5">Optimal</span>
          </div>
        </div>

        {/* Concrete Fleet & Equipment Layer Toggles */}
        <div className="pt-1 border-t border-slate-800/80 flex items-center justify-between gap-2 text-xs">
          {/* Toggle Crane Radiuses */}
          <button
            onClick={onToggleCraneCoverage}
            className={`flex-1 px-2.5 py-1.5 rounded-xl border text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-all ${
              showCraneCoverage
                ? 'bg-sky-500/20 text-sky-300 border-sky-500/50 shadow-sm'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
            title="Toggle 360° Site Crane Radiuses & Collision Detection"
          >
            <span>🏗️</span>
            <span>Crane Radiuses</span>
          </button>

          {/* Toggle Fleet Animation */}
          <button
            onClick={onToggleFleetAnimation}
            className={`flex-1 px-2.5 py-1.5 rounded-xl border text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-all ${
              showFleetAnimation
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-sm'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
            title="Toggle Animated Concrete Transit Mixers on Site"
          >
            <Truck className="w-3.5 h-3.5" />
            <span>Mixer Fleet</span>
          </button>
        </div>

        {/* Active Heavy Machinery Counts */}
        <div className="bg-slate-950/70 rounded-xl p-2 flex items-center justify-between text-[11px] text-slate-400 font-mono">
          <div>Cranes: <span className="text-white font-bold">{telemetry.activeCranesCount}</span></div>
          <div>Mixers: <span className="text-white font-bold">{telemetry.activeMixersCount}</span></div>
          <div>Pumps: <span className="text-white font-bold">2</span></div>
          <div>Gantry: <span className="text-white font-bold">1</span></div>
        </div>

        {/* Crane Overlap Alert Badge */}
        {collisionPairs.length > 0 && showCraneCoverage && (
          <div className="bg-amber-950/40 border border-amber-800/60 rounded-xl px-2.5 py-1.5 flex items-center justify-between text-[10px] text-amber-300">
            <span className="flex items-center gap-1 font-semibold">
              <AlertTriangle className="w-3 h-3 text-amber-400" />
              <span>Collision Overlap:</span>
            </span>
            <span className="font-mono font-bold text-amber-200">{collisionPairs.length} Zone Detected</span>
          </div>
        )}
      </div>
    </div>
  );
};
