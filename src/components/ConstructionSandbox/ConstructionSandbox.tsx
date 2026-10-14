import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { ConstructionCanvas } from './ConstructionCanvas';
import { TimelineBar } from './TimelineBar';
import { TelemetryHUD } from './TelemetryHUD';
import { WeatherStressTest } from './WeatherStressTest';
import { ElementDrawer } from './ElementDrawer';
import { SimulatorHeader } from './SimulatorHeader';
import {
  generateCorridorElements,
  SITE_CRANES,
  getCraneCollisionPairs,
  INITIAL_TRANSIT_MIXERS,
} from './corridorData';
import {
  StructuralElement,
  WeatherState,
  TelemetryData,
  TransitMixer,
  CraneCollisionPair,
} from './types';
import { fireHandoverGrandCelebration } from '../../utils/confetti';

interface ConstructionSandboxProps {
  onBackToMap?: () => void;
}

export const ConstructionSandbox: React.FC<ConstructionSandboxProps> = ({ onBackToMap }) => {
  // 1. Elements Data (2.5 km corridor across 25 piers)
  const elements = useMemo<StructuralElement[]>(() => generateCorridorElements(), []);

  // 2. 4D Phasing Timeline State
  // Default to Week 42 (active river column casting, heavy cranes and mixers engaged)
  const [currentWeek, setCurrentWeek] = useState<number>(42);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);

  // 3. Structural Element Selection & Inspector
  const [selectedElement, setSelectedElement] = useState<StructuralElement | null>(null);

  // 4. Heavy Equipment & Logistics Layer
  const [showCraneCoverage, setShowCraneCoverage] = useState<boolean>(true);
  const [showFleetAnimation, setShowFleetAnimation] = useState<boolean>(true);
  const [transitMixers, setTransitMixers] = useState<TransitMixer[]>(INITIAL_TRANSIT_MIXERS);
  const collisionPairs = useMemo<CraneCollisionPair[]>(() => getCraneCollisionPairs(SITE_CRANES), []);

  // 5. Weather & Quality Pour Stress-Test State
  const [rainfallMmHour, setRainfallMmHour] = useState<number>(0);
  const [cumulativeDelayDays, setCumulativeDelayDays] = useState<number>(0);
  const [isWeatherPanelOpen, setIsWeatherPanelOpen] = useState<boolean>(false);

  // 6. Camera Preset State
  const [activeCameraPreset, setActiveCameraPreset] = useState<string>('river');

  // Derived Weather State
  const weather = useMemo<WeatherState>(() => {
    const isSuspended = rainfallMmHour > 20;
    return {
      rainfallMmHour,
      isPouringSuspended: isSuspended,
      cumulativeDelayDays,
      suspendedReason: isSuspended
        ? 'Pouring Suspended: High rain risk to water-cement ratio (w/c > 0.40 tolerance breach)'
        : null,
    };
  }, [rainfallMmHour, cumulativeDelayDays]);

  // Handle weather changes with realistic simulated schedule delays
  const handleRainfallChange = (val: number) => {
    setRainfallMmHour(val);
    if (val > 20) {
      // Simulate added schedule delay days based on storm severity
      const extraDelay = Math.round(1 + (val - 20) / 10);
      setCumulativeDelayDays((prev) => Math.min(45, prev + extraDelay));
    }
  };

  // 7. Timeline Playback Animation Loop
  useEffect(() => {
    if (!isPlaying) return;

    // Adjust step interval based on speed: 1x = 1200ms per week, 10x = 120ms
    const intervalMs = Math.max(100, Math.floor(1200 / playbackSpeed));

    const interval = setInterval(() => {
      setCurrentWeek((prev) => {
        if (prev >= 104) {
          setIsPlaying(false);
          return 104;
        }
        return prev + 1;
      });
    }, intervalMs);

    return () => clearInterval(interval);
  }, [isPlaying, playbackSpeed]);

  // 8. Mixer Fleet Animation Tick (Moving along haul road)
  useEffect(() => {
    if (!showFleetAnimation || weather.isPouringSuspended) return;

    const fleetInterval = setInterval(() => {
      setTransitMixers((prevMixers) =>
        prevMixers.map((mixer) => {
          let nextProgress = mixer.progress + mixer.speed;
          let nextState = mixer.state;

          if (nextProgress >= 1.0) {
            nextProgress = 0;
            if (mixer.state === 'LOADING_AT_PLANT') nextState = 'HAULING_TO_PUMP';
            else if (mixer.state === 'HAULING_TO_PUMP') nextState = 'DISCHARGING_AT_PUMP';
            else if (mixer.state === 'DISCHARGING_AT_PUMP') nextState = 'RETURNING_TO_PLANT';
            else if (mixer.state === 'RETURNING_TO_PLANT') nextState = 'LOADING_AT_PLANT';
          }

          return {
            ...mixer,
            progress: nextProgress,
            state: nextState,
          };
        })
      );
    }, 50);

    return () => clearInterval(fleetInterval);
  }, [showFleetAnimation, weather.isPouringSuspended]);

  // 9. Telemetry Computations
  const telemetry = useMemo<TelemetryData>(() => {
    // Count active elements at current week
    const activeElements = elements.filter(
      (el) => currentWeek >= el.startWeek && currentWeek < el.endWeek
    );
    const activePours = activeElements.filter((el) => el.type === 'column' || el.type === 'cap' || el.type === 'pile');

    let dailyVolume = 0;
    if (activePours.length > 0 && !weather.isPouringSuspended) {
      dailyVolume = Math.round(activePours.reduce((sum, el) => sum + el.volumeM3 * 0.18, 0) + 180);
    }

    const completed = elements.filter((el) => currentWeek >= el.endWeek);
    const totalPoured = Math.round(completed.reduce((sum, el) => sum + el.volumeM3, 0));
    const totalSteel = Math.round(completed.reduce((sum, el) => sum + el.steelKg, 0) / 1000);

    return {
      dailyVolumePouredM3: dailyVolume,
      fleetCycleTimeMins: weather.isPouringSuspended ? 0 : 42,
      equipmentUtilizationRate: weather.isPouringSuspended ? 22.4 : 88.5,
      activeCranesCount: SITE_CRANES.filter((c) => currentWeek >= c.activeFromWeek && currentWeek <= c.activeToWeek).length,
      activeMixersCount: weather.isPouringSuspended ? 0 : 6,
      totalPouredCorridorM3: totalPoured,
      totalSteelTons: totalSteel,
    };
  }, [elements, currentWeek, weather.isPouringSuspended]);

  // Next / Prev Element Navigation for Drawer
  const handleSelectPrevElement = useCallback(() => {
    if (!selectedElement) return;
    const idx = elements.findIndex((e) => e.id === selectedElement.id);
    if (idx > 0) {
      setSelectedElement(elements[idx - 1]);
    }
  }, [elements, selectedElement]);

  const handleSelectNextElement = useCallback(() => {
    if (!selectedElement) return;
    const idx = elements.findIndex((e) => e.id === selectedElement.id);
    if (idx < elements.length - 1) {
      setSelectedElement(elements[idx + 1]);
    }
  }, [elements, selectedElement]);

  // Handover completion celebration at Week 104
  const hasCelebratedHandoverRef = useRef(false);
  useEffect(() => {
    if (currentWeek === 104 && !hasCelebratedHandoverRef.current) {
      hasCelebratedHandoverRef.current = true;
      fireHandoverGrandCelebration();
    } else if (currentWeek < 104) {
      hasCelebratedHandoverRef.current = false;
    }
  }, [currentWeek]);

  const handleTriggerCelebration = useCallback(() => {
    fireHandoverGrandCelebration();
  }, []);

  return (
    <div className="relative w-full h-full flex flex-col overflow-hidden bg-[#0a0f1d] text-slate-100 select-none font-sans">
      {/* Standalone Clean Command Center Header */}
      <SimulatorHeader
        currentWeek={currentWeek}
        weather={weather}
        telemetry={telemetry}
        activeCameraPreset={activeCameraPreset}
        onSelectCameraPreset={setActiveCameraPreset}
        onTriggerConfetti={handleTriggerCelebration}
        collisionPairs={collisionPairs}
      />

      {/* 3D WebGL Canvas Layer */}
      <div className="relative flex-1 w-full h-full overflow-hidden">
        <ConstructionCanvas
          currentWeek={currentWeek}
          elements={elements}
          selectedElement={selectedElement}
          onSelectElement={setSelectedElement}
          weather={weather}
          showCraneCoverage={showCraneCoverage}
          showFleetAnimation={showFleetAnimation}
          transitMixers={transitMixers}
          activeCameraPreset={activeCameraPreset}
          onCameraPresetChange={setActiveCameraPreset}
        />

        {onBackToMap && (
          <button
            onClick={onBackToMap}
            className="absolute top-4 right-56 z-10 px-3 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-xs font-semibold text-slate-300 hover:text-white border border-slate-800 shadow-xl transition flex items-center gap-1.5"
            title="Kembali ke Peta Nasional PSN"
          >
            <span>←</span>
            <span>PSN Map</span>
          </button>
        )}

        {/* Floating Telemetry HUD */}
        <TelemetryHUD
          telemetry={telemetry}
          weather={weather}
          showCraneCoverage={showCraneCoverage}
          onToggleCraneCoverage={() => setShowCraneCoverage((p) => !p)}
          showFleetAnimation={showFleetAnimation}
          onToggleFleetAnimation={() => setShowFleetAnimation((p) => !p)}
          collisionPairs={collisionPairs}
        />

        {/* Floating Weather & Stress-Test Control Panel */}
        <WeatherStressTest
          weather={weather}
          onRainfallChange={handleRainfallChange}
          isOpen={isWeatherPanelOpen}
          onToggleOpen={() => setIsWeatherPanelOpen((p) => !p)}
        />

        {/* Right Slide Drawer: Structural Element Inspector */}
        <ElementDrawer
          element={selectedElement}
          onClose={() => setSelectedElement(null)}
          onSelectPrev={handleSelectPrevElement}
          onSelectNext={handleSelectNextElement}
          currentWeek={currentWeek}
        />
      </div>

      {/* Bottom 4D Phasing Timeline Bar */}
      <TimelineBar
        currentWeek={currentWeek}
        onWeekChange={setCurrentWeek}
        isPlaying={isPlaying}
        onTogglePlay={() => setIsPlaying((p) => !p)}
        playbackSpeed={playbackSpeed}
        onChangeSpeed={setPlaybackSpeed}
        weatherDelayDays={cumulativeDelayDays}
      />
    </div>
  );
};
