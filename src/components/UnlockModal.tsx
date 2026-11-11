import { REWARD_VALUES } from '../game/constants';
import type { TileValue } from '../game/types';
import { Tile } from './Tile';
import { useTranslation } from '../i18n';
import { RewardClaimButtons } from './RewardClaimButtons';

export function UnlockModal({ value, onClaim, busy, available }: { value: TileValue; onClaim: (double: boolean) => void; busy: boolean; available: boolean }) {
  const { t } = useTranslation();
  const reward = REWARD_VALUES[value] ?? 10;
  return (
    <div className="modal-layer celebration-layer">
      <div className="confetti" aria-hidden="true">{Array.from({ length: 18 }, (_, i) => <i key={i} />)}</div>
      <div className="modal-card unlock-modal">
        <small>{t('newMilestone')}</small>
        <h2>{t('newBlockUnlocked')}</h2>
        <div className="unlock-rays"><Tile value={value} crown /></div>
        <span className="reward-label">{t('yourReward')}</span>
        <strong className="reward-amount"><i>◆</i> +{reward}</strong>
        <RewardClaimButtons value={value} busy={busy} available={available} onClaim={onClaim} />
      </div>
    </div>
  );
}
