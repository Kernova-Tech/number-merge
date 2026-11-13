// Runtime tile values are powers of two and continue growing with no fixed cap.
export type TileValue = number;
export type Cell = TileValue | null;
export type Board = Cell[][];
export type GameStatus = 'home' | 'playing' | 'paused' | 'game-over';
export type BoosterType = 'hammer' | 'swap' | 'undo';
export type ModalType = 'unlock' | 'milestone' | 'created-again' | 'pause' | 'game-over' | 'daily-result' | 'challenge-result' | 'first-goal' | 'booster-refill' | 'ad-break' | null;

export interface MilestoneInfo {
  current: TileValue;
  retired: TileValue;
  next: number;
}

export interface Position {
  row: number;
  col: number;
}

export interface MergeEvent extends Position {
  value: TileValue;
}

export interface MergeStep {
  boardBefore: Board;
  boardAfter: Board;
  source: Position | null;
  target: Position;
  result: Position;
  value: TileValue;
}

export interface MergeAnimationState {
  step: MergeStep;
  phase: 'connecting' | 'popping';
}

export interface ShotResult {
  board: Board;
  gameOver: boolean;
  scoreGained: number;
  merges: MergeEvent[];
  mergeSteps: MergeStep[];
  landing: Position | null;
}

export interface GameState {
  board: Board;
  status: GameStatus;
  currentTile: TileValue;
  selectedColumn: number;
  score: number;
  bestScore: number;
  gems: number;
  highestBlock: TileValue;
  playerLevel: number;
  boosters: Record<BoosterType, number>;
  modal: ModalType;
}
