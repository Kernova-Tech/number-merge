import { useEffect, useState } from 'react';
import { useTranslation } from '../i18n';

export function AdBreakModal({ score, onRequestBreak, onComplete }: {
  score: number;
  onRequestBreak: (score: number) => string | null;
  onComplete: () => void;
}) {
  const { t, formatNumber } = useTranslation();
  const [countdown, setCountdown] = useState(3);
  const [waiting, setWaiting] = useState(false);

  useEffect(() => {
    let remaining = 3;
    const countdownTimer = window.setInterval(() => {
      remaining -= 1;
      setCountdown(remaining);
      if (remaining > 0) return;

      window.clearInterval(countdownTimer);
      setWaiting(true);
      if (!onRequestBreak(score)) {
        onComplete();
      }
    }, 1000);

    return () => {
      window.clearInterval(countdownTimer);
    };
  }, [onComplete, onRequestBreak, score]);

  return (
    <div className="modal-layer ad-break-layer">
      <div className="modal-card ad-break-modal" role="dialog" aria-modal="true" aria-label={t('breakTitle')}>
        <div className="ad-break-spark" aria-hidden="true">✦</div>
        <small>{t('breakCheckpoint')}</small>
        <h2>{t('breakTitle')}</h2>
        <div className="ad-break-score">{formatNumber(score)}</div>
        <p>{t('breakBody', { score: formatNumber(score) })}</p>
        <div className="ad-break-countdown" aria-live="polite">
          {waiting ? <span className="ad-break-waiting">{t('breakWaiting')}</span> : <><span>{t('breakCountdown')}</span><strong>{countdown}</strong></>}
        </div>
      </div>
    </div>
  );
}
