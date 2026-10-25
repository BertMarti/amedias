import { useEffect, useId, useState } from 'react';
import { decodeGroup, incomingProblem, liveExpenses, mergePreview, payloadKind, ShareError, type Group, type IncomingProblem, type MergeSummary } from '../../core';
import { useI18n, type Key, type PluralBase } from '../../i18n';
import { FieldNote } from '../bits';
import { useApp, type IncomingSource } from '../context';
import { Icon } from '../icons';
import type { SheetProps } from '../Layers';
import { Sheet } from '../Sheet';
import { activeMembers } from '../util';

type Code = ShareError['code'];
const ERRORS: Record<Code, Key> = {
  format: 'incoming.err.format',
  too_large: 'incoming.err.too_large',
  passphrase_required: 'incoming.err.passphrase_required',
  wrong_passphrase: 'incoming.err.wrong_passphrase',
  invalid: 'incoming.err.invalid',
};

type Phase = { p: 'decoding' } | { p: 'pass'; error?: Code; busy?: boolean } | { p: 'error'; code: Code } | { p: 'preview'; groups: Group[] };

function initialPhase(source: IncomingSource): Phase {
  if (source.kind === 'groups') return { p: 'preview', groups: source.groups };
  const kind = payloadKind(source.payload);
  if (!kind) return { p: 'error', code: 'format' };
  return kind === 'encrypted' ? { p: 'pass' } : { p: 'decoding' };
}

const codeOf = (e: unknown): Code => (e instanceof ShareError ? e.code : 'invalid');

const PROBLEMS: Record<IncomingProblem, Key> = {
  future: 'incoming.problem.future',
  currency: 'incoming.problem.currency',
  limits: 'incoming.problem.limits',
};

/** Todo lo que cambiaría al fusionar, sin esconder nada (lo que borra o cambia la moneda, en rojo). */
function diffParts(p: MergeSummary, incoming: Group, t: ReturnType<typeof useI18n>['t'], tp: ReturnType<typeof useI18n>['tp']) {
  const counts: [number, PluralBase, boolean][] = [
    [p.newExpenses, 'incoming.newExpenses', false],
    [p.changed, 'incoming.changed', false],
    [p.removed, 'incoming.removed', true],
    [p.newMembers, 'incoming.newMembers', false],
    [p.renamedMembers, 'incoming.renamedMembers', false],
    [p.removedMembers, 'incoming.removedMembers', true],
    [p.recurring, 'incoming.recurring', false],
  ];
  const parts = counts.filter(([n]) => n > 0).map(([n, key, bad]) => ({ text: tp(key, n), bad }));
  if (p.header) parts.push({ text: t('incoming.header'), bad: false });
  if (p.currency) parts.push({ text: t('incoming.currency', { currency: incoming.currency }), bad: true });
  return parts;
}

function Candidate({ g, problem }: { g: Group; problem: IncomingProblem | null }) {
  const { t, tp } = useI18n();
  const { groups } = useApp();
  const local = groups.find((x) => x.id === g.id);
  const preview = local ? mergePreview(local, g) : null;
  const people = activeMembers(g);
  const parts = preview ? diffParts(preview, g, t, tp) : [];
  return (
    <li className="candidate">
      <span className="group-emoji" aria-hidden="true">
        {g.emoji}
      </span>
      <span className="candidate-main">
        <span className="group-card-name">{g.name}</span>
        <span className="group-card-meta">{people.map((m) => m.name).join(', ')}</span>
        <span className="group-card-meta">{tp('home.expenses', liveExpenses(g).filter((e) => e.kind === 'expense').length)}</span>
        {preview && !problem && (
          <span className="candidate-diff">
            {preview.upToDate || parts.length === 0
              ? t('incoming.upToDate')
              : parts.map((x, i) => (
                  <span key={x.text} className={x.bad ? 'diff-bad' : undefined}>
                    {i > 0 && ', '}
                    {x.text}
                  </span>
                ))}
          </span>
        )}
        {problem && (
          <span className="candidate-diff diff-bad" role="alert">
            {t(PROBLEMS[problem])}
          </span>
        )}
      </span>
      <span className={`pill ${local ? 'pill--mint' : 'pill--tomato'}`}>{local ? t('incoming.known') : t('incoming.new')}</span>
    </li>
  );
}

export function IncomingSheet({ active, onClose, source }: SheetProps & { source: IncomingSource }) {
  const { t, tp } = useI18n();
  const { groups, settings, addOrMerge, openGroup, setLayers, toast } = useApp();
  const passId = useId();
  const [phase, setPhase] = useState<Phase>(() => initialPhase(source));
  const [pass, setPass] = useState('');
  const payload = source.kind === 'link' ? source.payload : '';
  const decoding = phase.p === 'decoding';

  useEffect(() => {
    if (!decoding) return;
    let alive = true;
    decodeGroup(payload).then(
      (g) => alive && setPhase({ p: 'preview', groups: [g] }),
      (e: unknown) => alive && setPhase(codeOf(e) === 'passphrase_required' ? { p: 'pass' } : { p: 'error', code: codeOf(e) }),
    );
    return () => {
      alive = false;
    };
  }, [decoding, payload]);

  const unlock = () => {
    if (!pass) return;
    setPhase({ p: 'pass', busy: true });
    decodeGroup(payload, pass).then(
      (g) => setPhase({ p: 'preview', groups: [g] }),
      (e: unknown) => {
        const code = codeOf(e);
        setPhase(code === 'wrong_passphrase' || code === 'passphrase_required' ? { p: 'pass', error: code } : { p: 'error', code });
      },
    );
  };

  const accept = (list: Group[]) => {
    const { added, merged, rejected } = addOrMerge(list);
    if (rejected > 0) toast(tp('toast.rejected', rejected), 'error');
    if (list.length === 1 && rejected === 0) {
      const g = list[0]!;
      const needMe = !settings.me[g.id] || !g.members.some((m) => m.id === settings.me[g.id] && !m.deleted);
      openGroup(g.id, needMe ? [{ t: 'whoami', groupId: g.id }] : []);
      toast(merged ? t('toast.merged', { name: g.name }) : t('toast.added', { name: g.name }));
    } else {
      setLayers([]);
      toast(tp('toast.imported', added + merged));
    }
  };

  const title = phase.p === 'preview' && source.kind === 'groups' && source.restore ? t('import.restoreTitle') : t('incoming.title');

  return (
    <Sheet title={title} active={active} onClose={onClose} size="sm">
      {phase.p === 'decoding' && (
        <p className="loading" role="status">
          {t('incoming.reading')}
        </p>
      )}

      {phase.p === 'pass' && (
        <form
          className="form"
          onSubmit={(e) => {
            e.preventDefault();
            unlock();
          }}
        >
          <p className="lock-intro">
            <Icon name="lock" size={22} />
            {t('incoming.locked')}
          </p>
          <div className="field">
            <label htmlFor={passId} className="field-label">
              {t('incoming.pass')}
            </label>
            <input
              id={passId}
              className="input"
              type="password"
              value={pass}
              autoComplete="off"
              onChange={(e) => setPass(e.target.value)}
              aria-invalid={!!phase.error}
              data-autofocus
            />
          </div>
          {phase.error && (
            <FieldNote>
              <span role="alert">{t(ERRORS[phase.error])}</span>
            </FieldNote>
          )}
          <button type="submit" className="btn btn--primary" disabled={!pass || phase.busy} aria-busy={phase.busy}>
            <Icon name="lock" />
            {phase.busy ? t('incoming.unlocking') : t('incoming.unlock')}
          </button>
        </form>
      )}

      {phase.p === 'error' && (
        <div className="form">
          <p className="error-box" role="alert">
            <Icon name="info" />
            {t(ERRORS[phase.code])}
          </p>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            {t('close')}
          </button>
        </div>
      )}

      {phase.p === 'preview' && (
        <div className="form">
          <ul className="candidates">
            {phase.groups.map((g) => (
              <Candidate key={g.id} g={g} problem={incomingProblem(groups.find((x) => x.id === g.id), g)} />
            ))}
          </ul>
          {source.kind === 'groups' && source.note && <FieldNote tone="muted">{source.note}</FieldNote>}
          {phase.groups.length === 1 ? (
            (() => {
              const g = phase.groups[0]!;
              const local = groups.find((x) => x.id === g.id);
              if (incomingProblem(local, g)) {
                return (
                  <button type="button" className="btn btn--ghost" onClick={onClose}>
                    {t('close')}
                  </button>
                );
              }
              const nothing = local && mergePreview(local, g).upToDate;
              return nothing ? (
                <button type="button" className="btn btn--primary btn--big" onClick={() => openGroup(g.id)}>
                  <Icon name="arrow" />
                  {t('incoming.openGroup')}
                </button>
              ) : (
                <button type="button" className="btn btn--primary btn--big" onClick={() => accept([g])}>
                  <Icon name={local ? 'swap' : 'plus'} />
                  {local ? t('incoming.merge') : t('incoming.add')}
                </button>
              );
            })()
          ) : (
            <button type="button" className="btn btn--primary btn--big" onClick={() => accept(phase.groups)}>
              <Icon name="download" />
              {tp('incoming.addAll', phase.groups.length)}
            </button>
          )}
          <p className="muted small">{t('incoming.mergeExplain')}</p>
        </div>
      )}
    </Sheet>
  );
}
