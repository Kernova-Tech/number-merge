import type { GameEngine } from '../hooks/useGameEngine';
import type { challengeStatus } from '../game/challenges';
import { formatCountdown } from '../game/dailyRewards';
import { useTranslation } from '../i18n';

export function ChallengeIcon({ kind }: { kind: 'merges' | 'tile' | 'chain' }) {
  return <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {kind === 'merges' ? <><rect x="2" y="7" width="10" height="10" rx="3" /><rect x="20" y="7" width="10" height="10" rx="3" /><path d="m9 23 7 5 7-5M16 28V15m-4 4 4-4 4 4" /></>
      : kind === 'tile' ? <><rect x="5" y="6" width="22" height="23" rx="6" /><path d="m9 7-2-5 6 3 3-4 3 4 6-3-2 5" /><path d="m13 20 3-5 3 5m-7 3h8" /></>
      : <><path d="m8 21 13-13M5 16l-2 2a7 7 0 0 0 10 10l5-5a7 7 0 0 0 0-10M27 16l2-2A7 7 0 0 0 19 4l-5 5a7 7 0 0 0 0 10" /><path d="m23 22 1 4m-5-3-2 4" /></>}
  </svg>;
}

export function ChallengesPanel({ status, game, onPlay, onCollected }: {
  status: ReturnType<typeof challengeStatus>; game: GameEngine; onPlay: () => void; onCollected: (amount: number) => void;
}) {
  const { t, formatNumber } = useTranslation();
  return <div className="challenges-panel">
    <div className="challenge-section-heading"><div><span className="collection-eyebrow">{t('dailyMissions')}</span><h2>{t('challengeHeading')}</h2></div><span className="mission-completion">{status.claimed}/3 <small>{t('collectedStatus')}</small></span></div>
    <div className="challenge-cards">
      {status.tasks.map(task => <article key={task.id} className={`challenge-card challenge-${task.id} ${task.claimed ? 'is-collected' : task.complete ? 'is-ready' : ''}`}>
        <div className="challenge-emblem"><ChallengeIcon kind={task.id} /><span>{task.claimed ? '✓' : task.complete ? '!' : '★'}</span></div>
        <div className="challenge-copy"><h3>{t(task.title)}</h3><p>{t(task.description)}</p>
          <div className="challenge-progress-label"><span>{formatNumber(task.value)} / {formatNumber(task.target)}</span><b>◆ {task.gems}</b></div>
          <div className="challenge-progress" role="progressbar" aria-label={t(task.title)} aria-valuemin={0} aria-valuemax={task.target} aria-valuenow={task.value}><i style={{ width: `${Math.min(100, task.value / task.target * 100)}%` }} /></div>
        </div>
        <button className="challenge-collect" disabled={!task.complete || task.claimed || game.adBusy} onClick={() => { if (game.collectChallengeReward(task.id)) onCollected(task.gems); }}>
          {task.claimed ? t('collectedStatus') : task.complete ? t('claimGems', { amount: task.gems }) : t('inProgress')}
        </button>
      </article>)}
    </div>
    <div className="mission-reset"><span>{t('missionReset')}</span><time>{formatCountdown(status.remaining)}</time></div>
    <button className="mission-play" onClick={onPlay}>{t('playNow')} <span aria-hidden="true">▶</span></button>
  </div>;
}
