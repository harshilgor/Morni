export function launchNumberSequence(finalNumber: number, steps = 10): number[] {
  const end = Math.max(0, Math.floor(finalNumber));
  const start = Math.max(0, end - steps);
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

