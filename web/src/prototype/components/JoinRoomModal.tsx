import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { planById } from '../data/plans';
import type { AdvisorPersona } from '../types';
import { Bot, Check, LayoutList, MessagesSquare, Repeat } from 'lucide-react';
import { Modal } from './Modal';
import type { ChatMode } from '../chat/engine';

/**
 * Step 6 of the council flow: which advisors join this room, and how they take turns.
 *
 * The plan cap is enforced here rather than in the context, because this is the only place a
 * roster is chosen — a cap the user can simply route around by picking fewer advisors elsewhere
 * would not be a cap.
 */
export const JoinRoomModal: React.FC = () => {
  const { isJoinRoomOpen, closeJoinRoom, joinRoom, personas, currentPlanId, t } = useApp();
  const cap = planById(currentPlanId).maxActiveAdvisors;
  const defaultSelection = () => personas.slice(0, cap).map((persona) => persona.id);
  const [selected, setSelected] = useState<string[]>(defaultSelection);
  const [mode, setMode] = useState<ChatMode>('round-robin');

  // Reset on close, not on open: an effect that writes state re-renders the whole tree for no
  // reason, and `closeJoinRoom` is already an event handler this component owns.
  const dismiss = () => {
    setSelected(defaultSelection());
    setMode('round-robin');
    closeJoinRoom();
  };

  const toggle = (id: string) => {
    setSelected((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : current.length >= cap
          ? current
          : [...current, id]
    );
  };

  const atCap = selected.length >= cap;

  const start = () => {
    const roster = selected
      .map((id) => personas.find((persona) => persona.id === id))
      .filter((persona): persona is AdvisorPersona => Boolean(persona));
    if (roster.length === 0) return;
    // Reset here too, or the next open pre-selects whatever the last room happened to use.
    setSelected(defaultSelection());
    setMode('round-robin');
    joinRoom(roster, mode);
  };

  const modes = [
    { id: 'round-robin' as const, title: t.modeRoundRobin, body: t.modeRoundRobinBody, icon: Repeat },
    { id: 'panel' as const, title: t.modePanel, body: t.modePanelBody, icon: LayoutList },
  ];

  return (
    <Modal
      isOpen={isJoinRoomOpen}
      onClose={dismiss}
      title={t.joinTitle}
      description={t.joinBody}
      closeLabel={t.close}
      footer={
        <>
          <button type="button" onClick={dismiss} className="button-secondary min-h-11 justify-center">
            {t.cancel}
          </button>
          <button
            type="button"
            onClick={start}
            disabled={selected.length === 0}
            className="button-primary min-h-11 justify-center disabled:cursor-not-allowed disabled:opacity-45"
          >
            <MessagesSquare className="h-4 w-4" aria-hidden="true" />
            {t.joinStart}
          </button>
        </>
      }
    >
      <fieldset className="space-y-3">
        <legend className="field-label">{t.joinRoster}</legend>
        <p id="join-cap-hint" className="text-xs leading-relaxed text-ink-muted">
          {t.joinCap.replace('{used}', String(selected.length)).replace('{cap}', String(cap))}
        </p>
        <ul className="grid gap-2 sm:grid-cols-2" aria-describedby="join-cap-hint">
          {personas.map((persona) => {
            const isSelected = selected.includes(persona.id);
            // Disabled only when the cap is reached AND this advisor is not already in — a control
            // that goes dead while you still need it to deselect someone is a bug, not a limit.
            const isBlocked = atCap && !isSelected;
            return (
              <li key={persona.id}>
                <button
                  type="button"
                  onClick={() => toggle(persona.id)}
                  aria-pressed={isSelected}
                  disabled={isBlocked}
                  className={`flex min-h-11 w-full items-center gap-3 rounded-xl border p-3 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass disabled:cursor-not-allowed disabled:opacity-45 ${
                    isSelected ? 'border-brass bg-background' : 'border-border bg-background/50 hover:border-brass/50'
                  }`}
                >
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: persona.colorHex }}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block min-w-0 truncate text-sm font-medium text-ink">{persona.name}</span>
                    <span className="block min-w-0 truncate text-[11px] text-ink-muted">{persona.stance}</span>
                  </span>
                  {isSelected && <Check className="h-4 w-4 shrink-0 text-brass" aria-hidden="true" />}
                </button>
              </li>
            );
          })}
        </ul>
      </fieldset>

      <fieldset className="mt-6 space-y-3">
        <legend className="field-label">{t.joinMechanism}</legend>
        <div className="grid gap-2">
          {modes.map(({ id, title, body, icon: Icon }) => {
            const isSelected = mode === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setMode(id)}
                aria-pressed={isSelected}
                className={`option-card text-left ${isSelected ? 'option-card-selected' : ''}`}
              >
                <span className="flex items-start gap-3">
                  <span className="icon-tile shrink-0">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-3">
                      <span className="min-w-0 break-words font-medium text-ink">{title}</span>
                      {isSelected && (
                        <span className="badge-success shrink-0">
                          <Check className="h-3 w-3" aria-hidden="true" />
                          {t.selected}
                        </span>
                      )}
                    </span>
                    <span className="mt-2 block text-xs leading-relaxed text-ink-muted">{body}</span>
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <p className="mt-5 flex items-start gap-2 rounded-lg border border-border bg-background/60 p-3 text-xs leading-relaxed text-ink-muted">
        <Bot className="mt-0.5 h-4 w-4 shrink-0 text-brass" aria-hidden="true" />
        {t.joinA2a}
      </p>
    </Modal>
  );
};