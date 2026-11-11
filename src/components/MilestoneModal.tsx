import type { MilestoneInfo } from '../game/types';
import { Tile } from './Tile';
import { useTranslation } from '../i18n';
import { RewardClaimButtons } from './RewardClaimButtons';

export function MilestoneModal({ info, onClaim, busy, available }: { info: MilestoneInfo; onClaim: (double: boolean) => void; busy: boolean; available: boolean }) {
  const { t, formatNumber } = useTranslation();
  return (
    <div className="modal-layer milestone-layer">
      <div className="milestone-confetti" aria-hidden="true"><i /><i /><i /><i /><i /><i /></div>
      <div className="modal-card milestone-modal">
        <small>{t('progressionMilestone')}</small>
        <h2>{t('reached', { value: formatNumber(info.current) })}</h2>
        <div className="milestone-current"><Tile value={info.current} crown /></div>
        <div className="retirement-announcement">
          <div className="retired-tile"><Tile value={info.retired} /><i /></div>
          <div><small>{t('blockRetired')}</small><strong>{t('noLongerAppear', { value: formatNumber(info.retired) })}</strong></div>
        </div>
        <div className="next-milestone-copy"><small>{t('nextMilestone')}</small><strong>{formatNumber(info.next)}</strong></div>
        <RewardClaimButtons value={info.current} busy={busy} available={available} onClaim={onClaim} />
      </div>
    </div>
  );
}
