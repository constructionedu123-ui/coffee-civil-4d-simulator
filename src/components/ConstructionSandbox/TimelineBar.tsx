import React, { useMemo } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Calendar,
  TrendingUp,
} from 'lucide-react';
import { GENERATED_S_CURVE } from './corridorData';
import { SCurvePoint } from './types';

interface TimelineBarProps {
  currentWeek: number;
  onWeekChange: (week: number) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  playbackSpeed: number;
  onChangeSpeed: (speed: number) => void;
  weatherDelayDays: number;
}

export const TimelineBar: React.FC<TimelineBarProps> = ({
  currentWeek,
  onWeekChange,
  isPlaying,
  onTogglePlay,
  playbackSpeed,
  onChangeSpeed,
  weatherDelayDays,
}) => {
  // Calendar date calculation: Project starts 6 January 2025
  const currentDate = useMemo(() => {
    const startDate = new Date(2025, 0, 6);
    const date = new Date(startDate.getTime() + (currentWeek - 1) * 7 * 24 * 60 * 60 * 1000);
    return date.toLocaleDateString('id-ID', {
      month: 'short',
      year: 'numeric',
    });
  }, [currentWeek]);

  // Current S-Curve Progress %
  const currentSCurve = useMemo<SCurvePoint>(() => {
    const pt = GENERATED_S_CURVE[currentWeek - 1];
    return pt || { week: currentWeek, plannedPercent: 0, actualPercent: 0 };
  }, [currentWeek]);

  // Determine current active milestone phase
  const currentPhase = useMemo(() => {
    if (currentWeek <= 24) return { label: 'Earthwork & Piling', color: 'from-amber-500 to-amber-700', icon: '🚜' };
    if (currentWeek <= 56) return { label: 'Substructure & Piers', color: 'from-blue-500 to-blue-700', icon: '🏛️' };
    if (currentWeek <= 86) return { label: 'Girder Launching', color: 'from-violet-500 to-violet-700', icon: '🏗️' };
    return { label: 'Paving & Handover', color: 'from-emerald-500 to-emerald-700', icon: '🛣️' };
  }, [currentWeek]);

  // S-Curve SVG Path Generator
  const sCurveSvgPath = useMemo(() => {
    const width = 1000;
    const height = 48;
    const points = GENERATED_S_CURVE;

    const plannedCoords = points.map((p) => {
      const x = ((p.week - 1) / 103) * width;
      const y = height - (p.plannedPercent / 100) * (height - 6) - 3;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

    const actualCoords = points.slice(0, currentWeek).map((p) => {
      const x = ((p.week - 1) / 103) * width;
      const y = height - (p.actualPercent / 100) * (height - 6) - 3;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

    return {
      plannedPath: `M ${plannedCoords.join(' L ')}`,
      actualPath: actualCoords.length > 0 ? `M ${actualCoords.join(' L ')}` : '',
    };
  }, [currentWeek]);

  return (
    <div className="bg-[#0b101b]/95 backdrop-blur-xl border-t border-slate-800/90 px-4 sm:px-6 py-3 flex flex-col gap-2.5 shadow-2xl relative z-20">
      {/* Top Meta Row: Playback Controls, Date, Milestones, S-Curve KPI */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Left: Play/Pause, Step, Speed */}
        <div className="flex items-center gap-2">
          {/* Play/Pause Button */}
          <button
            onClick={onTogglePlay}
            className={`flex items-center justify-center w-10 h-10 rounded-xl transition-all shadow-md ${
              isPlaying
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/25'
                : 'bg-sky-500 hover:bg-sky-400 text-slate-950 shadow-sky-500/25'
            }`}
            title={isPlaying ? 'Pause Simulation' : 'Play 4D Phasing Timeline'}
          >
            {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
          </button>

          {/* Step Back / Forward */}
          <button
            onClick={() => onWeekChange(Math.max(1, currentWeek - 1))}
            disabled={currentWeek <= 1}
            className="w-8 h-8 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 disabled:opacity-40 flex items-center justify-center transition"
            title="Previous Week"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => onWeekChange(Math.min(104, currentWeek + 1))}
            disabled={currentWeek >= 104}
            className="w-8 h-8 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 disabled:opacity-40 flex items-center justify-center transition"
            title="Next Week"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          {/* Reset */}
          <button
            onClick={() => onWeekChange(1)}
            className="w-8 h-8 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-slate-200 flex items-center justify-center transition"
            title="Reset to Week 1"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* Speed Pills */}
          <div className="hidden sm:flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5 ml-1">
            {[1, 2, 5, 10].map((s) => (
              <button
                key={s}
                onClick={() => onChangeSpeed(s)}
                className={`px-2 py-0.5 text-[11px] font-mono rounded font-semibold transition ${
                  playbackSpeed === s
                    ? 'bg-sky-500 text-slate-950'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {s}x
              </button>
            ))}
          </div>

          {/* Current Week & Calendar Readout */}
          <div className="flex items-center gap-2 ml-2 px-3 py-1 bg-slate-900/90 border border-slate-800 rounded-xl">
            <Calendar className="w-3.5 h-3.5 text-sky-400" />
            <div className="flex items-baseline gap-1.5 font-mono">
              <span className="text-sm font-bold text-white">Week {currentWeek}</span>
              <span className="text-[10px] text-slate-400">/ 104</span>
              <span className="text-[11px] text-sky-300 font-sans ml-1 font-semibold">({currentDate})</span>
            </div>
            <span className="hidden xl:inline-flex text-[10px] font-semibold text-sky-300 bg-sky-950/60 px-2 py-0.5 rounded-full border border-sky-800/80">
              {currentPhase.icon} {currentPhase.label}
            </span>
          </div>
        </div>

        {/* Center: Milestone Stage Badges */}
        <div className="hidden lg:flex items-center gap-1.5">
          <button
            onClick={() => onWeekChange(12)}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              currentWeek <= 24
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                : 'text-slate-500 hover:text-slate-300 bg-slate-900/40'
            }`}
          >
            <span>🚜</span> Earthwork
          </button>
          <span className="text-slate-600 text-xs">→</span>
          <button
            onClick={() => onWeekChange(42)}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              currentWeek > 24 && currentWeek <= 56
                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40 shadow-sm'
                : 'text-slate-500 hover:text-slate-300 bg-slate-900/40'
            }`}
          >
            <span>🏛️</span> Substructure
          </button>
          <span className="text-slate-600 text-xs">→</span>
          <button
            onClick={() => onWeekChange(70)}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              currentWeek > 56 && currentWeek <= 86
                ? 'bg-violet-500/20 text-violet-300 border border-violet-500/40 shadow-sm'
                : 'text-slate-500 hover:text-slate-300 bg-slate-900/40'
            }`}
          >
            <span>🏗️</span> Girder Launching
          </button>
          <span className="text-slate-600 text-xs">→</span>
          <button
            onClick={() => onWeekChange(96)}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              currentWeek > 86
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                : 'text-slate-500 hover:text-slate-300 bg-slate-900/40'
            }`}
          >
            <span>🛣️</span> Paving & Handover
          </button>
        </div>

        {/* Right: S-Curve Progress KPI */}
        <div className="flex items-center gap-3">
          {weatherDelayDays > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-amber-400 bg-amber-950/40 border border-amber-800/60 px-2.5 py-1 rounded-lg font-mono">
              <span>⚠️ Delay:</span>
              <span className="font-bold">+{weatherDelayDays}d</span>
            </div>
          )}

          <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-800 px-3 py-1 rounded-xl">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <div className="text-right">
              <div className="text-xs font-mono font-bold text-white">
                {currentSCurve.actualPercent.toFixed(1)}%
              </div>
              <div className="text-[10px] text-slate-400">
                Plan: {currentSCurve.plannedPercent.toFixed(1)}%
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* S-Curve Curve & Scrubbing Slider Container */}
      <div className="relative w-full pt-1 pb-1">
        {/* S-Curve SVG Overlay */}
        <div className="w-full h-12 relative overflow-hidden rounded-lg bg-slate-950/60 border border-slate-800/80 mb-1.5">
          <svg
            className="w-full h-full overflow-visible"
            viewBox="0 0 1000 48"
            preserveAspectRatio="none"
          >
            {/* Grid guide lines */}
            <line x1="0" y1="12" x2="1000" y2="12" stroke="#1e293b" strokeDasharray="3 3" strokeWidth="1" />
            <line x1="0" y1="24" x2="1000" y2="24" stroke="#1e293b" strokeDasharray="3 3" strokeWidth="1" />
            <line x1="0" y1="36" x2="1000" y2="36" stroke="#1e293b" strokeDasharray="3 3" strokeWidth="1" />

            {/* Planned S-Curve (Sky blue dashed) */}
            <path
              d={sCurveSvgPath.plannedPath}
              fill="none"
              stroke="#0284c7"
              strokeWidth="2"
              strokeDasharray="4 3"
              opacity="0.8"
            />

            {/* Actual S-Curve (Emerald solid with glow) */}
            {sCurveSvgPath.actualPath && (
              <path
                d={sCurveSvgPath.actualPath}
                fill="none"
                stroke="#10b981"
                strokeWidth="3"
              />
            )}

            {/* Vertical Progress Playhead */}
            <line
              x1={((currentWeek - 1) / 103) * 1000}
              y1="0"
              x2={((currentWeek - 1) / 103) * 1000}
              y2="48"
              stroke="#38bdf8"
              strokeWidth="2"
            />
          </svg>

          {/* S-Curve labels inside graph */}
          <div className="absolute top-1 left-2 text-[9px] font-mono text-slate-500 uppercase tracking-wider">
            Kurva-S Proyek Fisik (Planned vs Actual)
          </div>
          <div className="absolute bottom-1 right-2 text-[10px] font-mono text-slate-400">
            Target Selesai: 104 Minggu (Des 2026)
          </div>
        </div>

        {/* Master Timeline Input Range Slider */}
        <div className="relative flex items-center">
          <input
            type="range"
            min={1}
            max={104}
            step={1}
            value={currentWeek}
            onChange={(e) => onWeekChange(Number(e.target.value))}
            className="w-full h-2.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
          />
        </div>

        {/* Milestone Tick Marks below slider */}
        <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1 px-1">
          <span>Wk 1</span>
          <span className="hidden sm:inline">Wk 24 (Piling)</span>
          <span className="hidden md:inline">Wk 56 (Piers)</span>
          <span className="hidden sm:inline">Wk 86 (Girders)</span>
          <span>Wk 104 (Handover)</span>
        </div>
      </div>
    </div>
  );
};
