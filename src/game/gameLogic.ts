import { COLS, ROWS } from './constants';
import { getSpawnPool, getRetiredValuesForHighest } from './milestones';
import { generateWeightedTile } from './tileGeneration';
import type { Board, MergeEvent, MergeStep, Position, ShotResult, TileValue } from './types';

export const createEmptyBoard = (): Board =>
  Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => null));

export const cloneBoard = (board: Board): Board => board.map((row) => [...row]);

export function createInitialBoard(retiredTiles: TileValue[] = []): Board {
  const board = createEmptyBoard();
  const pool = [...new Set(getSpawnPool(retiredTiles))]; // unique non-retired values
  for (let col = 0; col < COLS; col += 1) {
    const height = Math.random() > 0.55 ? 2 : 1;
    for (let row = 0; row < height; row += 1) {
      board[row][col] = pool[Math.floor(Math.random() * pool.length)];
    }
  }
  return board;
}

export function generateNextTile(
  highestBlock: number,
  random = Math.random,
  excludedValues: TileValue[] = [],
): TileValue {
  return generateWeightedTile(highestBlock, random, excludedValues);
}

export function boardsAreEqual(left: Board, right: Board): boolean {
  return left.every((row, rowIndex) => row.every((cell, colIndex) => cell === right[rowIndex]?.[colIndex]));
}

export function createDistinctInitialBoard(previousBoard: Board, retiredTiles: TileValue[] = []): Board {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = createInitialBoard(retiredTiles);
    if (!boardsAreEqual(candidate, previousBoard)) return candidate;
  }
  const candidate = createInitialBoard(retiredTiles);
  candidate[0][0] = candidate[0][0] === null ? (getSpawnPool(retiredTiles)[0]) : null;
  return candidate;
}

export function compressColumns(board: Board): Board {
  const compressed = createEmptyBoard();
  for (let col = 0; col < COLS; col += 1) {
    const values = board.map((row) => row[col]).filter((cell): cell is TileValue => cell !== null);
    values.forEach((value, row) => {
      compressed[row][col] = value;
    });
  }
  return compressed;
}

export function removeRetiredTiles(board: Board, highest: number): Board {
  const retired = getRetiredValuesForHighest(highest);
  return compressColumns(board.map((row) => row.map((value) => value !== null && retired.includes(value) ? null : value)));
}

// Four cardinal directions only: up, down, left, right.
// Deterministic order (top → bottom, left → right) for stable chain merge behavior.
const NEIGHBOR_DIRS = [
  { row: -1, col: 0 },
  { row: 1, col: 0 },
  { row: 0, col: -1 },
  { row: 0, col: 1 },
] as const;

function chooseMergeNeighbor(active: Position, board: Board, value: TileValue): Position | null {
  const candidates: Position[] = [];
  for (const { row: dr, col: dc } of NEIGHBOR_DIRS) {
    const r = active.row + dr;
    const c = active.col + dc;
    if (r >= 0 && r < ROWS && c >= 0 && c < COLS && board[r][c] === value) {
      candidates.push({ row: r, col: c });
    }
  }
  if (!candidates.length) return null;
  // Deterministic: lowest row first, then lowest col.
  return candidates.sort((a, b) => (a.row !== b.row ? a.row - b.row : a.col - b.col))[0];
}

type MergePair = { target: Position; source: Position };

// Resolve aligned runs before ordinary pairs. A run is still made from pair
// merges: three 8s become a 16 plus an 8, rather than one three-way merge.
// Scan rows first, then columns, so intersecting runs resolve deterministically.
function findAlignedRunPair(board: Board): MergePair | null {
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS;) {
      const value = board[row][col];
      if (value === null) { col += 1; continue; }
      let end = col + 1;
      while (end < COLS && board[row][end] === value) end += 1;
      if (end - col >= 3) {
        // Keep the first pair's result at its right tile. This preserves a
        // contiguous suffix, allowing longer runs to resolve/cascade cleanly.
        return { target: { row, col: col + 1 }, source: { row, col } };
      }
      col = end;
    }
  }

  for (let col = 0; col < COLS; col += 1) {
    for (let row = 0; row < ROWS;) {
      const value = board[row][col];
      if (value === null) { row += 1; continue; }
      let end = row + 1;
      while (end < ROWS && board[end][col] === value) end += 1;
      if (end - row >= 3) {
        return { target: { row: row + 1, col }, source: { row, col } };
      }
      row = end;
    }
  }
  return null;
}

export function hasPossibleMerge(board: Board): boolean {
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const value = board[row][col];
      if (value === null) continue;
      for (const { row: dr, col: dc } of NEIGHBOR_DIRS) {
        const r = row + dr;
        const c = col + dc;
        if (r >= 0 && r < ROWS && c >= 0 && c < COLS && board[r][c] === value) return true;
      }
    }
  }
  return false;
}

export function resolveMerges(
  source: Board,
  start: Position,
  highestBlock = 0,
): { board: Board; scoreGained: number; merges: MergeEvent[]; mergeSteps: MergeStep[]; active: Position } {
  let board = removeRetiredTiles(source, highestBlock);
  let active = { ...start };
  let scoreGained = 0;
  const merges: MergeEvent[] = [];
  const mergeSteps: MergeStep[] = [];

  while (true) {
    let value = board[active.row]?.[active.col];
    const alignedRun = findAlignedRunPair(board);
    let match: Position | null = null;

    if (alignedRun) {
      active = alignedRun.target;
      match = alignedRun.source;
      value = board[active.row]?.[active.col];
    } else {
      match = value == null ? null : chooseMergeNeighbor(active, board, value);
    }

    if (!match) {
      let found = false;
      for (let row = 0; row < ROWS && !found; row += 1) {
        for (let col = 0; col < COLS && !found; col += 1) {
          const candidate = board[row][col];
          const neighbor = candidate === null ? null : chooseMergeNeighbor({ row, col }, board, candidate);
          if (neighbor) { active = { row, col }; value = candidate; match = neighbor; found = true; }
        }
      }
      if (!found) break;
    }
    if (!match || value == null) break;

    const boardBefore = cloneBoard(board);
    const target = { ...active };
    board[match.row][match.col] = null;
    const doubled = value * 2;
    highestBlock = Math.max(highestBlock, doubled);
    board[active.row][active.col] = doubled;
    scoreGained += doubled;

    const activeRowAfterCompression = board
      .slice(0, active.row)
      .reduce((count, row) => count + (row[active.col] !== null && !getRetiredValuesForHighest(highestBlock).includes(row[active.col]!) ? 1 : 0), 0);
    board = removeRetiredTiles(board, highestBlock);
    active = { row: activeRowAfterCompression, col: active.col };
    merges.push({ ...active, value: doubled });
    mergeSteps.push({
      boardBefore,
      boardAfter: cloneBoard(board),
      source: { ...match },
      target,
      result: { ...active },
      value: doubled,
    });
  }

  return { board, scoreGained, merges, mergeSteps, active };
}

export function placeTileInColumn(board: Board, column: number, tile: TileValue, highestBlock = 0): ShotResult {
  if (column < 0 || column >= COLS) {
    return { board: cloneBoard(board), gameOver: false, scoreGained: 0, merges: [], mergeSteps: [], landing: null };
  }
  const next = cloneBoard(board);
  let height = 0;
  while (height < ROWS && next[height][column] !== null) height += 1;
  const hitRow = height - 1;
  const hitsMatch = hitRow >= 0 && next[hitRow][column] === tile;
  if (height === ROWS && !hitsMatch) {
    return { board: next, gameOver: true, scoreGained: 0, merges: [], mergeSteps: [], landing: null };
  }

  let landing: Position;
  let collisionScore = 0;
  let collisionMerge: MergeEvent[] = [];
  let collisionStep: MergeStep[] = [];
  if (hitsMatch) {
    const boardBefore = cloneBoard(next);
    const doubled = tile * 2;
    next[hitRow][column] = doubled;
    landing = { row: hitRow, col: column };
    collisionScore = doubled;
    collisionMerge = [{ ...landing, value: doubled }];
    collisionStep = [{
      boardBefore,
      boardAfter: cloneBoard(next),
      source: null,
      target: { ...landing },
      result: { ...landing },
      value: doubled,
    }];
  } else {
    next[height][column] = tile;
    landing = { row: height, col: column };
  }

  const resolved = resolveMerges(next, landing, Math.max(highestBlock, ...collisionMerge.map((merge) => merge.value)));

  // After all merges, check if the resulting board is truly stuck.
  const boardFull = resolved.board[ROWS - 1].every((cell) => cell !== null);
  const stuck = boardFull && !hasPossibleMerge(resolved.board);

  return {
    board: resolved.board,
    gameOver: stuck,
    scoreGained: collisionScore + resolved.scoreGained,
    merges: [...collisionMerge, ...resolved.merges],
    mergeSteps: [...collisionStep, ...resolved.mergeSteps],
    landing: resolved.active,
  };
}

export const shootTile = placeTileInColumn;
export const calculateScore = (merges: MergeEvent[]): number => merges.reduce((sum, merge) => sum + merge.value, 0);

export const isGameOver = (board: Board): boolean => {
  if (!board[ROWS - 1].every((cell) => cell !== null)) return false;
  return !hasPossibleMerge(board);
};
