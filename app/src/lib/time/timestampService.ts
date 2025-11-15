// Lightweight timestamp service with swappable strategies
// Returns timestamps in seconds (floating) to match simulation time units

type TimeStrategy = 'real' | 'simulation';

let strategy: TimeStrategy = 'real';
let simulationNow = 0; // seconds

export function setTimeStrategy(s: TimeStrategy) {
  strategy = s;
}

export function getTimeStrategy(): TimeStrategy {
  return strategy;
}

export function setSimulationTime(t: number) {
  simulationNow = t;
}

export function advanceSimulationTime(delta: number) {
  simulationNow += delta;
}

export function now(): number {
  if (strategy === 'real') {
    return Date.now() / 1000; // seconds
  }
  return simulationNow;
}

export default {
  now,
  setTimeStrategy,
  getTimeStrategy,
  setSimulationTime,
  advanceSimulationTime,
};
