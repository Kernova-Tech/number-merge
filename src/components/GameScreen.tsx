import { useEffect } from 'react';
import { getNextMilestone } from '../game/milestones';
import type { GameEngine } from '../hooks/useGameEngine';
import { Board } from './Board';
import { BoosterBar } from './BoosterBar';
// import { FakeAdBanner } from './FakeAdBanner';
import { FirstGoalModal } from './FirstGoalModal';
import { GameOverModal } from './GameOverModal';
import { PauseModal } from './PauseModal';
import { MilestoneModal } from './MilestoneModal';
import { Shooter } from './Shooter';
import { TopBar } from './TopBar';
import { TutorialOverlay } from './TutorialOverlay';
import { UnlockModal } from './UnlockModal';
import { useTranslation } from '../i18n';

export function GameScreen({ game }: { game: GameEngine }) {
  const { t, formatNumber } = useTranslation();
  const nextMilestone = getNextMilestone(game.highestBlock);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') game.moveSelection(-1);
      if (event.key === 'ArrowRight') game.moveSelection(1);
      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault(); game.shoot();
      }
      if (event.key.toLowerCase() === 'p') game.modal === 'pause' ? game.resume() : game.pause();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [game]);

  return (
    <section className="game-screen">
      <TopBar gems={game.gems} score={game.score} bestScore={game.bestScore} />
      <div className="goal-strip"><span>{t('goal')}</span><i>★</i><strong>{formatNumber(nextMilestone)}</strong></div>
      <Board
        board={game.board}
        selectedColumn={game.selectedColumn}
        hammerActive={game.hammerActive}
        isShooting={game.isShooting}
        shotTile={game.shotTile}
        shotTargetRow={game.shotTargetRow}
        shotDuration={game.shotDuration}
        mergeEvents={game.mergeEvents}
        mergeAnimation={game.mergeAnimation}
        combo={game.combo}
        crownedValue={game.highestBlock}
        onColumnClick={game.shoot}
        onHammerHit={game.hitWithHammer}
      />
      <Shooter
        currentTile={game.currentTile}
        nextTile={game.nextTile}
        selectedColumn={game.selectedColumn}
        isShooting={game.isShooting}
        isPromotingNextTile={game.isPromotingNextTile}
        isResolvingMerge={game.isResolvingMerge}
        onSelect={game.selectColumn}
        onShoot={game.shoot}
        onPause={game.pause}
      />
      <BoosterBar counts={game.boosters} active={game.hammerActive ? 'hammer' : null} onUse={game.useBooster}
        gems={game.gems} adAvailable={game.adAvailable} adBusy={game.adBusy}
        disabled={game.isShooting || game.isResolvingMerge || game.isPromotingNextTile || (!!game.modal && game.modal !== 'booster-refill') || game.tutorialStep > 0}
        onBuy={game.buyBooster} onWatch={game.watchForBooster} onOfferChange={game.setBoosterOfferOpen} />
      {/* <FakeAdBanner /> */}
      <TutorialOverlay step={game.tutorialStep} onSkip={game.skipTutorial} />
      {game.modal === 'pause' && <PauseModal onResume={game.resume} onRestart={game.restart} onHome={game.goHome} />}
      {game.modal === 'unlock' && game.modalTile && <UnlockModal value={game.modalTile} onClaim={game.claimUnlock} busy={game.adBusy} available={game.adAvailable} />}
      {game.modal === 'milestone' && game.milestoneInfo && <MilestoneModal info={game.milestoneInfo} onClaim={game.claimUnlock} busy={game.adBusy} available={game.adAvailable} />}
      {game.modal === 'game-over' && <GameOverModal score={game.score} best={game.bestScore} onRestart={game.restart} onHome={game.goHome} />}
      {game.modal === 'first-goal' && <FirstGoalModal onContinue={game.closeGoal} />}
    </section>
  );
}
