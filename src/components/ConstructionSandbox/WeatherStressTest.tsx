import React from 'react';
import {
  CloudRain,
  AlertOctagon,
  ShieldAlert,
  Umbrella,
  Info,
} from 'lucide-react';
import { WeatherState } from './types';

interface WeatherStressTestProps {
  weather: WeatherState;
  onRainfallChange: (val: number) => void;
  isOpen: boolean;
  onToggleOpen: () => void;
}

export const WeatherStressTest: React.FC<WeatherStressTestProps> = ({
  weather,
  onRainfallChange,
  isOpen,
  onToggleOpen,
}) => {
  const rain = weather.rainfallMmHour;
  const isSuspended = weather.isPouringSuspended;

  // Rain classification
  const getRainCategory = (mm: number) => {
    if (mm === 0) return { label: 'Dry & Clear', color: 'text-emerald-400', badge: 'bg-emerald-950/60 border-emerald-800' };
    if (mm <= 10) return { label: 'Light Drizzle', color: 'text-sky-400', badge: 'bg-sky-950/60 border-sky-800' };
    if (mm <= 20) return { label: 'Moderate Rain', color: 'text-blue-400', badge: 'bg-blue-950/60 border-blue-800' };
    if (mm <= 45) return { label: 'Heavy Downpour (POUR SUSPENDED)', color: 'text-amber-400', badge: 'bg-amber-950/80 border-amber-700 animate-pulse' };
    return { label: 'Tropical Storm / Extreme (CRITICAL)', color: 'text-red-400', badge: 'bg-red-950/90 border-red-600 animate-pulse' };
  };

  const category = getRainCategory(rain);

  return (
    <>
      {/* Weather Launcher Button (Floating Top Right) */}
      <div className="absolute top-4 right-4 z-10 flex flex-col items-end gap-2 pointer-events-auto">
        <button
          onClick={onToggleOpen}
          className={`flex items-center gap-2 px-3 py-2 rounded-2xl border text-xs font-semibold shadow-2xl backdrop-blur-xl transition-all ${
            isSuspended
              ? 'bg-red-950/90 border-red-500 text-red-200 shadow-red-900/40 animate-pulse'
              : rain > 0
              ? 'bg-blue-950/90 border-blue-500 text-blue-200'
              : 'bg-[#0f172a]/90 hover:bg-slate-800 border-slate-800 text-slate-300 hover:text-white'
          }`}
          title="Open Weather & Pour Quality Stress-Test Panel"
        >
          <CloudRain className={`w-4 h-4 ${isSuspended ? 'text-red-400 animate-bounce' : 'text-sky-400'}`} />
          <span>Weather Stress-Test:</span>
          <span className="font-mono font-bold text-white">{rain} mm/h</span>
        </button>

        {/* Collapsible Weather Stress-Test Card */}
        {isOpen && (
          <div className="w-80 sm:w-96 bg-[#0f172a]/95 backdrop-blur-xl border border-slate-800 rounded-2xl p-4 shadow-2xl space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
              <div className="flex items-center gap-2">
                <Umbrella className="w-4 h-4 text-sky-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Rainfall & Quality Stress-Test
                </h3>
              </div>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${category.badge} ${category.color}`}>
                {category.label}
              </span>
            </div>

            {/* Rainfall Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Precipitation Intensity:</span>
                <span className="font-mono font-bold text-sky-300 text-sm">{rain} mm/hour</span>
              </div>
              <input
                type="range"
                min={0}
                max={80}
                step={1}
                value={rain}
                onChange={(e) => onRainfallChange(Number(e.target.value))}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
              />

              {/* Quick Presets */}
              <div className="flex items-center justify-between gap-1 pt-1">
                {[
                  { label: 'Dry (0)', val: 0 },
                  { label: 'Mod (12)', val: 12 },
                  { label: 'Pour Limit (20)', val: 20 },
                  { label: 'Storm (45)', val: 45 },
                  { label: 'Max (80)', val: 80 },
                ].map((p) => (
                  <button
                    key={p.val}
                    onClick={() => onRainfallChange(p.val)}
                    className={`px-2 py-1 text-[10px] font-mono rounded-lg border transition ${
                      rain === p.val
                        ? 'bg-sky-500/20 text-sky-300 border-sky-500/60 font-bold'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Quality Standard Note */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-2.5 text-[11px] text-slate-400 space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-slate-300">
                <Info className="w-3.5 h-3.5 text-sky-400" />
                <span>SNI 2847 / ACI 305 Pouring Criterion</span>
              </div>
              <p className="text-[10px] leading-relaxed text-slate-400">
                Maximum allowable continuous rain intensity for structural concrete pours is <strong>20 mm/hr</strong>.
                Beyond 20 mm/hr, active pours must halt to prevent wash-out of cement paste and uncontrolled w/c ratio rise.
              </p>
            </div>

            {/* Simulated Weather Delay Impact */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between">
              <div>
                <div className="text-[10px] text-slate-400">Simulated Project Delay:</div>
                <div className="text-xs font-mono font-bold text-amber-300">
                  +{weather.cumulativeDelayDays} Days Added
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-slate-400">Pour Status:</div>
                <div className={`text-xs font-bold ${isSuspended ? 'text-red-400 animate-pulse' : 'text-emerald-400'}`}>
                  {isSuspended ? 'FROZEN / STOPPED' : 'ACTIVE & CLEAR'}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* EMERGENCY SAFETY ALERT MODAL BANNER WHEN RAIN > 20 mm/hr */}
      {isSuspended && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 pointer-events-auto max-w-xl w-[92%] animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="bg-red-950/95 backdrop-blur-xl border-2 border-red-500/90 rounded-2xl p-4 shadow-2xl text-red-100 flex flex-col gap-2.5">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-red-900/80 border border-red-700 flex items-center justify-center shrink-0">
                <AlertOctagon className="w-5 h-5 text-red-400 animate-pulse" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-red-200 tracking-tight">
                    Pouring Suspended: High rain risk to water-cement ratio (w/c)
                  </h4>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-red-900 border border-red-700 text-red-300 font-bold">
                    STOP POUR ORDER
                  </span>
                </div>
                <p className="text-xs text-red-300/90 mt-1 leading-relaxed">
                  Rainfall is currently <strong>{rain} mm/hour</strong> (threshold: 20 mm/hr). Concrete pumps are frozen.
                  Mitigation protocol activated: Deploying curing tarpaulins, pausing transit-mixer discharge, and logging weather delay.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-red-800/80 text-[11px] text-red-300/80">
              <div className="flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
                <span>Cold-joint mitigation & tarpaulin protocol verified</span>
              </div>
              <button
                onClick={() => onRainfallChange(15)}
                className="px-3 py-1 bg-red-900/90 hover:bg-red-800 text-white rounded-lg font-semibold text-xs transition"
              >
                Reduce Rain to 15 mm/h
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
