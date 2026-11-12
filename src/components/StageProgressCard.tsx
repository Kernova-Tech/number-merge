import { useTranslation } from '../i18n';

export function StageProgressCard({ bestScore, goal, progress, onChallenges }: { bestScore: number; goal: number; progress: number; onChallenges: () => void }) {
  const { t, formatNumber } = useTranslation();
  return (
    <section className="stage-progress-card">
      <div className="stage-trophy" aria-hidden="true">♛</div>
      <div className="stage-details"><small>{t('stage')}</small><strong>{t('classicMerge')}</strong><span>{t('goalReach')} <b>{formatNumber(goal)}</b></span></div>
      <div className="stage-best"><small>{t('bestScore')}</small><strong>{formatNumber(bestScore)}</strong><button className="stage-challenge-button" onClick={onChallenges}>✦ {t('challengeButton')}</button></div>
      <div className="stage-track"><i style={{ width: `${Math.max(8, progress)}%` }} /><b /><b /><b /><b /></div>
    </section>
  );
}
