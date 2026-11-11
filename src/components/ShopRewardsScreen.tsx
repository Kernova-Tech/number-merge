import { useEffect, useState } from 'react';
import type { GameEngine } from '../hooks/useGameEngine';
import { useDailyGiftStatus } from '../hooks/useDailyGiftStatus';
import { DAILY_GIFTS, formatCountdown } from '../game/dailyRewards';
import { BOOSTER_PRICES } from '../game/economy';
import type { BoosterType } from '../game/types';
import { useTranslation } from '../i18n';
import { BottomNav } from './BottomNav';
import { BoosterIcon } from './BoosterBar';
import { RewardVideoIcon } from './RewardVideoIcon';
import { ChallengesPanel } from './ChallengesPanel';
import { FloatingParticles } from './FloatingParticles';
import { Tile } from './Tile';

export function ShopRewardsScreen({ mode, game, onHome, onPlay, onProfile, onShop, onRewards }: {
  mode: 'shop' | 'rewards'; game: GameEngine;
  onHome: () => void; onPlay: () => void; onProfile: () => void; onShop: () => void; onRewards: () => void;
}) {
  const { t, formatNumber } = useTranslation();
  const daily = useDailyGiftStatus();
  const [receipt, setReceipt] = useState('');
  const [rewardView, setRewardView] = useState<'gifts' | 'challenges'>('gifts');
  useEffect(() => { if (!receipt) return; const timer = window.setTimeout(() => setReceipt(''), 2200); return () => window.clearTimeout(timer); }, [receipt]);
  useEffect(() => setReceipt(''), [mode]);
  const label = (type: BoosterType) => t(type === 'hammer' ? 'smash' : type);
  const giftLabel = (gift: typeof DAILY_GIFTS[number]) => [gift.gems ? t('giftGems', { amount: formatNumber(gift.gems) }) : '', gift.booster ? `1 ${label(gift.booster)}` : ''].filter(Boolean).join(' + ');
  const collect = (double: boolean) => {
    const message = giftLabel(daily.gift);
    if (game.collectDailyGift(double)) setReceipt(t('giftCollected', { gift: message }));
  };
  const purchase = (item: BoosterType | 'bundle') => {
    if (game.purchaseShopItem(item)) setReceipt(t('purchaseSuccess'));
  };
  // After today's claim, keep its tile selected until the next UTC day.
  const shownIndex = daily.ready ? daily.index : (daily.count - 1) % 7;
  const missionGemsRemaining = daily.challenges.tasks.filter(task => !task.claimed).reduce((sum, task) => sum + task.gems, 0);
  return <section className={`collection-screen ${mode}-screen`}>
    {mode === 'rewards' && <FloatingParticles />}
    <header className="collection-header"><button className="collection-back" onClick={onHome} aria-label={t('backHome')}>‹</button>
      <div><small>{t('numberMerge')}</small><h1>{t(mode)}</h1></div>
      <span className="collection-wallet" key={game.gems}><i>◆</i> {formatNumber(game.gems)}</span>
    </header>
    <div className="collection-content" key={mode}>
      {mode === 'rewards' && <>
        <div className={`rewards-hero ${rewardView === 'challenges' ? 'mission-hero' : ''}`}>
          <div className="hero-kicker"><i />{t('rewardVault')}<i /></div>
          <div className="reward-art" aria-hidden="true"><div className="reward-orbit" /><span className="reward-float-tile left"><Tile value={8} compact /></span><span className="reward-float-tile right"><Tile value={128} compact /></span>
            <div className="reward-treasure"><div className="treasure-light" /><div className="treasure-lid"><i /></div><div className="treasure-box"><i /><b>◆</b></div><span className="treasure-star one">✦</span><span className="treasure-star two">✦</span></div>
          </div>
          <h2>{t(rewardView === 'gifts' ? 'vaultGiftTitle' : 'vaultMissionTitle')}</h2>
          <p>{t(rewardView === 'gifts' ? 'vaultGiftSubtitle' : 'vaultMissionSubtitle')}</p>
          <div className="reward-hero-status"><span>◆</span>{rewardView === 'gifts' ? giftLabel(daily.gift) : t('giftGems', { amount: formatNumber(missionGemsRemaining) })}<small>{t(rewardView === 'gifts' ? daily.ready ? 'readyGift' : 'nextGiftLabel' : missionGemsRemaining ? 'toEarn' : 'collectedStatus')}</small></div>
        </div>
        <div className="reward-view-tabs" role="tablist" aria-label={t('rewardSections')}>
          <button role="tab" id="gift-tab" aria-controls="reward-panel" aria-selected={rewardView === 'gifts'} onClick={() => setRewardView('gifts')}>{t('dailyGiftsTab')}{daily.ready && <i />}</button>
          <button role="tab" id="missions-tab" aria-controls="reward-panel" aria-selected={rewardView === 'challenges'} onClick={() => setRewardView('challenges')}>{t('challengesTab')}<b>{daily.challenges.claimed}/3</b>{daily.challenges.ready && <i />}</button>
        </div>
      </>}
      {mode === 'shop' ? <>
        <div className="collection-intro"><span className="collection-eyebrow">{t('yourInventory')}</span><h2>{t('shopTitle')}</h2><p>{t('shopIntro')}</p></div>
        <div className="shop-items">
          {(['swap', 'undo', 'hammer'] as BoosterType[]).map(type => <article className={`shop-item shop-${type}`} key={type}>
            <span className={`shop-icon booster-icon ${type}`}><BoosterIcon type={type} /></span>
            <div className="shop-item-copy"><h3>{label(type)}</h3><p>{t(`describe_${type}`)}</p><small>{t('ownedCount', { count: formatNumber(game.boosters[type]) })}</small></div>
            <button disabled={game.gems < BOOSTER_PRICES[type] || game.adBusy} onClick={() => purchase(type)} aria-label={t('buyNamed', { name: label(type), price: BOOSTER_PRICES[type] })}><i>◆</i> {BOOSTER_PRICES[type]}</button>
          </article>)}
        </div>
        <article className="shop-bundle"><span className="collection-eyebrow">{t('bundleLabel')}</span><div className="bundle-icons">{(['swap', 'undo', 'hammer'] as BoosterType[]).map(type => <BoosterIcon key={type} type={type} />)}</div><h2>{t('bundleTitle')}</h2><p>{t('bundleDescription')}</p><button disabled={game.gems < 90 || game.adBusy} onClick={() => purchase('bundle')}>{t('buyBundle')} · ◆ 90 <s>105</s></button></article>
        <p className="collection-footnote">{t('shopFootnote')}</p>
      </> : <div id="reward-panel" role="tabpanel" aria-labelledby={rewardView === 'gifts' ? 'gift-tab' : 'missions-tab'} key={rewardView} className={`reward-tab-panel ${rewardView === 'gifts' ? 'gift-panel' : ''}`}>
        {rewardView === 'challenges' ? <ChallengesPanel status={daily.challenges} game={game} onPlay={onPlay} onCollected={amount => setReceipt(t('giftCollected', { gift: t('giftGems', { amount }) }))} /> : <>
        <div className="daily-section-heading"><span>{t('sevenDayJourney')}</span><b>{t('giftDay', { day: shownIndex + 1 })} / 7</b></div>
        <div className="daily-calendar">
          {DAILY_GIFTS.map((gift, index) => {
            const claimed = index < shownIndex || (!daily.ready && index === shownIndex);
            return <div key={index} className={`daily-day ${index === shownIndex ? 'current' : ''} ${claimed ? 'claimed' : ''} ${index === 6 ? 'grand-gift' : ''}`}>
              <small>{t('giftDay', { day: index + 1 })}</small>
              <span className="daily-gift-art">{gift.booster ? <BoosterIcon type={gift.booster} /> : <i>◆</i>}</span>
              <strong>{giftLabel(gift)}</strong><span className="gift-status">{claimed ? '✓' : index === shownIndex ? t('readyGift') : '·'}</span>
            </div>;
          })}
        </div>
        <article className="daily-collect-panel">
          {daily.ready ? <><small>{t('todayGift')}</small><h2>{giftLabel(daily.gift)}</h2>
            <button className="collection-primary" disabled={game.adBusy} onClick={() => collect(false)}>{t('collectGift')}</button>
            {daily.gift.gems > 0 && !daily.gift.booster && <button className="collection-bonus reward-video-button" disabled={!game.adAvailable || game.adBusy} onClick={() => collect(true)}><RewardVideoIcon /><span>{game.adBusy ? t('adWaiting') : t('watchDouble', { amount: formatNumber(daily.gift.gems * 2) })}</span></button>}
            {!game.adAvailable && <small className="ad-availability">{t('nativeAdsOnly')}</small>}
          </> : <><span className="daily-collected-check">✓</span><h2>{t('todayCollected')}</h2><p>{t('nextGiftIn')}</p><time className="daily-countdown">{formatCountdown(daily.remaining)}</time><small>{t('resetUtc')}</small></>}
        </article>
        <p className="collection-footnote">{t('dailyFootnote')}</p>
      </>}
      </div>}
    </div>
    {receipt && <div className="collection-receipt" role="status" key={receipt}><span>✓</span>{receipt}<div className="receipt-sparks" aria-hidden="true">{Array.from({ length: 8 }, (_, i) => <i key={i} style={{ '--spark': i } as React.CSSProperties} />)}</div></div>}
    <BottomNav activeTab={mode} onHome={onHome} onPlay={onPlay} onProfile={onProfile} onShop={onShop} onRewards={onRewards} rewardsReady={daily.hasReadyRewards} />
  </section>;
}
