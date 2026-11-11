import type { BoosterType } from './types';

export const DAILY_GIFTS: ReadonlyArray<{ gems: number; booster?: BoosterType }> = [
  { gems: 20 }, { gems: 25 }, { gems: 0, booster: 'swap' }, { gems: 30 },
  { gems: 0, booster: 'undo' }, { gems: 40 }, { gems: 50, booster: 'hammer' },
];
export type DailyProgress = { count: number; lastDay: number };
export function dailyStatus(progress: DailyProgress | undefined, now = Date.now()) {
  const day = Math.floor(now / 86400000);
  const count = progress?.count ?? 0;
  const ready = !progress || day > progress.lastDay;
  const index = count % DAILY_GIFTS.length;
  return { day, count, ready, index, gift: DAILY_GIFTS[index], remaining: Math.max(0, ((progress?.lastDay ?? day) + 1) * 86400000 - now) };
}

export function formatCountdown(milliseconds: number): string {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60].map(value => String(value).padStart(2, '0')).join(':');
}
