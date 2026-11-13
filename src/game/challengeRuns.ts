import { storage } from '../utils/storage';
import type { TileValue } from './types';

export type ChallengeRunId = 'milestone-sprint' | 'cascade-hunt' | 'clean-merge';

export interface ChallengeRunDefinition {
  id: ChallengeRunId;
  titleKey: string;
  descriptionKey: string;
  targetTile?: TileValue;
  targetCascade?: number;
  shotLimit: number;
  objectiveKey: string;
}

export interface ChallengeRunStats {
  shots: number;
  highestTile: TileValue;
  longestCascade: number;
}

export interface ChallengeRunRecord {
  attempts: number;
  wins: number;
  bestScore: number;
  bestHighestTile: TileValue;
  bestCascade: number;
  fewestShotsToWin: number | null;
}

export type ChallengeRunOutcome = 'won' | 'failed' | null;

export const CHALLENGE_RUNS: readonly ChallengeRunDefinition[] = [
  {
    id: 'milestone-sprint',
    titleKey: 'milestoneSprint',
    descriptionKey: 'milestoneSprintDescription',
    targetTile: 256,
    shotLimit: 24,
    objectiveKey: 'milestoneSprintGoal',
  },
  {
    id: 'cascade-hunt',
    titleKey: 'cascadeHunt',
    descriptionKey: 'cascadeHuntDescription',
    targetCascade: 4,
    shotLimit: 20,
    objectiveKey: 'cascadeHuntGoal',
  },
  {
    id: 'clean-merge',
    titleKey: 'cleanMerge',
    descriptionKey: 'cleanMergeDescription',
    targetTile: 512,
    shotLimit: 40,
    objectiveKey: 'cleanMergeGoal',
  },
];

const RECORDS_KEY = 'challenge-run-records-v1';

export const getChallengeRun = (id: ChallengeRunId) => CHALLENGE_RUNS.find((run) => run.id === id)!;

export function getChallengeRunOutcome(id: ChallengeRunId, stats: ChallengeRunStats, boardFull = false): ChallengeRunOutcome {
  const challenge = getChallengeRun(id);
  const objectiveReached = challenge.targetCascade !== undefined
    ? stats.longestCascade >= challenge.targetCascade
    : stats.highestTile >= (challenge.targetTile ?? Number.POSITIVE_INFINITY);

  if (objectiveReached) return 'won';
  if (boardFull || stats.shots >= challenge.shotLimit) return 'failed';
  return null;
}

const emptyRecord = (): ChallengeRunRecord => ({
  attempts: 0,
  wins: 0,
  bestScore: 0,
  bestHighestTile: 0,
  bestCascade: 0,
  fewestShotsToWin: null,
});

function isRecord(value: unknown): value is ChallengeRunRecord {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<ChallengeRunRecord>;
  return Number.isSafeInteger(record.attempts) && record.attempts! >= 0
    && Number.isSafeInteger(record.wins) && record.wins! >= 0
    && Number.isFinite(record.bestScore) && record.bestScore! >= 0
    && Number.isFinite(record.bestHighestTile) && record.bestHighestTile! >= 0
    && Number.isSafeInteger(record.bestCascade) && record.bestCascade! >= 0
    && (record.fewestShotsToWin === null || (Number.isSafeInteger(record.fewestShotsToWin) && record.fewestShotsToWin! > 0));
}

export function readChallengeRunRecords(): Partial<Record<ChallengeRunId, ChallengeRunRecord>> {
  const saved = storage.get<unknown>(RECORDS_KEY, {});
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return {};
  const entries = saved as Record<string, unknown>;
  return Object.fromEntries(CHALLENGE_RUNS.flatMap(({ id }) => isRecord(entries[id]) ? [[id, entries[id]]] : []));
}

export function readChallengeRunRecord(id: ChallengeRunId): ChallengeRunRecord {
  return readChallengeRunRecords()[id] ?? emptyRecord();
}

export function recordChallengeRun(
  id: ChallengeRunId,
  stats: ChallengeRunStats,
  score: number,
  outcome: Exclude<ChallengeRunOutcome, null>,
): ChallengeRunRecord {
  const records = readChallengeRunRecords();
  const previous = records[id] ?? emptyRecord();
  const next: ChallengeRunRecord = {
    attempts: previous.attempts + 1,
    wins: previous.wins + Number(outcome === 'won'),
    bestScore: Math.max(previous.bestScore, Math.floor(score)),
    bestHighestTile: Math.max(previous.bestHighestTile, stats.highestTile),
    bestCascade: Math.max(previous.bestCascade, stats.longestCascade),
    fewestShotsToWin: outcome === 'won'
      ? Math.min(previous.fewestShotsToWin ?? Number.POSITIVE_INFINITY, stats.shots)
      : previous.fewestShotsToWin,
  };
  storage.set(RECORDS_KEY, { ...records, [id]: next });
  return next;
}
