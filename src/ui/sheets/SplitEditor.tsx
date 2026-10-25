import { shareOf, splitProblem, type Cents, type Currency, type Member } from '../../core';
import { useI18n, type Key } from '../../i18n';
import { Avatar, Choice, FieldNote } from '../bits';
import { Icon } from '../icons';
import { draftToSplit, exactCents, percentBp, problemKey, type SplitDraft, type SplitMode } from './splitDraft';

const MODES: { id: SplitMode; label: Key }[] = [
  { id: 'equal', label: 'split.equal' },
  { id: 'exact', label: 'split.exact' },
  { id: 'shares', label: 'split.shares' },
  { id: 'percent', label: 'split.percent' },
];

interface Props {
  draft: SplitDraft;
  onChange: (d: SplitDraft) => void;
  amount: Cents | null;
  members: Member[];
  currency: Currency;
  me?: string;
}

/** «Para»: a partes iguales (chips) o por importes, partes o porcentajes, con lo que falta en vivo. */
export function SplitEditor({ draft, onChange, amount, members, currency, me }: Props) {
  const { t, money, locale } = useI18n();
  const { split, inputError } = draftToSplit(draft, members, currency);
  const problem = amount ? splitProblem(amount, split, new Set(members.map((m) => m.id))) : null;
  const shares = amount && !problem && !inputError ? shareOf(amount, split) : {};
  const set = (patch: Partial<SplitDraft>) => onChange({ ...draft, ...patch });
  const pctFmt = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });

  let status: { tone: 'ok' | 'error' | 'muted'; text: string } | null = null;
  if (inputError) status = { tone: 'error', text: t('split.err.input') };
  else if (draft.mode === 'exact' && amount) {
    const sum = members.reduce((s, m) => s + (exactCents(draft.exact[m.id], currency) ?? 0), 0);
    const diff = amount - sum;
    status = diff === 0 ? { tone: 'ok', text: t('split.balanced') } : { tone: 'error', text: diff > 0 ? t('split.missing', { amount: money(diff, currency) }) : t('split.over', { amount: money(-diff, currency) }) };
  } else if (draft.mode === 'percent') {
    const sum = members.reduce((s, m) => s + (percentBp(draft.percent[m.id]) ?? 0), 0);
    const diff = 10_000 - sum;
    status = diff === 0 ? { tone: 'ok', text: t('split.balanced') } : { tone: 'error', text: diff > 0 ? t('split.missingPct', { n: pctFmt.format(diff / 100) }) : t('split.overPct', { n: pctFmt.format(-diff / 100) }) };
  }
  if (problem && (!status || status.tone !== 'error')) {
    const k = problemKey(problem);
    status = { tone: 'error', text: k ? t(k) : problem };
  }

  const hint = (id: string) => (shares[id] ? money(shares[id]!, currency) : undefined);

  return (
    <fieldset className="field split-editor">
      <legend className="field-label">{t('split.for')}</legend>
      <div className="segmented segmented--wide" role="group" aria-label={t('split.how')}>
        {MODES.map((m) => (
          <button key={m.id} type="button" aria-pressed={draft.mode === m.id} onClick={() => set({ mode: m.id })}>
            {t(m.label)}
          </button>
        ))}
      </div>

      {draft.mode === 'equal' && (
        <div className="chips" role="group" aria-label={t('split.for')}>
          {members.map((m) => (
            <Choice
              key={m.id}
              type="checkbox"
              name="split-among"
              checked={draft.among.includes(m.id)}
              onChange={(on) => set({ among: on ? [...draft.among, m.id] : draft.among.filter((x) => x !== m.id) })}
              hint={hint(m.id)}
            >
              <Avatar member={m} size="sm" me={m.id === me} />
              {m.name}
            </Choice>
          ))}
          <button
            type="button"
            className="chip chip--action"
            onClick={() => set({ among: draft.among.length === members.length ? [] : members.map((m) => m.id) })}
          >
            {draft.among.length === members.length ? t('split.none') : t('split.all')}
          </button>
        </div>
      )}

      {draft.mode !== 'equal' && (
        <ul className="split-rows">
          {members.map((m) => (
            <li key={m.id} className="split-row">
              <Avatar member={m} size="sm" me={m.id === me} />
              <span className="split-name">{m.name}</span>
              {draft.mode === 'exact' && (
                <input
                  className="input input--num"
                  inputMode="decimal"
                  aria-label={t('split.amountOf', { name: m.name })}
                  value={draft.exact[m.id] ?? ''}
                  placeholder="0"
                  onChange={(e) => set({ exact: { ...draft.exact, [m.id]: e.target.value } })}
                />
              )}
              {draft.mode === 'percent' && (
                <span className="with-suffix">
                  <input
                    className="input input--num"
                    inputMode="decimal"
                    aria-label={t('split.percentOf', { name: m.name })}
                    value={draft.percent[m.id] ?? ''}
                    placeholder="0"
                    onChange={(e) => set({ percent: { ...draft.percent, [m.id]: e.target.value } })}
                  />
                  <span aria-hidden="true">%</span>
                </span>
              )}
              {draft.mode === 'shares' && (
                <span className="stepper">
                  <button
                    type="button"
                    className="icon-btn icon-btn--sm"
                    aria-label={t('split.less', { name: m.name })}
                    disabled={(draft.shares[m.id] ?? 0) <= 0}
                    onClick={() => set({ shares: { ...draft.shares, [m.id]: Math.max(0, (draft.shares[m.id] ?? 0) - 1) } })}
                  >
                    <Icon name="minus" size={18} />
                  </button>
                  <output aria-label={t('split.sharesOf', { name: m.name })}>{draft.shares[m.id] ?? 0}</output>
                  <button
                    type="button"
                    className="icon-btn icon-btn--sm"
                    aria-label={t('split.more', { name: m.name })}
                    disabled={(draft.shares[m.id] ?? 0) >= 99}
                    onClick={() => set({ shares: { ...draft.shares, [m.id]: Math.min(99, (draft.shares[m.id] ?? 0) + 1) } })}
                  >
                    <Icon name="plus" size={18} />
                  </button>
                </span>
              )}
              {draft.mode !== 'exact' && <span className="split-result">{hint(m.id) ?? '—'}</span>}
            </li>
          ))}
        </ul>
      )}

      {status && (
        <FieldNote tone={status.tone}>
          <span aria-live="polite">{status.text}</span>
        </FieldNote>
      )}
    </fieldset>
  );
}
