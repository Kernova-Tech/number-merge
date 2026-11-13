import { useState } from 'react';
import { useTranslation } from '../i18n';

interface DailySeedResultModalProps {
  day: string;
  score: number;
  personalBest: number;
  longestChain: number;
  isNewBest: boolean;
  onReplay: () => void;
  onHome: () => void;
}

function makeShareImage(title: string, date: string, scoreLabel: string, score: string, chainLabel: string, chain: string, bestLabel: string, best: string, footer: string, locale: string, direction: 'rtl' | 'ltr'): Promise<File | null> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 630;
    const context = canvas.getContext('2d');
    if (!context) { resolve(null); return; }
    context.direction = direction;

    const background = context.createLinearGradient(0, 0, 1200, 630);
    background.addColorStop(0, '#101e38');
    background.addColorStop(1, '#050a13');
    context.fillStyle = background;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = '#39e886';
    context.globalAlpha = .55;
    context.lineWidth = 2;
    context.beginPath();
    context.arc(1040, 112, 145, 0, Math.PI * 2);
    context.stroke();
    context.globalAlpha = 1;

    context.fillStyle = '#43ed91';
    context.font = '800 28px system-ui, sans-serif';
    context.fillStyle = '#f7fbff';
    context.font = '800 54px system-ui, sans-serif';
    context.textAlign = direction === 'rtl' ? 'right' : 'left';
    context.fillText(title, direction === 'rtl' ? 1128 : 72, 164);
    context.fillStyle = '#91a5c5';
    context.font = '500 27px system-ui, sans-serif';
    context.fillText(date, direction === 'rtl' ? 1128 : 74, 210);

    context.fillStyle = '#0d1729';
    context.strokeStyle = '#a9c9ef30';
    context.lineWidth = 2;
    context.beginPath();
    context.roundRect(72, 255, 1056, 270, 28);
    context.fill();
    context.stroke();

    const columns = [
      { label: scoreLabel.toLocaleUpperCase(locale), value: score },
      { label: bestLabel.toLocaleUpperCase(locale), value: best },
      { label: chainLabel.toLocaleUpperCase(locale), value: chain },
    ];
    columns.forEach(({ label, value }, index) => {
      const x = direction === 'rtl' ? 1080 - index * 350 : 120 + index * 350;
      context.fillStyle = '#8499b9';
      context.font = '700 20px system-ui, sans-serif';
      context.textAlign = direction === 'rtl' ? 'right' : 'left';
      context.fillText(label, x, 350);
      context.fillStyle = '#ffffff';
      context.font = '800 43px system-ui, sans-serif';
      context.fillText(value, x, 418);
    });
    context.fillStyle = '#41e888';
    context.font = '700 21px system-ui, sans-serif';
    context.textAlign = direction === 'rtl' ? 'right' : 'left';
    context.fillText(footer, direction === 'rtl' ? 1128 : 74, 585);
    context.textAlign = 'left';
    context.direction = 'ltr';
    context.fillStyle = '#43ed91';
    context.font = '800 28px system-ui, sans-serif';
    context.fillText('NUMBER MERGE  /  DAILY SEED', 72, 86);

    canvas.toBlob((blob) => {
      if (!blob || typeof File === 'undefined') { resolve(null); return; }
      resolve(new File([blob], 'number-merge-daily-result.png', { type: 'image/png' }));
    }, 'image/png');
  });
}

export function DailySeedResultModal({ day, score, personalBest, longestChain, isNewBest, onReplay, onHome }: DailySeedResultModalProps) {
  const { t, formatNumber, locale, direction } = useTranslation();
  const [sharing, setSharing] = useState(false);
  const [shareFeedback, setShareFeedback] = useState('');
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' })
    .format(new Date(`${day}T00:00:00Z`));

  const share = async () => {
    if (sharing) return;
    setSharing(true);
    setShareFeedback('');
    const text = `Number Merge · ${t('dailySeedChallenge')} · ${date}\n${t('dailySeedYourScore')}: ${formatNumber(score)} · ${t('dailySeedPersonalBest')}: ${formatNumber(personalBest)} · ${t('dailySeedLongestChain')}: ${formatNumber(longestChain)}`;
    const wasCancelled = (error: unknown) => error instanceof DOMException && error.name === 'AbortError';
    try {
      let image: File | null = null;
      try {
        image = await makeShareImage(t('dailySeedComplete'), date, t('dailySeedYourScore'), formatNumber(score), t('dailySeedLongestChain'), formatNumber(longestChain), t('dailySeedPersonalBest'), formatNumber(personalBest), t('dailySeedSameBoard'), locale, direction);
      } catch { /* text sharing remains available if image generation fails */ }

      if (navigator.share && image && navigator.canShare?.({ files: [image] })) {
        try {
          await navigator.share({ title: t('dailySeedComplete'), text, files: [image] });
          return;
        } catch (error) {
          if (wasCancelled(error)) return;
        }
      }
      if (navigator.share) {
        try {
          await navigator.share({ title: t('dailySeedComplete'), text });
          return;
        } catch (error) {
          if (wasCancelled(error)) return;
        }
      }
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
          setShareFeedback(t('dailySeedCopied'));
          return;
        }
      } catch { /* try the older document copy fallback */ }
      const input = document.createElement('textarea');
      input.value = text;
      input.setAttribute('readonly', '');
      input.style.position = 'fixed';
      input.style.opacity = '0';
      document.body.appendChild(input);
      input.select();
      const copied = document.execCommand('copy');
      input.remove();
      setShareFeedback(copied ? t('dailySeedCopied') : t('dailySeedShareUnavailable'));
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="modal-layer daily-seed-result-layer" role="dialog" aria-modal="true" aria-labelledby="daily-seed-result-title">
      <div className="modal-card daily-seed-result-card">
        <div className="daily-seed-result-icon" aria-hidden="true">✦</div>
        <small className="daily-seed-result-kicker">{t('dailySeedChallenge')} · {date}</small>
        <h2 id="daily-seed-result-title">{t('dailySeedComplete')}</h2>
        {isNewBest && <div className="daily-seed-new-best">✦ {t('dailySeedNewBest')} ✦</div>}
        <div className="daily-seed-score-tile"><small>{t('dailySeedYourScore')}</small><strong>{formatNumber(score)}</strong></div>
        <div className="daily-seed-result-stats">
          <div><small>{t('dailySeedPersonalBest')}</small><strong>{formatNumber(personalBest)}</strong></div>
          <div><small>{t('dailySeedLongestChain')}</small><strong>{formatNumber(longestChain)}</strong></div>
        </div>
        <p className="daily-seed-device-note">{t('dailySeedDeviceNote')}</p>
        <button className="modal-primary" onClick={share} disabled={sharing} aria-busy={sharing}>{`↗  ${t('dailySeedShare')}`}</button>
        <button className="modal-secondary" onClick={onReplay}>{t('dailySeedReplay')}</button>
        <button className="modal-link" onClick={onHome}>{t('backHome')}</button>
        <div className="daily-seed-share-feedback" aria-live="polite">{shareFeedback}</div>
      </div>
    </div>
  );
}
