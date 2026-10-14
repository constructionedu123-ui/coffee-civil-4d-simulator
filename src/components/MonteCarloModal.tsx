import React from 'react';
import {
  MonteCarloResult,
  ProductivityMetrics,
  SimulatorConfig,
} from '../types/simulator';
import {
  X,
  TrendingUp,
  ShieldCheck,
  Scale,
  Download,
  Info,
  DollarSign,
  Truck,
} from 'lucide-react';
import { fireMilestoneConfetti } from '../utils/confetti';

interface MonteCarloModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: MonteCarloResult;
  metrics: ProductivityMetrics;
  config: SimulatorConfig;
}

export const MonteCarloModal: React.FC<MonteCarloModalProps> = ({
  isOpen,
  onClose,
  result,
  metrics,
  config,
}) => {
  if (!isOpen) return null;

  // Format IDR currency
  const formatIDR = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  // SVG Histogram calculations
  const chartWidth = 720;
  const chartHeight = 220;
  const padding = { top: 25, right: 30, bottom: 40, left: 45 };

  const innerW = chartWidth - padding.left - padding.right;
  const innerH = chartHeight - padding.top - padding.bottom;

  const maxBinCount = Math.max(...result.histogramBins.map((b) => b.count), 1);
  const binWidthPx = innerW / result.histogramBins.length;

  // X coordinate calculation for any day value
  const getX = (valDays: number) => {
    const minD = result.minDays;
    const maxD = result.maxDays;
    const span = Math.max(0.1, maxD - minD);
    return padding.left + ((valDays - minD) / span) * innerW;
  };

  const p10X = getX(result.p10Days);
  const p50X = getX(result.p50Days);
  const p90X = getX(result.p90Days);

  // Cost Breakdown Percentages
  const totalCost = result.p50Cost || 1;
  const machinePct = Math.round((result.costBreakdown.machineCost / totalCost) * 100);
  const laborPct = Math.round((result.costBreakdown.manpowerCost / totalCost) * 100);
  const fuelPct = Math.round((result.costBreakdown.fuelCost / totalCost) * 100);
  const tippingPct = Math.max(0, 100 - (machinePct + laborPct + fuelPct));

  // Export report summary
  const handleExportCSV = () => {
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [
        'Coffee Civil 4D Work Simulator - Monte Carlo Risk Assessment',
        `Work Volume,${config.scope.volumeM3} m3`,
        `Material,${config.scope.materialType}`,
        `Haul Distance,${config.scope.haulDistanceKm} km`,
        `Fleet Match Factor,${metrics.matchFactor}`,
        `P10 Duration (Days),${result.p10Days}`,
        `P50 Duration (Days),${result.p50Days}`,
        `P90 Duration (Days),${result.p90Days}`,
        `Total Cost P50 (IDR),${result.p50Cost}`,
        `Unit Rate (Rp/m3),${result.unitRateP50}`,
        '',
        'Bin Label,Min Days,Max Days,Frequency,Percentage',
        ...result.histogramBins.map(
          (b) => `${b.binLabel},${b.binMin.toFixed(2)},${b.binMax.toFixed(2)},${b.count},${b.percentage}%`
        ),
      ].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `MonteCarlo_Report_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    fireMilestoneConfetti();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-200">
      <div className="w-full max-w-4xl bg-[#0b101d] border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] text-slate-200">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-900/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-white text-base sm:text-lg">
                  Monte Carlo Productivity & Risk Distribution
                </h2>
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-sky-950 text-sky-400 border border-sky-800">
                  {result.iterationCount.toLocaleString()} ITERATIONS
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Probabilistic schedule duration, cost certainty, and fleet balancing analysis.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1.5 transition"
              title="Export Monte Carlo Data to CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 text-xs">
          {/* Section 1: Fleet Match Factor Gauge & Recommendations */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-sky-400" />
                <h3 className="font-bold text-white text-xs sm:text-sm uppercase tracking-wider">
                  Fleet Match Factor (MF) Analysis
                </h3>
              </div>
              <span
                className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                  metrics.matchFactorStatus === 'balanced'
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                    : metrics.matchFactorStatus === 'under_trucked'
                    ? 'bg-amber-950 text-amber-300 border-amber-800 animate-pulse'
                    : 'bg-blue-950 text-blue-300 border-blue-800'
                }`}
              >
                MF = {metrics.matchFactor.toFixed(2)} ({metrics.matchFactorStatus.toUpperCase().replace('_', ' ')})
              </span>
            </div>

            {/* Match Factor Meter Visualizer */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px] font-mono text-slate-400">
                <span className="text-amber-400 font-semibold">Under-trucked (&lt;0.95)</span>
                <span className="text-emerald-400 font-semibold">Balanced (0.95 – 1.05)</span>
                <span className="text-blue-400 font-semibold">Over-trucked (&gt;1.05)</span>
              </div>

              {/* Three-zone Track */}
              <div className="relative w-full h-3 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                <div className="absolute inset-0 grid grid-cols-3">
                  <div className="bg-amber-500/20 border-r border-slate-800" />
                  <div className="bg-emerald-500/30 border-r border-slate-800" />
                  <div className="bg-blue-500/20" />
                </div>
                {/* Pointer indicator */}
                <div
                  className="absolute top-0 bottom-0 w-2.5 bg-white rounded-full shadow-md shadow-white/50 -translate-x-1/2 transition-all duration-300"
                  style={{
                    left: `${Math.min(98, Math.max(2, (metrics.matchFactor / 2.0) * 100))}%`,
                  }}
                />
              </div>
            </div>

            {/* Equipment Utilization Bars */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-2.5 space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-400">Excavator Utilization:</span>
                  <span className="font-mono font-bold text-amber-300">
                    {metrics.excavatorUtilizationPct}%
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded-full"
                    style={{ width: `${metrics.excavatorUtilizationPct}%` }}
                  />
                </div>
              </div>

              <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-2.5 space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-400">Truck Fleet Utilization:</span>
                  <span className="font-mono font-bold text-sky-300">
                    {metrics.truckUtilizationPct}%
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-sky-500 rounded-full"
                    style={{ width: `${metrics.truckUtilizationPct}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Advice Box */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 flex items-start gap-2.5 text-[11px] text-slate-300">
              <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-white block mb-0.5">Civil Engineering Recommendation:</strong>
                <span>{metrics.matchFactorAdvice}</span>
              </div>
            </div>
          </div>

          {/* Section 2: Monte Carlo Histogram Distribution (SVG Chart) */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
              <div className="flex items-center gap-2">
                <Scale className="w-4 h-4 text-emerald-400" />
                <h3 className="font-bold text-white text-xs sm:text-sm uppercase tracking-wider">
                  Duration Probability Distribution (P10 / P50 / P90)
                </h3>
              </div>
              <div className="flex items-center gap-3 text-[10px] font-mono">
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> P10 (Optimistic)
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-sm bg-sky-500" /> P50 (Expected)
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-sm bg-amber-500" /> P90 (Risk-Adjusted)
                </span>
              </div>
            </div>

            {/* SVG Histogram */}
            <div className="w-full overflow-x-auto">
              <svg
                viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                className="w-full h-auto min-w-[500px]"
              >
                {/* Background grid lines */}
                {[0, 0.25, 0.5, 0.75, 1.0].map((ratio) => {
                  const y = padding.top + innerH * (1 - ratio);
                  return (
                    <g key={ratio}>
                      <line
                        x1={padding.left}
                        y1={y}
                        x2={chartWidth - padding.right}
                        y2={y}
                        stroke="#1e293b"
                        strokeDasharray="4 3"
                      />
                      <text
                        x={padding.left - 6}
                        y={y + 3}
                        fill="#64748b"
                        fontSize="9"
                        textAnchor="end"
                        fontFamily="monospace"
                      >
                        {Math.round(ratio * maxBinCount)}
                      </text>
                    </g>
                  );
                })}

                {/* Shaded 80% Confidence Zone (P10 to P90) */}
                <rect
                  x={p10X}
                  y={padding.top}
                  width={Math.max(1, p90X - p10X)}
                  height={innerH}
                  fill="#0284c7"
                  fillOpacity="0.08"
                />

                {/* Histogram Bars */}
                {result.histogramBins.map((bin, i) => {
                  const x = padding.left + i * binWidthPx;
                  const barH = (bin.count / maxBinCount) * innerH;
                  const y = padding.top + innerH - barH;

                  // Bar color styling
                  let fill = '#334155';
                  if (bin.isP10) fill = '#10b981';
                  else if (bin.isP50) fill = '#0284c7';
                  else if (bin.isP90) fill = '#f59e0b';
                  else if (bin.binMin >= result.p10Days && bin.binMax <= result.p90Days)
                    fill = '#1e3a5f';

                  return (
                    <g key={i}>
                      <rect
                        x={x + 1}
                        y={y}
                        width={Math.max(1, binWidthPx - 2)}
                        height={barH}
                        fill={fill}
                        rx={2}
                      />
                      {/* X Axis Labels */}
                      {i % 3 === 0 && (
                        <text
                          x={x + binWidthPx / 2}
                          y={chartHeight - 15}
                          fill="#64748b"
                          fontSize="9"
                          textAnchor="middle"
                          fontFamily="monospace"
                        >
                          {bin.binLabel}
                        </text>
                      )}
                    </g>
                  );
                })}

                {/* P10 Vertical Line & Pin */}
                <line
                  x1={p10X}
                  y1={padding.top}
                  x2={p10X}
                  y2={padding.top + innerH}
                  stroke="#10b981"
                  strokeWidth="2"
                  strokeDasharray="4 2"
                />
                <circle cx={p10X} cy={padding.top + 4} r="4" fill="#10b981" />
                <text
                  x={p10X}
                  y={padding.top - 6}
                  fill="#10b981"
                  fontSize="10"
                  fontWeight="bold"
                  textAnchor="middle"
                  fontFamily="monospace"
                >
                  P10: {result.p10Days}d
                </text>

                {/* P50 Vertical Line & Pin */}
                <line
                  x1={p50X}
                  y1={padding.top}
                  x2={p50X}
                  y2={padding.top + innerH}
                  stroke="#0284c7"
                  strokeWidth="2.5"
                />
                <circle cx={p50X} cy={padding.top + 4} r="4" fill="#0284c7" />
                <text
                  x={p50X}
                  y={padding.top - 6}
                  fill="#38bdf8"
                  fontSize="11"
                  fontWeight="bold"
                  textAnchor="middle"
                  fontFamily="monospace"
                >
                  P50: {result.p50Days}d
                </text>

                {/* P90 Vertical Line & Pin */}
                <line
                  x1={p90X}
                  y1={padding.top}
                  x2={p90X}
                  y2={padding.top + innerH}
                  stroke="#f59e0b"
                  strokeWidth="2"
                  strokeDasharray="4 2"
                />
                <circle cx={p90X} cy={padding.top + 4} r="4" fill="#f59e0b" />
                <text
                  x={p90X}
                  y={padding.top - 6}
                  fill="#f59e0b"
                  fontSize="10"
                  fontWeight="bold"
                  textAnchor="middle"
                  fontFamily="monospace"
                >
                  P90: {result.p90Days}d
                </text>
              </svg>
            </div>

            {/* 3 Percentile Duration Cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-emerald-950/30 border border-emerald-800/60 rounded-xl p-3">
                <span className="text-[10px] text-emerald-400 font-bold uppercase block">
                  P10 (Optimistic Schedule)
                </span>
                <div className="text-lg sm:text-xl font-mono font-bold text-white mt-1">
                  {result.p10Days} <span className="text-xs text-slate-400">Days</span>
                </div>
                <span className="text-[9px] text-slate-400 block mt-0.5">
                  Cost: {formatIDR(result.p10Cost)}
                </span>
              </div>

              <div className="bg-sky-950/40 border border-sky-800/80 rounded-xl p-3">
                <span className="text-[10px] text-sky-400 font-bold uppercase block">
                  P50 (Expected / Median)
                </span>
                <div className="text-lg sm:text-xl font-mono font-bold text-white mt-1">
                  {result.p50Days} <span className="text-xs text-slate-400">Days</span>
                </div>
                <span className="text-[9px] text-slate-400 block mt-0.5">
                  Cost: {formatIDR(result.p50Cost)}
                </span>
              </div>

              <div className="bg-amber-950/30 border border-amber-800/60 rounded-xl p-3">
                <span className="text-[10px] text-amber-400 font-bold uppercase block">
                  P90 (Risk-Adjusted Contract)
                </span>
                <div className="text-lg sm:text-xl font-mono font-bold text-white mt-1">
                  {result.p90Days} <span className="text-xs text-slate-400">Days</span>
                </div>
                <span className="text-[9px] text-slate-400 block mt-0.5">
                  Cost: {formatIDR(result.p90Cost)}
                </span>
              </div>
            </div>
          </div>

          {/* Section 3: Cost Breakdown & Unit Rate */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-amber-400" />
                <h3 className="font-bold text-white text-xs sm:text-sm uppercase tracking-wider">
                  Cost Architecture & Unit Rate (Rp / m³)
                </h3>
              </div>
              <div className="font-mono text-xs">
                <span className="text-slate-400">Unit Price: </span>
                <span className="font-bold text-emerald-400">
                  {formatIDR(result.unitRateP50)} / m³
                </span>
              </div>
            </div>

            {/* Segmented Stacked Progress Bar */}
            <div className="space-y-1.5">
              <div className="w-full h-3 rounded-full overflow-hidden flex bg-slate-950 border border-slate-800">
                <div
                  className="bg-sky-500 h-full transition-all"
                  style={{ width: `${machinePct}%` }}
                  title={`Machine: ${machinePct}%`}
                />
                <div
                  className="bg-emerald-500 h-full transition-all"
                  style={{ width: `${laborPct}%` }}
                  title={`Labor: ${laborPct}%`}
                />
                <div
                  className="bg-amber-500 h-full transition-all"
                  style={{ width: `${fuelPct}%` }}
                  title={`Fuel: ${fuelPct}%`}
                />
                <div
                  className="bg-violet-500 h-full transition-all"
                  style={{ width: `${tippingPct}%` }}
                  title={`Tipping: ${tippingPct}%`}
                />
              </div>

              {/* Legend with exact amounts */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono text-[10px]">
                <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800/80">
                  <div className="flex items-center gap-1.5 text-sky-400 font-semibold mb-0.5">
                    <span className="w-2 h-2 rounded-full bg-sky-500" />
                    <span>Machine Rental ({machinePct}%)</span>
                  </div>
                  <div className="text-white font-bold">{formatIDR(result.costBreakdown.machineCost)}</div>
                </div>

                <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800/80">
                  <div className="flex items-center gap-1.5 text-emerald-400 font-semibold mb-0.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span>Manpower ({laborPct}%)</span>
                  </div>
                  <div className="text-white font-bold">{formatIDR(result.costBreakdown.manpowerCost)}</div>
                </div>

                <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800/80">
                  <div className="flex items-center gap-1.5 text-amber-400 font-semibold mb-0.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    <span>Solar Fuel ({fuelPct}%)</span>
                  </div>
                  <div className="text-white font-bold">{formatIDR(result.costBreakdown.fuelCost)}</div>
                </div>

                <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800/80">
                  <div className="flex items-center gap-1.5 text-violet-400 font-semibold mb-0.5">
                    <span className="w-2 h-2 rounded-full bg-violet-500" />
                    <span>Tipping Fee ({tippingPct}%)</span>
                  </div>
                  <div className="text-white font-bold">{formatIDR(result.costBreakdown.tippingCost)}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/60 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Standard Deviation: ±{result.stdDevDays} Days (Confidence: 80% P10–P90)</span>
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs transition"
          >
            Close Analysis
          </button>
        </div>
      </div>
    </div>
  );
};
