import confetti from 'canvas-confetti';

/**
 * Triggers a grand civil engineering project handover celebration confetti
 * Suitable for Week 104 Corridor completion or major milestones
 */
export function fireHandoverGrandCelebration(): void {
  const duration = 3.5 * 1000;
  const animationEnd = Date.now() + duration;
  const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

  function randomInRange(min: number, max: number): number {
    return Math.random() * (max - min) + min;
  }

  const interval: any = setInterval(function () {
    const timeLeft = animationEnd - Date.now();

    if (timeLeft <= 0) {
      return clearInterval(interval);
    }

    const particleCount = 50 * (timeLeft / duration);

    // Left cannon
    confetti({
      ...defaults,
      particleCount,
      origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
      colors: ['#0284c7', '#38bdf8', '#f59e0b', '#10b981', '#fbbf24', '#ffffff'],
    });
    // Right cannon
    confetti({
      ...defaults,
      particleCount,
      origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
      colors: ['#0284c7', '#38bdf8', '#f59e0b', '#10b981', '#fbbf24', '#ffffff'],
    });
  }, 250);
}

/**
 * Snappy celebration for QA/QC RFI Inspection sign-off
 */
export function fireRfiApprovedConfetti(): void {
  confetti({
    particleCount: 80,
    spread: 70,
    origin: { y: 0.6, x: 0.8 },
    colors: ['#10b981', '#34d399', '#38bdf8', '#f59e0b', '#ffffff'],
    zIndex: 9999,
  });
}

/**
 * Standard milestone achievement burst
 */
export function fireMilestoneConfetti(): void {
  confetti({
    particleCount: 100,
    spread: 90,
    origin: { y: 0.5, x: 0.5 },
    colors: ['#f59e0b', '#0284c7', '#10b981', '#6366f1'],
    zIndex: 9999,
  });
}
