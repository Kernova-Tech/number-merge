import { COLS, INITIAL_HIGHEST, ROWS } from './constants';
import { createInitialBoard, resolveMerges } from './gameLogic';
import { generateWeightedTile } from './tileGeneration';
import type { Board, TileValue } from './types';
import { storage } from '../utils/storage';

export type GameMode = 'classic' | 'daily-seed' | 'challenge';

export interface DailySeedRun {
  version: 1;
  day: string;
  seed: number;
  randomState: number;
  board: Board;
  score: number;
  currentTile: TileValue;
  nextTile: TileValue;
  selectedColumn: number;
  highestBlock: TileValue;
  longestChain: number;
  bestScoreAtStart: number;
}

export interface DailySeedRecord {
  day: string;
  bestScore: number;
  longestChain: number;
}

const DAILY_RUN_KEY = 'daily-seed-run-v1';
const DAILY_RECORDS_KEY = 'daily-seed-records-v1';
const MAX_DAILY_RECORDS = 90;

const isTile = (value: unknown): value is TileValue =>
  typeof value === 'number' && Number.isFinite(value) && value >= 2 && Number.isInteger(Math.log2(value));

export function getDailySeedDay(now = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10);
}

export function getDailySeed(day: string): number {
  let hash = 2166136261;
  for (let index = 0; index < day.length; index += 1) {
    hash = Math.imul(hash ^ day.charCodeAt(index), 16777619);
  }
  return (hash >>> 0) || 1;
}

export function nextSeededRandom(state: number): { value: number; state: number } {
  const nextState = (state + 0x6d2b79f5) >>> 0;
  let value = nextState;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return { value: ((value ^ (value >>> 14)) >>> 0) / 4294967296, state: nextState };
}

export function createDailySeedOpening(day: string) {
  const seed = getDailySeed(day);
  let randomState = seed;
  const random = () => {
    const next = nextSeededRandom(randomState);
    randomState = next.state;
    return next.value;
  };
  const board = resolveMerges(createInitialBoard([], random), { row: 0, col: 0 }, INITIAL_HIGHEST).board;
  const currentTile = generateWeightedTile(INITIAL_HIGHEST, random);
  const nextTile = generateWeightedTile(INITIAL_HIGHEST, random, [currentTile]);
  return { seed, randomState, board, currentTile, nextTile, highestBlock: INITIAL_HIGHEST as TileValue };
}

function validateRecord(record: unknown): record is DailySeedRecord {
  if (!record || typeof record !== 'object') return false;
  const value = record as Partial<DailySeedRecord>;
  return typeof value.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.day)
    && Number.isSafeInteger(value.bestScore) && value.bestScore! >= 0
    && Number.isSafeInteger(value.longestChain) && value.longestChain! >= 0;
}

export function readDailySeedRecords(): DailySeedRecord[] {
  const records = storage.get<unknown>(DAILY_RECORDS_KEY, []);
  if (!Array.isArray(records)) return [];
  return records.filter(validateRecord)
    .sort((left, right) => right.day.localeCompare(left.day))
    .slice(0, MAX_DAILY_RECORDS);
}

export function readDailySeedRecord(day = getDailySeedDay()): DailySeedRecord {
  return readDailySeedRecords().find((record) => record.day === day)
    ?? { day, bestScore: 0, longestChain: 0 };
}

export function recordDailySeedProgress(day: string, score: number, longestChain: number): DailySeedRecord {
  const records = readDailySeedRecords();
  const previous = records.find((record) => record.day === day);
  const updated = {
    day,
    bestScore: Math.max(previous?.bestScore ?? 0, Math.floor(score)),
    longestChain: Math.max(previous?.longestChain ?? 0, Math.floor(longestChain)),
  };
  storage.set(DAILY_RECORDS_KEY, [updated, ...records.filter((record) => record.day !== day)]
    .sort((left, right) => right.day.localeCompare(left.day))
    .slice(0, MAX_DAILY_RECORDS));
  return updated;
}

export function loadDailySeedRun(day = getDailySeedDay()): DailySeedRun | null {
  const run = storage.get<unknown>(DAILY_RUN_KEY, null);
  if (!run || typeof run !== 'object') return null;
  const value = run as Partial<DailySeedRun>;
  if (value.version !== 1 || value.day !== day || value.seed !== getDailySeed(day)
    || !Number.isSafeInteger(value.randomState) || value.randomState! < 0 || value.randomState! > 0xffffffff
    || !Array.isArray(value.board) || value.board.length !== ROWS
    || !value.board.every((row) => Array.isArray(row) && row.length === COLS && row.every((cell) => cell === null || isTile(cell)))
    || !Number.isSafeInteger(value.score) || value.score! < 0
    || !isTile(value.currentTile) || !isTile(value.nextTile) || !isTile(value.highestBlock)
    || !Number.isInteger(value.selectedColumn) || value.selectedColumn! < 0 || value.selectedColumn! >= COLS
    || !Number.isSafeInteger(value.longestChain) || value.longestChain! < 0
    || !Number.isSafeInteger(value.bestScoreAtStart) || value.bestScoreAtStart! < 0) return null;
  return value as DailySeedRun;
}

export function saveDailySeedRun(run: DailySeedRun | null): void {
  storage.set(DAILY_RUN_KEY, run);
}
