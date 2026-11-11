import { COLS, ROWS } from '../game/constants';
import type { Board as BoardType, MergeAnimationState, MergeEvent, Position, TileValue } from '../game/types';
import { Tile } from './Tile';
import { useTranslation } from '../i18n';

interface BoardProps {
  board: BoardType;
  selectedColumn: number;
  hammerActive: boolean;
  isShooting: boolean;
  shotTile: TileValue | null;
  shotTargetRow: number;
  shotDuration: number;
  mergeEvents: MergeEvent[];
  mergeAnimation: MergeAnimationState | null;
  combo: number;
  crownedValue: TileValue | null;
  onColumnClick: (column: number) => void;
  onHammerHit: (position: Position) => void;
}

export function Board({
  board, selectedColumn, hammerActive, isShooting, shotTile, shotTargetRow, shotDuration, mergeEvents, mergeAnimation, combo, crownedValue,
  onColumnClick, onHammerHit,
}: BoardProps) {
  const { t } = useTranslation();
  const latestMerge = mergeEvents.at(-1);
  return (
    <div className={`board ${hammerActive ? 'hammer-mode' : ''}`}>
      {Array.from({ length: COLS }, (_, col) => (
        <button
          key={`lane-${col}`}
          className={`lane ${selectedColumn === col ? 'selected' : ''}`}
          onClick={() => onColumnClick(col)}
          aria-label={t('shootColumn', { column: col + 1 })}
        />
      ))}
      <div className="board-grid">
        {Array.from({ length: ROWS }, (_, row) =>
          Array.from({ length: COLS }, (_, col) => {
            const value = board[row][col];
            const source = mergeAnimation?.phase === 'connecting' && mergeAnimation.step.source?.row === row && mergeAnimation.step.source.col === col;
            const target = mergeAnimation?.phase === 'connecting' && mergeAnimation.step.target.row === row && mergeAnimation.step.target.col === col;
            const popping = mergeAnimation?.phase === 'popping' && mergeAnimation.step.result.row === row && mergeAnimation.step.result.col === col;
            const sourceStyle = source && mergeAnimation?.step.source ? {
              '--merge-x': `${(mergeAnimation.step.target.col - mergeAnimation.step.source.col) * 115}%`,
              '--merge-y': `${(mergeAnimation.step.target.row - mergeAnimation.step.source.row) * 105}%`,
              '--merge-x-mid': `${(mergeAnimation.step.target.col - mergeAnimation.step.source.col) * 78}%`,
              '--merge-y-mid': `${(mergeAnimation.step.target.row - mergeAnimation.step.source.row) * 71}%`,
            } as React.CSSProperties : undefined;
            return (
              <div
                className={`board-cell ${source ? 'merge-source-cell' : ''} ${target ? 'merge-target-cell' : ''} ${popping ? 'merge-pop-cell' : ''}`}
                key={`${row}-${col}`}
                style={sourceStyle}
                onClick={(event) => {
                  if (!hammerActive || value === null) return;
                  event.stopPropagation();
                  onHammerHit({ row, col });
                }}
              >
                {value !== null && <Tile value={value} crown={value === crownedValue} className={`${value === crownedValue ? 'board-milestone-tile' : ''} ${source ? 'merge-source-tile' : ''} ${target ? 'merge-target-tile' : ''} ${popping ? 'merge-pop-tile' : ''}`} />}
                {popping && <span className="merge-burst obvious-merge-burst" />}
              </div>
            );
          }),
        )}
      </div>
      {isShooting && shotTile && (
        <div
          className="shot-flight"
          style={{
            '--shot-column': selectedColumn,
            '--shot-target': shotTargetRow,
            '--shot-duration': `${shotDuration}ms`,
          } as React.CSSProperties}
        >
          <span className="shot-light-core" aria-hidden="true" />
          <Tile value={shotTile} />
        </div>
      )}
      {latestMerge && (
        <div
          className="floating-score"
          style={{ '--float-row': latestMerge.row, '--float-column': latestMerge.col } as React.CSSProperties}
        >
          +{latestMerge.value}
        </div>
      )}
      {combo > 1 && <div className="combo-pop">{t('combo')} <b>×{combo}</b></div>}
      {hammerActive && <div className="hammer-hint">{t('tapSmash')}</div>}
    </div>
  );
}
