import { useState } from 'react';
import type { BoosterType } from '../game/types';
import { BOOSTER_PRICES } from '../game/economy';
import { useTranslation } from '../i18n';
import { RewardVideoIcon } from './RewardVideoIcon';

export function BoosterIcon({ type }: { type: BoosterType }) {
  return <svg viewBox="0 0 32 32" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {type === 'hammer' ? <><path d="m11 13 7 7-9 9-4-4zM10 10l7-7 10 10-7 7z" /><path d="m24 23 3 1M20 26l1 3M27 19l3-1" /></>
      : type === 'swap' ? <><rect x="3" y="4" width="10" height="12" rx="3" /><rect x="19" y="16" width="10" height="12" rx="3" /><path d="M18 7h10m-4-4 4 4-4 4M14 25H4m4-4-4 4 4 4" /></>
      : <><path d="M10 9h9a9 9 0 1 1-7 15M10 3 4 9l6 6M4 9h9" /><path d="M19 13v6h-5" /></>}
  </svg>;
}

export function BoosterBar({ counts, active, onUse, gems, adAvailable, adBusy, disabled, onBuy, onWatch, onOfferChange }: {
  counts: Record<BoosterType, number>; active: BoosterType | null; onUse: (type: BoosterType) => void;
  gems: number; adAvailable: boolean; adBusy: boolean; disabled: boolean;
  onBuy: (type: BoosterType) => void; onWatch: (type: BoosterType) => void;
  onOfferChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const [refill, setRefill] = useState<BoosterType | null>(null);
  const label = (type: BoosterType) => t(type === 'hammer' ? 'smash' : type);
  return <>
    <div className="booster-bar">
      {(['hammer', 'swap', 'undo'] as BoosterType[]).map(type => <button key={type}
        className={active === type ? 'active' : ''} disabled={disabled || adBusy}
        onClick={() => { if (counts[type] > 0) onUse(type); else { setRefill(type); onOfferChange(true); } }}
        aria-label={counts[type] > 0 ? label(type) : t('refillBooster', { name: label(type) })}>
        <span className={`booster-icon ${type}`}><BoosterIcon type={type} /></span>
        <span className="booster-copy"><strong>{label(type)}</strong><small>{counts[type] > 0 ? `×${counts[type]}` : '+'}</small></span>
      </button>)}
    </div>
    {refill && <div className="modal-layer"><div className="modal-card booster-refill" role="dialog" aria-modal="true" aria-label={t('refillBooster', { name: label(refill) })}>
      <BoosterIcon type={refill} /><h2>{t('refillBooster', { name: label(refill) })}</h2>
      <button className="modal-primary" disabled={gems < BOOSTER_PRICES[refill] || adBusy || disabled} onClick={() => { onBuy(refill); setRefill(null); onOfferChange(false); }}>{t('buyBooster', { price: BOOSTER_PRICES[refill] })}</button>
      <button className="modal-secondary reward-video-button" disabled={!adAvailable || adBusy || disabled} onClick={() => onWatch(refill)}><RewardVideoIcon /><span>{adBusy ? t('adWaiting') : t('watchBooster')}</span></button>
      {!adAvailable && <small className="ad-availability">{t('nativeAdsOnly')}</small>}
      <button className="modal-link" disabled={adBusy} onClick={() => { setRefill(null); onOfferChange(false); }}>{t('cancel')}</button>
    </div></div>}
  </>;
}
