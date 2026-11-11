import { useTranslation } from '../i18n';

export function RewardVideoIcon() {
  const { t } = useTranslation();
  return <svg className="reward-video-icon" viewBox="0 0 32 26" role="img" aria-label={t('rewardVideo')}>
    <rect x="1.5" y="3" width="28" height="20" rx="5" fill="none" stroke="currentColor" strokeWidth="1.8" />
    <path d="m11 8 8 5-8 5Z" fill="currentColor" />
    <rect x="18" y="0" width="14" height="9" rx="2.5" fill="currentColor" />
    <text x="25" y="6.8" textAnchor="middle" fontSize="6.5" fontWeight="900" fill="#0b402b">AD</text>
  </svg>;
}
