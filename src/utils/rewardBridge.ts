import type { BoosterType } from '../game/types';
import { storage } from './storage';
import { createId } from './createId';

export type AdRequest = { version: 1; type: 'rewarded.request'; requestId: string; placement: 'milestone_double' | 'booster_refill' | 'daily_double'; createdAt: number; milestone?: number; booster?: BoosterType; dailyId?: string; dailyIndex?: number };
export type AdResult = { requestId: string; status: 'earned' | 'cancelled' | 'failed' | 'unavailable' };
declare global {
  interface Window {
    GameHost?: { postMessage: (message: string) => void };
    NumberMergeHost?: { receive: (result: unknown) => void };
  }
}
export const adsSupported = () => typeof window.GameHost?.postMessage === 'function';
export const pendingAd = () => storage.get<AdRequest | null>('pending-ad', null);
export function requestAd(placement: AdRequest['placement'], detail: { milestone?: number; booster?: BoosterType; dailyId?: string; dailyIndex?: number }): AdRequest {
  if (!adsSupported()) throw new Error('unavailable');
  if (pendingAd()) throw new Error('pending');
  const request: AdRequest = { version: 1, type: 'rewarded.request', requestId: createId(), createdAt: Date.now(), placement, ...detail };
  storage.set('ad-requests', { ...storage.get<Record<string, AdRequest>>('ad-requests', {}), [request.requestId]: request });
  storage.set('pending-ad', request);
  try { window.GameHost!.postMessage(JSON.stringify(request)); }
  catch (error) { storage.set('pending-ad', null); throw error; }
  return request;
}

export function listenForAdResult(onResult: (request: AdRequest, result: AdResult) => void, onWaitExpired: () => void): () => void {
  const receive = (value: unknown) => {
    if (!value || typeof value !== 'object') return;
    const result = value as AdResult;
    const requests = storage.get<Record<string, AdRequest>>('ad-requests', {});
    const request = Object.hasOwn(requests, result.requestId) ? requests[result.requestId] : null;
    if (!['earned', 'cancelled', 'failed', 'unavailable'].includes(result.status)) return;
    const resolved = storage.get<string[]>('ad-resolved', []);
    if (!request) {
      if (resolved.includes(result.requestId)) {
        try { window.GameHost?.postMessage(JSON.stringify({ version: 1, type: 'rewarded.ack', requestId: result.requestId })); } catch { /* Retry on the next native delivery. */ }
      }
      return;
    }
    onResult(request, result);
    storage.set('ad-resolved', [...resolved, result.requestId]);
    if (pendingAd()?.requestId === request.requestId) storage.set('pending-ad', null);
    delete requests[request.requestId];
    storage.set('ad-requests', requests);
    try { window.GameHost?.postMessage(JSON.stringify({ version: 1, type: 'rewarded.ack', requestId: request.requestId })); } catch { /* The stored ledger still prevents duplicate delivery. */ }
    window.dispatchEvent(new Event('number-merge-ad-settled'));
  };
  window.NumberMergeHost = { receive };
  // The native host must replay any terminal result not yet acknowledged.
  try { window.GameHost?.postMessage(JSON.stringify({ version: 1, type: 'rewarded.ready', pendingRequestId: pendingAd()?.requestId ?? null })); } catch { /* A later host reconnect can replay its result. */ }
  const timer = window.setInterval(() => {
    const pending = pendingAd();
    if (pending && Date.now() - pending.createdAt > 90000) {
      storage.set('pending-ad', null);
      onWaitExpired(); // Keep its receipt so a late earned result can still be delivered.
    }
  }, 1000);
  return () => { window.clearInterval(timer); if (window.NumberMergeHost?.receive === receive) delete window.NumberMergeHost; };
}
