import { getChallengeRun, type ChallengeRunId, type ChallengeRunStats } from '../game/challengeRuns';
import type { ChallengeRunOutcome } from '../game/challengeRuns';
import { useTranslation } from '../i18n';
import { RunRecapStats } from './RunRecapStats';

export function ChallengeRunResultModal({ id, outcome, score, bestScore, stats, onRestart, onHome }: {
  id: ChallengeRunId;
  outcome: Exclude<ChallengeRunOutcome, null>;
  score: number;
  bestScore: number;
  stats: ChallengeRunStats;
  onRestart: () => void;
  onHome: () => void;
}) {
  const { t, formatNumber } = useTranslation();
  const won = outcome === 'won';
  const challenge = getChallengeRun(id);
  return <div className="modal-layer">
    <section className={`modal-card challenge-result-modal${won ? ' is-won' : ''}`} role="dialog" aria-modal="true" aria-labelledby="challenge-result-title">
      <div className={`modal-emblem${won ? ' challenge-win-emblem' : ' danger'}`} aria-hidden="true">{won ? '✓' : '↻'}</div>
      <small>{t(challenge.titleKey)}</small>
      <h2 id="challenge-result-title">{t(won ? 'challengeResultWon' : 'challengeResultFailed')}</h2>
      <p>{t(won ? 'challengeWonText' : 'challengeFailedText')}</p>
      <div className="result-row">
        <div><small>{t('score')}</small><strong>{formatNumber(score)}</strong></div>
        <div><small>{t('challengeRecord')}</small><strong>{formatNumber(bestScore)}</strong></div>
      </div>
      <RunRecapStats stats={stats} fourthLabel={t('challengeGoal')} fourthValue={t(challenge.objectiveKey)} />
      <button className="modal-primary" onClick={onRestart}>{t('challengeTryAgain')}</button>
      <button className="modal-link" onClick={onHome}>{t('backHome')}</button>
    </section>
  </div>;
}
