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
  shotTargetColumn: number;
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
  board, selectedColumn, hammerActive, isShooting, shotTile, shotTargetColumn, shotTargetRow, shotDuration, mergeEvents, mergeAnimation, combo, crownedValue,
  onColumnClick, onHammerHit,
}: BoardProps) {
  const { t } = useTranslation();
  const latestMerge = mergeEvents.at(-1);
  const mergingIncomingShot = mergeAnimation?.phase === 'connecting'
    ? mergeAnimation.step.incomingSource
    : undefined;
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
            const mergeStep = mergeAnimation?.step;
            const sourceIndex = mergeAnimation?.phase === 'connecting'
              ? mergeStep?.sources.findIndex((position) => position.row === row && position.col === col) ?? -1
              : -1;
            const source = sourceIndex >= 0;
            const target = mergeAnimation?.phase === 'connecting' && mergeAnimation.step.target.row === row && mergeAnimation.step.target.col === col;
            const popping = mergeAnimation?.phase === 'popping' && mergeAnimation.step.result.row === row && mergeAnimation.step.result.col === col;
            const sourcePosition = source ? mergeStep?.sources[sourceIndex] : undefined;
            const sourceStyle = source && sourcePosition && mergeStep ? {
              '--merge-x': `${(mergeStep.target.col - sourcePosition.col) * 115}%`,
              '--merge-y': `${(mergeStep.target.row - sourcePosition.row) * 105}%`,
              '--merge-x-mid': `${(mergeStep.target.col - sourcePosition.col) * 78}%`,
              '--merge-y-mid': `${(mergeStep.target.row - sourcePosition.row) * 71}%`,
              '--merge-source-index': sourceIndex,
              '--merge-spin': sourceIndex % 2 === 0 ? '12deg' : '-12deg',
              '--merge-spin-reverse': sourceIndex % 2 === 0 ? '-12deg' : '12deg',
            } as React.CSSProperties : undefined;
            const mergeShape = mergeAnimation?.step.shape;
            const shapeClass = mergeShape ? `merge-pattern-${mergeShape}` : '';
            return (
              <div
                className={`board-cell ${source ? 'merge-source-cell' : ''} ${target ? 'merge-target-cell' : ''} ${popping ? 'merge-pop-cell' : ''} ${source || target || popping ? shapeClass : ''}`}
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
        <>
          <span
            className="shot-launch-flare"
            style={{ '--shot-column': shotTargetColumn } as React.CSSProperties}
            aria-hidden="true"
          />
          <div
            className={`shot-flight${mergingIncomingShot ? ' shot-merging' : ''}`}
            style={{
              '--shot-column': shotTargetColumn,
              '--shot-target': shotTargetRow,
              ...(mergingIncomingShot && mergeAnimation ? { '--shot-merge-target': mergeAnimation.step.target.row } : {}),
              '--shot-duration': `${shotDuration}ms`,
            } as React.CSSProperties}
          >
            <span className="shot-light-core" aria-hidden="true" />
            <Tile value={shotTile} />
          </div>
        </>
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
