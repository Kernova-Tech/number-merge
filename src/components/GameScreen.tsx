import { useEffect } from 'react';
import { getNextMilestone } from '../game/milestones';
import type { GameEngine } from '../hooks/useGameEngine';
import { Board } from './Board';
import { BoosterBar } from './BoosterBar';
// import { FakeAdBanner } from './FakeAdBanner';
import { FirstGoalModal } from './FirstGoalModal';
import { AdBreakModal } from './AdBreakModal';
import { GameOverModal } from './GameOverModal';
import { ChallengeRunResultModal } from './ChallengeRunResultModal';
import { DailySeedResultModal } from './DailySeedResultModal';
import { PauseModal } from './PauseModal';
import { MilestoneModal } from './MilestoneModal';
import { Shooter } from './Shooter';
import { TopBar } from './TopBar';
import { TutorialOverlay } from './TutorialOverlay';
import { UnlockModal } from './UnlockModal';
import { useTranslation } from '../i18n';
import { getChallengeRun } from '../game/challengeRuns';

export function GameScreen({ game }: { game: GameEngine }) {
  const { t, formatNumber } = useTranslation();
  const nextMilestone = getNextMilestone(game.highestBlock);
  const challenge = game.challengeId ? getChallengeRun(game.challengeId) : null;
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
      <TopBar gems={game.gems} score={game.score} bestScore={game.mode === 'challenge' ? game.challengeBestScore : game.bestScore} />
      <div className={`goal-strip${game.mode === 'daily-seed' ? ' daily-seed-goal' : game.mode === 'challenge' ? ' challenge-goal' : ''}`}>
        {game.mode === 'challenge' && challenge ? <>
          <span>{t(challenge.titleKey)}</span><i>★</i>
          <strong>{challenge.targetCascade ? `${Math.min(game.runStats.longestCascade, challenge.targetCascade)}/${challenge.targetCascade}` : formatNumber(challenge.targetTile ?? 0)}</strong>
          <small>{formatNumber(game.challengeMovesRemaining)} {t('movesLeft')}</small>
        </> : <><span>{game.mode === 'daily-seed' ? t('dailySeedChallenge') : t('goal')}</span><i>★</i><strong>{formatNumber(nextMilestone)}</strong></>}
      </div>
      <Board
        board={game.board}
        selectedColumn={game.selectedColumn}
        hammerActive={game.hammerActive}
        isShooting={game.isShooting}
        shotTile={game.shotTile}
        shotTargetColumn={game.shotTargetColumn}
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
      {game.mode === 'classic' && <BoosterBar counts={game.boosters} active={game.hammerActive ? 'hammer' : null} onUse={game.useBooster}
        gems={game.gems} adAvailable={game.adAvailable} adBusy={game.adBusy}
        disabled={game.isShooting || game.isResolvingMerge || game.isPromotingNextTile || (!!game.modal && game.modal !== 'booster-refill') || game.tutorialStep > 0}
        onBuy={game.buyBooster} onWatch={game.watchForBooster} onOfferChange={game.setBoosterOfferOpen} />}
      {/* <FakeAdBanner /> */}
      <TutorialOverlay step={game.tutorialStep} onSkip={game.skipTutorial} />
      {game.modal === 'pause' && <PauseModal onResume={game.resume} onRestart={game.restart} onHome={game.goHome} />}
      {game.modal === 'unlock' && game.modalTile && <UnlockModal value={game.modalTile} onClaim={game.claimUnlock} busy={game.adBusy} available={game.adAvailable} />}
      {game.modal === 'milestone' && game.milestoneInfo && <MilestoneModal info={game.milestoneInfo} onClaim={game.claimUnlock} busy={game.adBusy} available={game.adAvailable} />}
      {game.modal === 'game-over' && <GameOverModal score={game.score} best={game.bestScore} stats={game.runStats} nextMilestone={nextMilestone} onRestart={game.restart} onHome={game.goHome} />}
      {game.modal === 'challenge-result' && game.challengeId && <ChallengeRunResultModal id={game.challengeId} outcome={game.challengeOutcome ?? 'failed'} score={game.score} bestScore={game.challengeBestScore} stats={game.runStats} onRestart={game.restart} onHome={game.goHome} />}
      {game.modal === 'daily-result' && <DailySeedResultModal day={game.dailySeedDay} score={game.score} personalBest={game.dailySeedBestScore}
        longestChain={game.dailySeedLongestChain} isNewBest={game.score > game.dailySeedRunBestAtStart} onReplay={game.restart} onHome={game.goHome} />}
      {game.modal === 'first-goal' && <FirstGoalModal onContinue={game.closeGoal} />}
      {game.modal === 'ad-break' && game.adBreakScore !== null && <AdBreakModal score={game.adBreakScore} onRequestBreak={game.requestAdBreak} onComplete={game.finishAdBreak} />}
    </section>
  );
}
