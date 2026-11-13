// Score checkpoints grow without a hard cap: 1k, 5k, 10k, 50k, 100k, etc.
export function getCrossedScoreCheckpoint(previousScore: number, nextScore: number): number | null {
  if (!Number.isFinite(previousScore) || !Number.isFinite(nextScore) || nextScore <= previousScore) return null;

  let crossed: number | null = null;
  for (let decade = 1000; Number.isSafeInteger(decade); decade *= 10) {
    if (decade > nextScore) break;
    for (const multiplier of [1, 5]) {
      const checkpoint = multiplier * decade;
      if (Number.isSafeInteger(checkpoint) && checkpoint > previousScore && checkpoint <= nextScore) crossed = checkpoint;
    }
  }
  return crossed;
}

export function isScoreCheckpoint(value: number): boolean {
  if (!Number.isSafeInteger(value) || value < 1000) return false;
  let reduced = value;
  while (reduced % 10 === 0) reduced /= 10;
  return reduced === 1 || reduced === 5;
}
