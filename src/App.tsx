import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GameShell } from './components/GameShell';
import { GameScreen } from './components/GameScreen';
import { HomeScreen } from './components/HomeScreen';
import { ProfileScreen } from './components/ProfileScreen';
import { useGameEngine } from './hooks/useGameEngine';
import { usePlayerProfile } from './hooks/usePlayerProfile';
import { loadCatalogs } from './state/catalogStore';
import { ShopRewardsScreen } from './components/ShopRewardsScreen';
import type { ChallengeRunId } from './game/challengeRuns';

type AppRoute = 'home' | 'profile' | 'game' | 'daily' | 'shop' | 'rewards';

const historyRouteKey = 'numberMergeRoute';

const getHistoryState = (route: AppRoute) => ({
  ...(typeof window.history.state === 'object' && window.history.state ? window.history.state : {}),
  [historyRouteKey]: route,
});

export default function App() {
  const game = useGameEngine();
  const playerProfile = usePlayerProfile();
  const [homeView, setHomeView] = useState<'home' | 'profile' | 'shop' | 'rewards'>(() => {
    const route = window.history.state?.[historyRouteKey];
    return route === 'shop' || route === 'rewards' || route === 'profile' ? route : 'home';
  });
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const gameRef = useRef(game);

  gameRef.current = game;

  const pushRoute = useCallback((route: AppRoute) => {
    if (window.history.state?.[historyRouteKey] === route) return;
    window.history.pushState(getHistoryState(route), '', window.location.href);
  }, []);

  useEffect(() => {
    void loadCatalogs();
    const timer = window.setTimeout(() => setLoading(false), 900);
    const showToast = (event: Event) => {
      setToast((event as CustomEvent<string>).detail);
      window.setTimeout(() => setToast(''), 1400);
    };
    window.addEventListener('merge-toast', showToast);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('merge-toast', showToast);
    };
  }, []);

  useEffect(() => {
    if (!window.history.state?.[historyRouteKey]) {
      window.history.replaceState(getHistoryState('home'), '', window.location.href);
    } else if (window.history.state?.[historyRouteKey] === 'daily') {
      gameRef.current.startDailySeed();
    } else if (window.history.state?.[historyRouteKey] === 'game') {
      gameRef.current.startGame();
    }

    const handleBrowserNavigation = (event: PopStateEvent) => {
      const route = (event.state?.[historyRouteKey] ?? 'home') as AppRoute;
      const currentGame = gameRef.current;

      if (currentGame.screen === 'game' && currentGame.modal === null && route !== 'game' && route !== 'daily') {
        currentGame.pause();
        window.history.pushState(getHistoryState(currentGame.mode === 'daily-seed' ? 'daily' : 'game'), '', window.location.href);
        return;
      }

      if (route === 'game' || route === 'daily') {
        setHomeView('home');
        if (currentGame.screen !== 'game' || (route === 'daily') !== (currentGame.mode === 'daily-seed')) {
          if (route === 'daily') currentGame.startDailySeed();
          else currentGame.startGame();
        }
        return;
      }

      if (currentGame.screen === 'game') currentGame.goHome();
      setHomeView(route === 'profile' || route === 'shop' || route === 'rewards' ? route : 'home');
    };

    window.addEventListener('popstate', handleBrowserNavigation);
    return () => window.removeEventListener('popstate', handleBrowserNavigation);
  }, []);

  const showHome = useCallback(() => {
    gameRef.current.goHome();
    setHomeView('home');
    pushRoute('home');
  }, [pushRoute]);

  const showProfile = useCallback(() => {
    if (gameRef.current.screen === 'game') gameRef.current.goHome();
    setHomeView('profile');
    pushRoute('profile');
  }, [pushRoute]);

  const playGame = useCallback(() => {
    setHomeView('home');
    gameRef.current.startGame();
    pushRoute('game');
  }, [pushRoute]);

  const playDailySeed = useCallback(() => {
    setHomeView('home');
    gameRef.current.startDailySeed();
    pushRoute('daily');
  }, [pushRoute]);

  const playChallengeRun = useCallback((id: ChallengeRunId) => {
    setHomeView('home');
    gameRef.current.startChallengeRun(id);
    pushRoute('game');
  }, [pushRoute]);

  const showCollection = useCallback((view: 'shop' | 'rewards') => {
    if (gameRef.current.screen === 'game') gameRef.current.goHome();
    setHomeView(view);
    pushRoute(view);
  }, [pushRoute]);
  const showShop = useCallback(() => showCollection('shop'), [showCollection]);
  const showRewards = useCallback(() => showCollection('rewards'), [showCollection]);

  const saveProfile = useCallback((profile: Parameters<typeof playerProfile.updateProfile>[0]) => {
    playerProfile.updateProfile(profile);
    setHomeView('home');
    pushRoute('home');
  }, [playerProfile, pushRoute]);

  const gameWithNavigation = useMemo(() => ({
    ...game,
    goHome: showHome,
  }), [game, showHome]);

  if (loading) {
    return (
      <GameShell className="splash-screen">
        <div className="splash-logo"><span>2</span><span>4</span><span>8</span></div>
        <h1>NUMBER<br /><b>MERGE</b></h1>
        <div className="loading-bar"><i /></div>
      </GameShell>
    );
  }

  return (
    <GameShell>
      {game.screen === 'game' ? <GameScreen game={gameWithNavigation} /> : homeView === 'profile' ? (
        <ProfileScreen
          profile={playerProfile.profile}
          level={game.level}
          onBack={showHome}
          onPlay={playGame}
          onSave={saveProfile}
          onShop={showShop}
          onRewards={showRewards}
        />
      ) : homeView === 'shop' || homeView === 'rewards' ? (
        <ShopRewardsScreen mode={homeView} game={game} onHome={showHome} onPlay={playGame} onProfile={showProfile} onShop={showShop} onRewards={showRewards} />
      ) : (
        <HomeScreen
          highestBlock={game.highestBlock}
          level={game.level}
          levelProgress={game.levelProgress}
          gems={game.gems}
          bestScore={game.bestScore}
          dailySeedDay={game.dailySeedDay}
          dailySeedBestScore={game.dailySeedBestScore}
          dailySeedLongestChain={game.dailySeedLongestChain}
          dailySeedCanResume={game.dailySeedCanResume}
          profile={playerProfile.profile}
          onPlay={playGame}
          onDailySeed={playDailySeed}
          onChallengeRun={playChallengeRun}
          onProfile={showProfile}
          onShop={showShop}
          onRewards={showRewards}
        />
      )}
      {toast && <div className="toast">{toast}</div>}
    </GameShell>
  );
}
