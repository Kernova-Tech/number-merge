import { useEffect, useState } from 'react';
import { dailyStatus } from '../game/dailyRewards';
import { readWallet } from '../game/economy';
import { challengeStatus } from '../game/challenges';

export function useDailyGiftStatus() {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    const refresh = () => setNow(Date.now());
    document.addEventListener('visibilitychange', refresh);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', refresh); };
  }, []);
  const wallet = readWallet();
  const daily = dailyStatus(wallet.daily, now);
  const challenges = challengeStatus(wallet.challenges, wallet.transactions, now);
  return { ...daily, challenges, hasReadyRewards: daily.ready || challenges.ready };
}
