import { COLS, ROWS } from './constants';
import type { Board, MilestoneInfo } from './types';
import { storage } from '../utils/storage';

export interface SavedRun {
  version: 1;
  board: Board;
  score: number;
  currentTile: number;
  nextTile: number;
  selectedColumn: number;
  highestBlock: number;
  totalXp: number;
  rewardModal?: 'unlock' | 'milestone' | null;
  modalTile?: number | null;
  milestoneInfo?: MilestoneInfo | null;
  runId?: string;
  moveNumber?: number;
}

const tile = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 2 && Number.isInteger(Math.log2(value));

export function loadRun(): SavedRun | null {
  const run = storage.get<SavedRun | null>('saved-run', null);
  if (!run || run.version !== 1 || !Array.isArray(run.board) || run.board.length !== ROWS
    || !run.board.every((row) => Array.isArray(row) && row.length === COLS && row.every((cell) => cell === null || tile(cell)))
    || !tile(run.currentTile) || !tile(run.nextTile) || !tile(run.highestBlock)
    || !Number.isFinite(run.score) || run.score < 0 || !Number.isFinite(run.totalXp) || run.totalXp < 0
    || !Number.isInteger(run.selectedColumn) || run.selectedColumn < 0 || run.selectedColumn >= COLS
    || (run.runId !== undefined && typeof run.runId !== 'string')
    || (run.moveNumber !== undefined && (!Number.isSafeInteger(run.moveNumber) || run.moveNumber < 0))
    || (run.rewardModal != null && run.rewardModal !== 'unlock' && run.rewardModal !== 'milestone')
    || (run.rewardModal != null && !tile(run.modalTile))
    || (run.milestoneInfo != null && (!tile(run.milestoneInfo.current) || !tile(run.milestoneInfo.next) || !tile(run.milestoneInfo.retired)))) return null;
  return run;
}
