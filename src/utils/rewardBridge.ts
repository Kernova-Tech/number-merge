import type { BoosterType } from '../game/types';
import { storage } from './storage';
import { createId } from './createId';

export type AdRequest = { version: 1; type: 'rewarded.request'; requestId: string; placement: 'milestone_double' | 'booster_refill' | 'daily_double'; createdAt: number; milestone?: number; booster?: BoosterType; dailyId?: string; dailyIndex?: number };
export type AdResult = { requestId: string; status: 'earned' | 'cancelled' | 'failed' | 'unavailable' };
export type AdBreakResult = { requestId: string; status: 'shown' | 'cooldown' | 'busy' | 'failed' | 'unavailable' };
type AdBreakRequest = { version: 1; type: 'interstitial.break.request'; requestId: string; checkpointScore: number; createdAt: number };
type HostCapabilities = { version: 1; type: 'rewarded.capabilities'; enabled: boolean; bridgeToken: string; placements: string[]; interstitialBreaks?: boolean };
let capabilities: HostCapabilities | null = null;
declare global {
  interface Window {
    GameHost?: { postMessage: (message: string) => void };
    NumberMergeHost?: { receive: (result: unknown) => void };
  }
}
export const adsSupported = () => typeof window.GameHost?.postMessage === 'function' && capabilities?.enabled === true;
export const interstitialBreaksSupported = () => typeof window.GameHost?.postMessage === 'function' && capabilities?.interstitialBreaks === true;
export function subscribeAdAvailability(listener: () => void): () => void {
  window.addEventListener('number-merge-host-ready', listener);
  listener();
  return () => window.removeEventListener('number-merge-host-ready', listener);
}
const sendAck = (requestId: string) => window.GameHost?.postMessage(JSON.stringify({ version: 1, type: 'rewarded.ack', requestId, bridgeToken: capabilities?.bridgeToken }));
export const pendingAd = () => storage.get<AdRequest | null>('pending-ad', null);
export function requestAd(placement: AdRequest['placement'], detail: { milestone?: number; booster?: BoosterType; dailyId?: string; dailyIndex?: number }): AdRequest {
  if (!adsSupported()) throw new Error('unavailable');
  if (!capabilities?.placements.includes(placement)) throw new Error('unsupported placement');
  if (pendingAd()) throw new Error('pending');
  const request: AdRequest = { version: 1, type: 'rewarded.request', requestId: createId(), createdAt: Date.now(), placement, ...detail };
  storage.set('ad-requests', { ...storage.get<Record<string, AdRequest>>('ad-requests', {}), [request.requestId]: request });
  storage.set('pending-ad', request);
  try { window.GameHost!.postMessage(JSON.stringify({ ...request, bridgeToken: capabilities?.bridgeToken })); }
  catch (error) { storage.set('pending-ad', null); throw error; }
  return request;
}

export function requestInterstitialBreak(checkpointScore: number): string | null {
  if (!interstitialBreaksSupported() || !Number.isSafeInteger(checkpointScore) || checkpointScore < 1000) return null;
  const current = storage.get<AdBreakRequest | null>('pending-ad-break', null);
  if (current) return current.requestId;
  const request: AdBreakRequest = { version: 1, type: 'interstitial.break.request', requestId: createId(), checkpointScore, createdAt: Date.now() };
  storage.set('pending-ad-break', request);
  try { window.GameHost!.postMessage(JSON.stringify({ ...request, bridgeToken: capabilities?.bridgeToken })); }
  catch { storage.set('pending-ad-break', null); return null; }
  return request.requestId;
}

export function listenForAdResult(onResult: (request: AdRequest, result: AdResult) => void, onWaitExpired: () => void, onAdBreakResult?: (result: AdBreakResult) => void): () => void {
  const receive = (value: unknown) => {
    if (!value || typeof value !== 'object') return;
    const candidate = value as Partial<HostCapabilities>;
    if (candidate.type === 'rewarded.capabilities') {
      if (candidate.version !== 1 || typeof candidate.enabled !== 'boolean' || typeof candidate.bridgeToken !== 'string' || !candidate.bridgeToken || !Array.isArray(candidate.placements) || !candidate.placements.every(item => typeof item === 'string')) return;
      capabilities = candidate as HostCapabilities;
      window.dispatchEvent(new Event('number-merge-host-ready'));
      return;
    }
    if (candidate.type === 'interstitial.break.result') {
      const result = value as AdBreakResult & { type?: string; version?: number };
      const pending = storage.get<AdBreakRequest | null>('pending-ad-break', null);
      if (result.version !== 1 || !pending || pending.requestId !== result.requestId || !['shown', 'cooldown', 'busy', 'failed', 'unavailable'].includes(result.status)) return;
      storage.set('pending-ad-break', null);
      onAdBreakResult?.(result);
      return;
    }
    const result = value as AdResult;
    const requests = storage.get<Record<string, AdRequest>>('ad-requests', {});
    const request = Object.hasOwn(requests, result.requestId) ? requests[result.requestId] : null;
    if (!['earned', 'cancelled', 'failed', 'unavailable'].includes(result.status)) return;
    const resolved = storage.get<string[]>('ad-resolved', []);
    if (!request) {
      if (resolved.includes(result.requestId)) {
        try { sendAck(result.requestId); } catch { /* Retry on the next native delivery. */ }
      }
      return;
    }
    onResult(request, result);
    storage.set('ad-resolved', [...resolved, result.requestId]);
    if (pendingAd()?.requestId === request.requestId) storage.set('pending-ad', null);
    delete requests[request.requestId];
    storage.set('ad-requests', requests);
    try { sendAck(request.requestId); } catch { /* The stored ledger still prevents duplicate delivery. */ }
    window.dispatchEvent(new Event('number-merge-ad-settled'));
  };
  window.NumberMergeHost = { receive };
  // The native host must replay any terminal result not yet acknowledged.
  const sendReady = () => {
    try {
      window.GameHost?.postMessage(JSON.stringify({
        version: 1, type: 'rewarded.ready', pendingRequestId: pendingAd()?.requestId ?? null,
        pendingBreakRequestId: storage.get<AdBreakRequest | null>('pending-ad-break', null)?.requestId ?? null,
      }));
    } catch { /* A later host reconnect can replay its result. */ }
  };
  sendReady();
  const timer = window.setInterval(() => {
    // Registering the Flutter channel or delivering capabilities can happen after React mounts.
    if (!capabilities && typeof window.GameHost?.postMessage === 'function') {
      sendReady();
    }
    const pending = pendingAd();
    if (pending && Date.now() - pending.createdAt > 90000) {
      storage.set('pending-ad', null);
      onWaitExpired(); // Keep its receipt so a late earned result can still be delivered.
    }
    const pendingBreak = storage.get<AdBreakRequest | null>('pending-ad-break', null);
    if (pendingBreak && Date.now() - pendingBreak.createdAt > 90000) {
      storage.set('pending-ad-break', null);
      onAdBreakResult?.({ requestId: pendingBreak.requestId, status: 'unavailable' });
    }
  }, 1000);
  return () => { window.clearInterval(timer); if (window.NumberMergeHost?.receive === receive) { delete window.NumberMergeHost; capabilities = null; } };
}
