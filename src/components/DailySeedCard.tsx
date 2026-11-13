import { useTranslation } from '../i18n';

interface DailySeedCardProps {
  day: string;
  bestScore: number;
  longestChain: number;
  canResume: boolean;
  onPlay: () => void;
}

export function DailySeedCard({ day, bestScore, longestChain, canResume, onPlay }: DailySeedCardProps) {
  const { t, formatNumber, locale } = useTranslation();
  const date = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${day}T00:00:00Z`));

  return (
    <section className="daily-seed-card" aria-label={t('dailySeedChallenge')}>
      <div className="daily-seed-emblem" aria-hidden="true"><span>◆</span><i>✦</i></div>
      <div className="daily-seed-copy">
        <div className="daily-seed-heading"><strong>{t('dailySeedChallenge')}</strong><time dateTime={day}>{date}</time></div>
        <p>{t('dailySeedSameBoard')}</p>
        <div className="daily-seed-records">
          <span>{t('dailySeedPersonalBest')} <b>{formatNumber(bestScore)}</b></span>
          <span>{t('dailySeedLongestChain')} <b>{formatNumber(longestChain)}</b></span>
        </div>
      </div>
      <button type="button" onClick={onPlay} aria-label={t(canResume ? 'dailySeedContinue' : 'dailySeedStart')}>
        {canResume ? t('dailySeedContinue') : t('dailySeedStart')} <i aria-hidden="true">›</i>
      </button>
    </section>
  );
}
