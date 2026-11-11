import type { MergeEvent } from './types';

export const DAILY_CHALLENGES = [
  { id: 'merges', target: 10, gems: 10, title: 'challengeMerges', description: 'challengeMergesDetail' },
  { id: 'tile', target: 128, gems: 15, title: 'challengeTile', description: 'challengeTileDetail' },
  { id: 'chain', target: 3, gems: 20, title: 'challengeChain', description: 'challengeChainDetail' },
] as const;
export type ChallengeId = typeof DAILY_CHALLENGES[number]['id'];
export type ChallengeProgress = { day: number; merges: number; tile: number; chain: number; seenMoves: string[] };

export function challengeDay(progress?: ChallengeProgress, now = Date.now()): ChallengeProgress {
  const day = Math.floor(now / 86400000);
  // A backward clock must not reopen a previously completed day.
  return progress && progress.day >= day ? progress : { day, merges: 0, tile: 0, chain: 0, seenMoves: [] };
}

export function advanceChallenges(progress: ChallengeProgress | undefined, moveId: string, merges: MergeEvent[], now = Date.now(), isShot = true): ChallengeProgress {
  const current = challengeDay(progress, now);
  if (!merges.length || current.seenMoves.includes(moveId)) return current;
  return { ...current, merges: Math.min(10, current.merges + merges.length),
    tile: Math.min(128, Math.max(current.tile, ...merges.map(merge => merge.value))),
    chain: Math.min(3, Math.max(current.chain, isShot ? merges.length : 0)), seenMoves: [...current.seenMoves, moveId] };
}

export function challengeStatus(progress: ChallengeProgress | undefined, receipts: string[], now = Date.now()) {
  const current = challengeDay(progress, now);
  const tasks = DAILY_CHALLENGES.map(task => {
    const value = current[task.id];
    const receipt = `challenge:${current.day}:${task.id}`;
    return { ...task, value, receipt, complete: value >= task.target, claimed: receipts.includes(receipt) };
  });
  return { day: current.day, tasks, ready: tasks.some(task => task.complete && !task.claimed),
    completed: tasks.filter(task => task.complete).length, claimed: tasks.filter(task => task.claimed).length,
    remaining: Math.max(0, (current.day + 1) * 86400000 - now) };
}
