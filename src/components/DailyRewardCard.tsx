import { useTranslation } from '../i18n';
import { useDailyGiftStatus } from '../hooks/useDailyGiftStatus';
import { formatCountdown } from '../game/dailyRewards';

export function DailyRewardCard({ onOpen }: { onOpen: () => void }) {
  const { t } = useTranslation();
  const daily = useDailyGiftStatus();
  return (
    <aside className="daily-reward-card">
      <div className="reward-gift" aria-hidden="true"><i /><span /></div>
      <div><strong>{t('dailyReward')}</strong><small>{daily.ready ? t('claimFree') : formatCountdown(daily.remaining)}</small></div>
      <button onClick={onOpen}>{daily.ready ? t('claim') : t('viewGifts')}</button>
      <span className="reward-gems">{daily.gift.booster ? t(daily.gift.booster === 'hammer' ? 'smash' : daily.gift.booster) : `◆ ${daily.gift.gems}`}</span>
      {daily.ready && <b className="reward-dot" />}
    </aside>
  );
}
