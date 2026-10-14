import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  SimulatorConfig,
  ProductivityMetrics,
  MonteCarloResult,
  LiveSimulationState,
} from './types/simulator';
import {
  DEFAULT_CONFIG,
  calculateProductivity,
  runMonteCarloSimulation,
} from './utils/productivityEngine';
import { SimulatorHeader } from './components/SimulatorHeader';
import { ConfigurationPanel } from './components/ConfigurationPanel';
import { WorkCanvas3D } from './components/WorkCanvas3D';
import { MonteCarloModal } from './components/MonteCarloModal';
import { fireMilestoneConfetti, fireHandoverGrandCelebration } from './utils/confetti';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';

export const App: React.FC = () => {
  // 1. 4M Simulator User Configuration State
  const [config, setConfig] = useState<SimulatorConfig>(DEFAULT_CONFIG);

  // 2. Computed Deterministic Productivity & Match Factor Metrics
  const metrics = useMemo<ProductivityMetrics>(() => {
    return calculateProductivity(config);
  }, [config]);

  // 3. Monte Carlo Stochastic Results (Default computed on mount, recalculated on demand)
  const [monteCarloResult, setMonteCarloResult] = useState<MonteCarloResult>(() =>
    runMonteCarloSimulation(DEFAULT_CONFIG, 1000)
  );
  const [isMonteCarloModalOpen, setIsMonteCarloModalOpen] = useState(false);

  // 4. Left Sidebar Collapsible State
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // 5. Live Simulation State
  const [simState, setSimState] = useState<LiveSimulationState>({
    isPlaying: false,
    speedMultiplier: 5,
    elapsedSimSeconds: 0,
    excavatedVolumeM3: 0,
    remainingVolumeM3: DEFAULT_CONFIG.scope.volumeM3,
    progressPercent: 0,
    totalCostAccruedIdr: 0,
    truckRitsCompleted: 0,
  });

  // Track completion celebration
  const hasFinishedRef = useRef(false);

  // Reset live simulation when total volume or scope changes
  useEffect(() => {
    setSimState((prev) => ({
      ...prev,
      isPlaying: false,
      elapsedSimSeconds: 0,
      excavatedVolumeM3: 0,
      remainingVolumeM3: config.scope.volumeM3,
      progressPercent: 0,
      totalCostAccruedIdr: 0,
      truckRitsCompleted: 0,
    }));
    hasFinishedRef.current = false;
  }, [config.scope.volumeM3]);

  // Real-time Simulation Loop
  useEffect(() => {
    if (!simState.isPlaying) return;

    const intervalMs = 50; // 20 ticks per second
    const simStepSeconds = (intervalMs / 1000) * 120 * simState.speedMultiplier; // Sim time rate

    const timer = setInterval(() => {
      setSimState((prev) => {
        if (prev.remainingVolumeM3 <= 0) {
          if (!hasFinishedRef.current) {
            hasFinishedRef.current = true;
            fireHandoverGrandCelebration();
          }
          return { ...prev, isPlaying: false, remainingVolumeM3: 0, progressPercent: 100 };
        }

        const nextElapsedSec = prev.elapsedSimSeconds + simStepSeconds;
        // Output per second
        const hourlyQ = metrics.systemHourlyQ;
        const excavatedInc = (hourlyQ / 3600) * simStepSeconds;
        const nextExcavated = Math.min(config.scope.volumeM3, prev.excavatedVolumeM3 + excavatedInc);
        const nextRemaining = Math.max(0, config.scope.volumeM3 - nextExcavated);
        const nextProgress = (nextExcavated / config.scope.volumeM3) * 100;

        // Cost accrued
        const hourlyCost =
          metrics.hourlyMachineCost +
          metrics.hourlyLaborCost +
          metrics.hourlyFuelCost +
          metrics.hourlyTippingCost;
        const costInc = (hourlyCost / 3600) * simStepSeconds;
        const nextCost = prev.totalCostAccruedIdr + costInc;

        // Truck rits
        const bankTruckCap = config.machine.truckCapacityM3 / metrics.swellFactor;
        const nextRits = Math.floor(nextExcavated / Math.max(1, bankTruckCap));

        return {
          ...prev,
          elapsedSimSeconds: nextElapsedSec,
          excavatedVolumeM3: nextExcavated,
          remainingVolumeM3: nextRemaining,
          progressPercent: nextProgress,
          totalCostAccruedIdr: nextCost,
          truckRitsCompleted: nextRits,
        };
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [
    simState.isPlaying,
    simState.speedMultiplier,
    metrics.systemHourlyQ,
    metrics.hourlyMachineCost,
    metrics.hourlyLaborCost,
    metrics.hourlyFuelCost,
    metrics.hourlyTippingCost,
    metrics.swellFactor,
    config.scope.volumeM3,
    config.machine.truckCapacityM3,
  ]);

  // Handle Play/Pause
  const handleTogglePlay = useCallback(() => {
    setSimState((p) => {
      // If already at 100%, reset first
      if (p.remainingVolumeM3 <= 0) {
        hasFinishedRef.current = false;
        return {
          ...p,
          isPlaying: true,
          elapsedSimSeconds: 0,
          excavatedVolumeM3: 0,
          remainingVolumeM3: config.scope.volumeM3,
          progressPercent: 0,
          totalCostAccruedIdr: 0,
          truckRitsCompleted: 0,
        };
      }
      return { ...p, isPlaying: !p.isPlaying };
    });
  }, [config.scope.volumeM3]);

  // Handle Reset
  const handleReset = useCallback(() => {
    hasFinishedRef.current = false;
    setSimState((p) => ({
      ...p,
      isPlaying: false,
      elapsedSimSeconds: 0,
      excavatedVolumeM3: 0,
      remainingVolumeM3: config.scope.volumeM3,
      progressPercent: 0,
      totalCostAccruedIdr: 0,
      truckRitsCompleted: 0,
    }));
  }, [config.scope.volumeM3]);

  // Run Monte Carlo Simulation
  const handleRunMonteCarlo = useCallback(() => {
    const res = runMonteCarloSimulation(config, 1000);
    setMonteCarloResult(res);
    setIsMonteCarloModalOpen(true);
    fireMilestoneConfetti();
  }, [config]);

  // Reset to Defaults
  const handleResetDefaults = useCallback(() => {
    setConfig(DEFAULT_CONFIG);
  }, []);

  return (
    <div className="w-screen h-screen flex flex-col overflow-hidden bg-[#0a0f1d] text-slate-100 font-sans select-none">
      {/* Top Standalone Header */}
      <SimulatorHeader
        config={config}
        metrics={metrics}
        onOpenMonteCarlo={() => setIsMonteCarloModalOpen(true)}
        onTriggerConfetti={fireHandoverGrandCelebration}
      />

      {/* Main Workspace Body: Split Two-Column Layout */}
      <div className="relative flex-1 w-full h-full flex overflow-hidden">
        {/* Left Column: Scope & 4M Input Configuration Panel */}
        <div
          className={`h-full transition-all duration-300 z-20 shrink-0 ${
            isSidebarOpen ? 'w-full sm:w-[380px] md:w-[410px]' : 'w-0'
          } overflow-hidden`}
        >
          <ConfigurationPanel
            config={config}
            onChangeConfig={setConfig}
            metrics={metrics}
            onRunMonteCarlo={handleRunMonteCarlo}
            onResetDefaults={handleResetDefaults}
          />
        </div>

        {/* Toggle Sidebar Pill */}
        <button
          onClick={() => setIsSidebarOpen((prev) => !prev)}
          className="absolute top-4 left-4 z-30 p-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 text-slate-300 hover:text-white shadow-xl transition"
          style={{ left: isSidebarOpen ? '420px' : '16px' }}
          title={isSidebarOpen ? 'Collapse Configuration Panel' : 'Expand Configuration Panel'}
        >
          {isSidebarOpen ? (
            <PanelLeftClose className="w-4 h-4" />
          ) : (
            <PanelLeftOpen className="w-4 h-4 text-amber-400" />
          )}
        </button>

        {/* Right / Center Column: Interactive 3D Work Canvas */}
        <div className="relative flex-1 h-full overflow-hidden">
          <WorkCanvas3D
            config={config}
            metrics={metrics}
            simState={simState}
            onTogglePlay={handleTogglePlay}
            onReset={handleReset}
            onChangeSpeed={(spd) => setSimState((p) => ({ ...p, speedMultiplier: spd }))}
          />
        </div>
      </div>

      {/* Monte Carlo Risk Distribution Modal */}
      <MonteCarloModal
        isOpen={isMonteCarloModalOpen}
        onClose={() => setIsMonteCarloModalOpen(false)}
        result={monteCarloResult}
        metrics={metrics}
        config={config}
      />
    </div>
  );
};

export default App;
