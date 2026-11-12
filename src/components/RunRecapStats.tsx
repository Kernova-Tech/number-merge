import type { ChallengeRunStats } from '../game/challengeRuns';
import { useTranslation } from '../i18n';

export function RunRecapStats({ stats, fourthLabel, fourthValue }: {
  stats: ChallengeRunStats;
  fourthLabel: string;
  fourthValue: string | number;
}) {
  const { t, formatNumber } = useTranslation();
  const items = [
    [t('runHighestTile'), formatNumber(stats.highestTile)],
    [t('bestCascade'), formatNumber(stats.longestCascade)],
    [t('shots'), formatNumber(stats.shots)],
    [fourthLabel, typeof fourthValue === 'number' ? formatNumber(fourthValue) : fourthValue],
  ];

  return <div className="run-recap-grid" aria-label={t('runRecap')}>
    {items.map(([label, value]) => <div key={label}><small>{label}</small><strong>{value}</strong></div>)}
  </div>;
}
