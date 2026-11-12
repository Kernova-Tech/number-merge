import { CHALLENGE_RUNS, type ChallengeRunId, type ChallengeRunRecord } from '../game/challengeRuns';
import { useTranslation } from '../i18n';

const symbols: Record<ChallengeRunId, string> = {
  'milestone-sprint': '↗',
  'cascade-hunt': '⌁',
  'clean-merge': '◇',
};

export function ChallengeRunsModal({ records, onStart, onClose }: {
  records: Partial<Record<ChallengeRunId, ChallengeRunRecord>>;
  onStart: (id: ChallengeRunId) => void;
  onClose: () => void;
}) {
  const { t, formatNumber } = useTranslation();
  return <div className="modal-layer" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="modal-card challenge-picker-modal" role="dialog" aria-modal="true" aria-labelledby="challenge-picker-title">
      <button className="challenge-picker-close" onClick={onClose} aria-label={t('challengePickerClose')}>×</button>
      <div className="modal-emblem challenge-emblem">✦</div>
      <small>{t('optionalRuns')}</small>
      <h2 id="challenge-picker-title">{t('optionalRunsHeading')}</h2>
      <p>{t('optionalRunsSubtitle')}</p>
      <div className="challenge-run-options">
        {CHALLENGE_RUNS.map((challenge) => {
          const record = records[challenge.id];
          return <article className="challenge-run-option" key={challenge.id}>
            <span className={`challenge-run-symbol challenge-symbol-${challenge.id}`} aria-hidden="true">{symbols[challenge.id]}</span>
            <div className="challenge-run-copy">
              <h3>{t(challenge.titleKey)}</h3>
              <p>{t(challenge.descriptionKey)}</p>
              <strong>{t(challenge.objectiveKey)}</strong>
              <small>{record?.attempts
                ? t('challengeBestRecord', { score: formatNumber(record.bestScore), wins: formatNumber(record.wins) })
                : t('challengeNoRecord')}</small>
            </div>
            <button className="challenge-run-start" onClick={() => onStart(challenge.id)}>{t('challengeStart')} <span aria-hidden="true">›</span></button>
          </article>;
        })}
      </div>
      <p className="challenge-rules-note">{t('challengeRulesNote')}</p>
    </section>
  </div>;
}
