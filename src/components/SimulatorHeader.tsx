import React, { useState } from 'react';
import {
  Coffee,
  Sparkles,
  TrendingUp,
  Info,
  HardHat,
  Truck,
  Layers,
} from 'lucide-react';
import { SimulatorConfig, ProductivityMetrics } from '../types/simulator';

interface SimulatorHeaderProps {
  config: SimulatorConfig;
  metrics: ProductivityMetrics;
  onOpenMonteCarlo: () => void;
  onTriggerConfetti: () => void;
}

export const SimulatorHeader: React.FC<SimulatorHeaderProps> = ({
  config,
  metrics,
  onOpenMonteCarlo,
  onTriggerConfetti,
}) => {
  const [showSpecsModal, setShowSpecsModal] = useState(false);

  // Format IDR currency
  const formatIDR = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  return (
    <header className="h-14 bg-[#070b14]/95 backdrop-blur-xl border-b border-slate-800/90 px-4 sm:px-6 flex items-center justify-between text-slate-100 z-30 shrink-0 select-none shadow-xl">
      {/* Brand & Project Info */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500/20 via-amber-600/30 to-sky-500/20 border border-amber-500/50 flex items-center justify-center shadow-lg shadow-amber-500/10 text-amber-400">
          <Coffee className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold tracking-tight text-white text-sm sm:text-base font-sans">
              Coffee Civil
            </span>
            <span className="hidden sm:inline-block text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
              4M + MONTE CARLO
            </span>
          </div>
          <div className="hidden lg:flex items-center gap-1.5 text-[11px] text-slate-400">
            <span className="font-medium text-slate-300">
              {metrics.workPackageTitle}
            </span>
            <span>•</span>
            <span className="text-slate-400">
              {config.scope.volumeM3.toLocaleString()} {metrics.unitLabel} • {metrics.benchmarks.primaryEquipLabel} & {metrics.benchmarks.secondaryEquipLabel}
            </span>
          </div>
        </div>
      </div>

      {/* Center / Right KPIs & Actions */}
      <div className="flex items-center gap-2.5">
        {/* Match Factor Indicator */}
        <div
          className={`hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-xs font-semibold ${
            metrics.matchFactorStatus === 'balanced'
              ? 'bg-emerald-950/70 border-emerald-800/80 text-emerald-300'
              : metrics.matchFactorStatus === 'under_trucked'
              ? 'bg-amber-950/70 border-amber-800/80 text-amber-300 animate-pulse'
              : 'bg-blue-950/70 border-blue-800/80 text-blue-300'
          }`}
          title={metrics.matchFactorAdvice}
        >
          <Truck className="w-3.5 h-3.5" />
          <span className="text-[11px] font-mono">MF: {metrics.matchFactor.toFixed(2)}</span>
        </div>

        {/* Daily Output */}
        <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-900/80 border border-slate-800 text-xs">
          <span className="text-slate-500 font-mono text-[11px]">Daily Rate:</span>
          <span className="text-white font-bold font-mono text-[11px]">
            {metrics.dailyOutputM3.toLocaleString()} {metrics.unitLabel}/d
          </span>
        </div>

        {/* Monte Carlo Trigger Button */}
        <button
          onClick={onOpenMonteCarlo}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-sky-500 hover:from-amber-400 hover:to-sky-400 text-slate-950 text-xs font-bold shadow-md shadow-sky-500/20 transition"
        >
          <TrendingUp className="w-3.5 h-3.5" />
          <span>Monte Carlo Risk (P10/P50/P90)</span>
        </button>

        {/* Milestone Celebration Button */}
        <button
          onClick={onTriggerConfetti}
          className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-amber-400 hover:text-amber-300 text-xs font-semibold transition"
          title="Trigger Milestone Celebration Confetti"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Celebrate</span>
        </button>

        {/* Engineering Specs Modal Toggle */}
        <button
          onClick={() => setShowSpecsModal(true)}
          className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition"
          title="Engineering Standards & Equations"
        >
          <Info className="w-4 h-4" />
        </button>
      </div>

      {/* Engineering Specifications Modal */}
      {showSpecsModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#0d1322] border border-slate-700/80 rounded-2xl p-6 shadow-2xl text-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <HardHat className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-white text-base">
                  4M Civil Engineering Equations & Standards (Permen PUPR)
                </h3>
              </div>
              <button
                onClick={() => setShowSpecsModal(false)}
                className="text-slate-400 hover:text-white text-sm px-2 py-1 rounded-lg bg-slate-800"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 font-mono">
                <span className="text-amber-400 font-bold block mb-1">1. Excavator Productivity Formula:</span>
                <p className="text-slate-300">Q = (q × 3600 × E × Ff) / (Cm × Sf)</p>
                <span className="text-[10px] text-slate-500">
                  q = bucket, E = job efficiency, Ff = fill factor, Cm = cycle (sec), Sf = soil swell factor.
                </span>
              </div>

              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 font-mono">
                <span className="text-sky-400 font-bold block mb-1">2. Compactor (Vibro Roller) Productivity Formula:</span>
                <p className="text-slate-300">Q = (W × v × 1000 × t × E) / N</p>
                <span className="text-[10px] text-slate-500">
                  W = drum width (m), v = speed (km/h), t = layer thickness (m), E = efficiency, N = passes.
                </span>
              </div>

              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 space-y-1">
                <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                  <Layers className="w-3.5 h-3.5" />
                  <span>Current Project Baseline Metrics:</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                  <div>Hourly Output: <strong className="text-white">{metrics.systemHourlyQ} {metrics.unitLabel}/hr</strong></div>
                  <div>Daily Output: <strong className="text-white">{metrics.dailyOutputM3} {metrics.unitLabel}/day</strong></div>
                  <div>Duration (Deterministic): <strong className="text-white">{metrics.estimatedDurationDays} Hari</strong></div>
                  <div>Unit Rate: <strong className="text-emerald-400">{formatIDR(metrics.unitRatePerM3)} / {metrics.unitLabel}</strong></div>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowSpecsModal(false)}
                className="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs rounded-xl transition"
              >
                Close Standards
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
