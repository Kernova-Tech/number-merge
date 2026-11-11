import type { ReactNode } from 'react';
import { useTranslation } from '../i18n';

export type BottomNavTab = 'rewards' | 'shop' | 'home' | 'play' | 'profile';

const NavIcon = ({ tab }: { tab: BottomNavTab }) => {
  const paths: Record<BottomNavTab, ReactNode> = {
    rewards: <><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M12 10v10M4 10h16M8 10C4 8 5 4 8 5c2 1 4 5 4 5m4 0c4-2 3-6 0-5-2 1-4 5-4 5"/></>,
    shop: <><path d="M4 6h2l2 9h9l2-6H7"/><circle cx="10" cy="19" r="1.5"/><circle cx="17" cy="19" r="1.5"/></>,
    home: <><path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10M9 20v-6h6v6"/></>,
    play: <><path d="M8 8h8c4 0 6 3 5 7l-1 3c-.5 2-3 2-4 0l-1-2H9l-1 2c-1 2-3.5 2-4 0l-1-3c-1-4 1-7 5-7Z"/><path d="M7 12v4M5 14h4M16 12h.01M19 15h.01"/></>,
    profile: <><circle cx="12" cy="8" r="4"/><path d="M4 21c0-5 3-8 8-8s8 3 8 8"/></>,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[tab]}</svg>;
};

const items: BottomNavTab[] = ['rewards', 'shop', 'home', 'play', 'profile'];

interface BottomNavProps {
  activeTab?: 'home' | 'profile' | 'shop' | 'rewards';
  onPlay: () => void;
  onProfile: () => void;
  onHome?: () => void;
  onShop?: () => void;
  onRewards?: () => void;
  rewardsReady?: boolean;
}

export function BottomNav({ activeTab = 'home', onPlay, onProfile, onHome, onShop, onRewards, rewardsReady = false }: BottomNavProps) {
  const { t } = useTranslation();
  const handleClick = (tab: BottomNavTab) => {
    if (tab === 'home') onHome?.();
    else if (tab === 'play') onPlay();
    else if (tab === 'profile') onProfile();
    else if (tab === 'shop') onShop?.();
    else if (tab === 'rewards') onRewards?.();
    else window.dispatchEvent(new CustomEvent('merge-toast', { detail: t('comingSoon') }));
  };

  return (
    <nav className="bottom-nav" aria-label={t('mainNavigation')}>
      {items.map((item) => (
        <button key={item} className={activeTab === item ? 'active' : ''} onClick={() => handleClick(item)}>
          <span className="nav-icon"><NavIcon tab={item} />{item === 'rewards' && rewardsReady && <i />}</span>
          <small>{t(item)}</small>
        </button>
      ))}
    </nav>
  );
}
