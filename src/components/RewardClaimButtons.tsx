import { REWARD_VALUES } from '../game/constants';
import { useTranslation } from '../i18n';
import { RewardVideoIcon } from './RewardVideoIcon';

export function RewardClaimButtons({ value, busy, available, onClaim }: {
  value: number; busy: boolean; available: boolean; onClaim: (double: boolean) => void;
}) {
  const { t, formatNumber } = useTranslation();
  const reward = REWARD_VALUES[value] ?? 10;
  return <div className="reward-choices" aria-busy={busy}>
    <button className="modal-primary" disabled={busy || !available} onClick={() => onClaim(true)}>
      <RewardVideoIcon /><span>{busy ? t('adWaiting') : t('watchDouble', { amount: formatNumber(reward * 2) })}</span>
    </button>
    {!available && <small className="ad-availability">{t('nativeAdsOnly')}</small>}
    <button className="modal-secondary" disabled={busy} onClick={() => onClaim(false)}>{t('claimGems', { amount: formatNumber(reward) })}</button>
  </div>;
}
