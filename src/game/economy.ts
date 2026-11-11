import { INITIAL_GEMS } from './constants';
import type { BoosterType } from './types';
import { storage } from '../utils/storage';
import { dailyStatus, type DailyProgress } from './dailyRewards';
import { advanceChallenges, challengeStatus, type ChallengeId, type ChallengeProgress } from './challenges';
import type { MergeEvent } from './types';

type Wallet = { gems: number; boosters: Record<BoosterType, number>; transactions: string[]; daily?: DailyProgress; challenges?: ChallengeProgress };
export const BOOSTER_PRICES: Record<BoosterType, number> = { swap: 20, undo: 35, hammer: 50 };

export function readWallet(): Wallet {
  return storage.get<Wallet>('wallet-v1', {
    gems: storage.get('gems', INITIAL_GEMS),
    boosters: storage.get('boosters', { hammer: 3, swap: 5, undo: 3 }),
    transactions: [],
  });
}

// Balance and receipt are written together so replayed native results are harmless.
export function creditReward(id: string, gems: number, booster?: BoosterType): Wallet {
  const wallet = readWallet();
  if (wallet.transactions.includes(id)) return wallet;
  const updated = { ...wallet, gems: wallet.gems + gems, boosters: { ...wallet.boosters }, transactions: [...wallet.transactions, id] };
  if (booster) updated.boosters[booster] += 1;
  storage.set('wallet-v1', updated);
  return updated;
}

export function syncWallet(gems: number, boosters: Record<BoosterType, number>): void {
  storage.set('wallet-v1', { ...readWallet(), gems, boosters });
}

export function collectDaily(now = Date.now()) {
  const wallet = readWallet();
  const status = dailyStatus(wallet.daily, now);
  const id = `daily:${status.day}`;
  if (!status.ready || wallet.transactions.includes(id)) return null;
  const updated: Wallet = { ...wallet, gems: wallet.gems + status.gift.gems,
    boosters: { ...wallet.boosters }, transactions: [...wallet.transactions, id],
    daily: { count: status.count + 1, lastDay: status.day } };
  if (status.gift.booster) updated.boosters[status.gift.booster] += 1;
  storage.set('wallet-v1', updated);
  return { wallet: updated, id, index: status.index, gift: status.gift };
}

export function purchaseBoosters(item: BoosterType | 'bundle') {
  const wallet = readWallet();
  const price = item === 'bundle' ? 90 : BOOSTER_PRICES[item];
  if (wallet.gems < price) return null;
  const boosters = { ...wallet.boosters };
  for (const type of (item === 'bundle' ? ['hammer', 'swap', 'undo'] : [item]) as BoosterType[]) boosters[type] += 1;
  syncWallet(wallet.gems - price, boosters);
  return readWallet();
}

export function recordChallengeMove(moveId: string, merges: MergeEvent[], now = Date.now(), isShot = true) {
  const wallet = readWallet();
  storage.set('wallet-v1', { ...wallet, challenges: advanceChallenges(wallet.challenges, moveId, merges, now, isShot) });
}

export function collectChallenge(id: ChallengeId, now = Date.now()) {
  const wallet = readWallet();
  const status = challengeStatus(wallet.challenges, wallet.transactions, now);
  const task = status.tasks.find(task => task.id === id);
  if (!task || !task.complete || task.claimed) return null;
  const updated = { ...wallet, gems: wallet.gems + task.gems, transactions: [...wallet.transactions, task.receipt] };
  storage.set('wallet-v1', updated);
  return updated;
}
