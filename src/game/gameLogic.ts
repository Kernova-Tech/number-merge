import { COLS, ROWS } from './constants';
import { getSpawnPool, getRetiredValuesForHighest } from './milestones';
import { generateWeightedTile } from './tileGeneration';
import type { Board, MergeEvent, MergeShape, MergeStep, Position, ShotResult, TileValue } from './types';

export const createEmptyBoard = (): Board =>
  Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => null));

export const cloneBoard = (board: Board): Board => board.map((row) => [...row]);

export function createInitialBoard(retiredTiles: TileValue[] = [], random = Math.random): Board {
  const board = createEmptyBoard();
  const pool = [...new Set(getSpawnPool(retiredTiles))]; // unique non-retired values
  for (let col = 0; col < COLS; col += 1) {
    const height = random() > 0.55 ? 2 : 1;
    for (let row = 0; row < height; row += 1) {
      board[row][col] = pool[Math.floor(random() * pool.length)];
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

// Four cardinal directions only: up, down, left, right. Diagonal contact does
// not join a group. Keeping this order stable makes every cascade reproducible.
const NEIGHBOR_DIRS = [
  { row: -1, col: 0 },
  { row: 1, col: 0 },
  { row: 0, col: -1 },
  { row: 0, col: 1 },
] as const;

type MatchingGroup = {
  value: TileValue;
  cells: Position[];
  positions: Position[];
  incomingSource?: Position;
};

export interface MergeResolutionOptions {
  /** Include an arriving shot at its physical impact cell, even if it is just outside a full board. */
  incomingPosition?: Position;
  /** Used only for board-wide settling operations such as initial setup and the hammer booster. */
  scanWholeBoard?: boolean;
}

function positionKey({ row, col }: Position): string {
  return `${row}:${col}`;
}

function sortPositions(positions: Position[]): Position[] {
  return positions.sort((a, b) => a.row - b.row || a.col - b.col);
}

function collectConnectedGroup(board: Board, start: Position, value: TileValue, incomingPosition?: Position): Position[] {
  const incomingKey = incomingPosition ? positionKey(incomingPosition) : null;
  const isMatchingPosition = (position: Position) => {
    if (incomingKey === positionKey(position)) return true;
    return position.row >= 0 && position.row < ROWS
      && position.col >= 0 && position.col < COLS
      && board[position.row][position.col] === value;
  };
  if (!isMatchingPosition(start)) return [];
  const queue = [{ ...start }];
  const found = new Set([positionKey(start)]);
  const cells: Position[] = [];

  for (let index = 0; index < queue.length; index += 1) {
    const cell = queue[index];
    cells.push(cell);
    for (const { row: dr, col: dc } of NEIGHBOR_DIRS) {
      const neighbor = { row: cell.row + dr, col: cell.col + dc };
      if (neighbor.row < 0 || neighbor.row >= ROWS || neighbor.col < 0 || neighbor.col >= COLS) continue;
      const key = positionKey(neighbor);
      if (!found.has(key) && (key === incomingKey || board[neighbor.row][neighbor.col] === value)) {
        found.add(key);
        queue.push(neighbor);
      }
    }

    if (incomingPosition) {
      for (const { row: dr, col: dc } of NEIGHBOR_DIRS) {
        const neighbor = { row: cell.row + dr, col: cell.col + dc };
        const key = positionKey(neighbor);
        if (key === incomingKey && !found.has(key)) {
          found.add(key);
          queue.push(neighbor);
        }
      }
    }
  }

  return sortPositions(cells);
}

function canonicalShapeKey(positions: Position[]): string {
  const transforms = [
    (row: number, col: number) => [row, col],
    (row: number, col: number) => [row, -col],
    (row: number, col: number) => [-row, col],
    (row: number, col: number) => [-row, -col],
    (row: number, col: number) => [col, row],
    (row: number, col: number) => [col, -row],
    (row: number, col: number) => [-col, row],
    (row: number, col: number) => [-col, -row],
  ];

  return transforms.map((transform) => {
    const points = positions.map(({ row, col }) => transform(row, col));
    const minRow = Math.min(...points.map(([row]) => row));
    const minCol = Math.min(...points.map(([, col]) => col));
    return points
      .map(([row, col]) => `${row - minRow},${col - minCol}`)
      .sort()
      .join(';');
  }).sort()[0];
}

const RECOGNIZED_SHAPES = new Map<string, Exclude<MergeShape, 'pair' | 'line' | 'cluster'>>([
  [canonicalShapeKey([{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 1, col: 0 }]), 'l'],
  [canonicalShapeKey([{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 }, { row: 1, col: 2 }]), 'l'],
  [canonicalShapeKey([{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 }, { row: 1, col: 1 }]), 't'],
  [canonicalShapeKey([{ row: 0, col: 1 }, { row: 1, col: 0 }, { row: 1, col: 1 }, { row: 1, col: 2 }, { row: 2, col: 1 }]), 'plus'],
  [canonicalShapeKey([{ row: 0, col: 0 }, { row: 0, col: 1 }, { row: 1, col: 0 }, { row: 1, col: 1 }]), 'square'],
  [canonicalShapeKey([{ row: 0, col: 1 }, { row: 0, col: 2 }, { row: 1, col: 0 }, { row: 1, col: 1 }]), 'zigzag'],
]);

export function classifyMergeShape(cells: Position[], tileCount = cells.length): MergeShape {
  if (tileCount <= 2) return 'pair';
  if (cells.length < 2) return 'cluster';
  const sameRow = cells.every((cell) => cell.row === cells[0].row);
  const sameColumn = cells.every((cell) => cell.col === cells[0].col);
  if (sameRow || sameColumn) return 'line';
  return RECOGNIZED_SHAPES.get(canonicalShapeKey(cells)) ?? 'cluster';
}

// A connected group is worth one doubling for its first tile, then one more
// doubling for each additional tile: four 8s therefore calculate to 8 * 2^3.
// Shape-specific calculators are explicit so pattern rules can evolve without
// hard-coding a denomination or a result such as 64.
type MergeCalculator = (value: TileValue, tileCount: number) => TileValue;
const calculateByGroupSize: MergeCalculator = (value, tileCount) => value * (2 ** (tileCount - 1));
const MERGE_CALCULATORS: Record<MergeShape, MergeCalculator> = {
  pair: calculateByGroupSize,
  line: calculateByGroupSize,
  l: calculateByGroupSize,
  t: calculateByGroupSize,
  plus: calculateByGroupSize,
  square: calculateByGroupSize,
  zigzag: calculateByGroupSize,
  cluster: calculateByGroupSize,
};

export function calculateGroupMergeValue(value: TileValue, tileCount: number, shape: MergeShape): TileValue {
  if (!Number.isFinite(value) || value <= 0 || !Number.isInteger(tileCount) || tileCount < 2) return value;
  return MERGE_CALCULATORS[shape](value, tileCount);
}

function findNextMatchingGroup(
  board: Board,
  preferred: Position,
  incomingPosition: Position | undefined,
  scanWholeBoard: boolean,
): MatchingGroup | null {
  const preferredValue = board[preferred.row]?.[preferred.col];
  if (preferredValue !== null && preferredValue !== undefined) {
    const positions = collectConnectedGroup(board, preferred, preferredValue, incomingPosition);
    if (positions.length >= 2) {
      const incomingKey = incomingPosition ? positionKey(incomingPosition) : null;
      return {
        value: preferredValue,
        positions,
        cells: positions.filter((position) => positionKey(position) !== incomingKey),
        incomingSource: incomingPosition,
      };
    }
  }

  if (!scanWholeBoard) return null;

  const visited = new Set<string>();
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const value = board[row][col];
      const start = { row, col };
      if (value === null || visited.has(positionKey(start))) continue;
      const cells = collectConnectedGroup(board, start, value);
      cells.forEach((cell) => visited.add(positionKey(cell)));
      if (cells.length >= 2) return { value, cells, positions: cells };
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
  options: MergeResolutionOptions = {},
): { board: Board; scoreGained: number; merges: MergeEvent[]; mergeSteps: MergeStep[]; active: Position } {
  let board = removeRetiredTiles(source, highestBlock);
  let active = { ...start };
  let pendingIncomingPosition = options.incomingPosition;
  let scoreGained = 0;
  const merges: MergeEvent[] = [];
  const mergeSteps: MergeStep[] = [];

  while (true) {
    const group = findNextMatchingGroup(board, active, pendingIncomingPosition, options.scanWholeBoard ?? false);
    if (!group) break;
    const target = group.cells.some(({ row, col }) => row === active.row && col === active.col)
      ? { ...active }
      : { ...group.cells[0] };
    const tileCount = group.positions.length;
    const shape = classifyMergeShape(group.positions, tileCount);
    const mergedValue = calculateGroupMergeValue(group.value, tileCount, shape);
    const boardBefore = cloneBoard(board);
    group.cells.forEach(({ row, col }) => { board[row][col] = null; });
    board[target.row][target.col] = mergedValue;
    highestBlock = Math.max(highestBlock, mergedValue);
    scoreGained += mergedValue;

    const retiredAtNewHighest = getRetiredValuesForHighest(highestBlock);
    const activeRowAfterCompression = board.slice(0, target.row).reduce(
      (count, row) => count + (row[target.col] !== null && !retiredAtNewHighest.includes(row[target.col]!) ? 1 : 0),
      0,
    );
    board = removeRetiredTiles(board, highestBlock);
    active = { row: activeRowAfterCompression, col: target.col };
    pendingIncomingPosition = undefined;
    const sources = group.cells.filter(({ row, col }) => row !== target.row || col !== target.col);
    merges.push({ ...active, value: mergedValue, shape, tileCount });
    mergeSteps.push({
      boardBefore,
      boardAfter: cloneBoard(board),
      sources,
      incomingSource: group.incomingSource,
      target,
      result: { ...active },
      value: mergedValue,
      shape,
      tileCount,
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
  let incomingPosition: Position | undefined;
  if (hitsMatch) {
    landing = { row: hitRow, col: column };
    // The shot contacts the matching stack tile, then occupies the next cell
    // below it. Keep that cell virtual so shape detection sees its real position.
    incomingPosition = { row: height, col: column };
  } else {
    next[height][column] = tile;
    landing = { row: height, col: column };
  }

  const resolved = resolveMerges(next, landing, highestBlock, { incomingPosition });

  // After all merges, check if the resulting board is truly stuck.
  const boardFull = resolved.board[ROWS - 1].every((cell) => cell !== null);
  const stuck = boardFull && !hasPossibleMerge(resolved.board);

  return {
    board: resolved.board,
    gameOver: stuck,
    scoreGained: resolved.scoreGained,
    merges: resolved.merges,
    mergeSteps: resolved.mergeSteps,
    landing: resolved.active,
  };
}

export const shootTile = placeTileInColumn;
export const calculateScore = (merges: MergeEvent[]): number => merges.reduce((sum, merge) => sum + merge.value, 0);

export const isGameOver = (board: Board): boolean => {
  if (!board[ROWS - 1].every((cell) => cell !== null)) return false;
  return !hasPossibleMerge(board);
};
