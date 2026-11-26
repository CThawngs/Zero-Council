'use client';

/**
 * Right-hand workspace inspector panel (docked on >= xl, accessible dialog drawer on smaller screens).
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { localizePersona } from '../data/catalog';
import { resolveRosterMembers, resolveSelectedBotId } from '../bot-settings-panel-logic';
import { BotEditor } from './bot-settings/BotEditor';
import { RoomEditor } from './bot-settings/RoomEditor';
import {
  Initial,
  SectionTitle,
  resetDrawer,
  useBotSettingsPanel,
  type ChatRoomState,
} from './bot-settings/useBotSettingsStore';

export { useBotSettingsPanel };

const PanelBody: React.FC<{
  room: ChatRoomState;
  onClose: () => void;
  closeRef?: React.Ref<HTMLButtonElement>;
}> = ({ room, onClose, closeRef }) => {
  const { bots, personas, language, openFirstBotOrWizard, t } = useApp();
  const isSolo = room.kind === 'solo' || room.roster.length === 1;
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const presetNames = useMemo(
    () =>
      Object.fromEntries(
        personas.map((persona) => [persona.id, localizePersona(persona, language).name])
      ),
    [personas, language]
  );
  const members = useMemo(
    () => resolveRosterMembers(room.roster, bots, presetNames),
    [room.roster, bots, presetNames]
  );
  const activeBotId = resolveSelectedBotId({
    kind: isSolo ? 'solo' : 'group',
    soloBotId: room.botId,
    members,
    selectedId,
  });
  const activeBot = bots.find((bot) => bot.id === activeBotId) ?? null;

  const handleDeleted = (botId: string) => {
    if (isSolo) {
      openFirstBotOrWizard(botId);
      return;
    }
    if (selectedId === botId) setSelectedId(null);
  };

  const botSignature = activeBot
    ? `${activeBot.id}:${activeBot.updatedAt ?? ''}:${activeBot.name}:${activeBot.provider}:${activeBot.model}:${activeBot.instruction}`
    : 'none';

  return (
    <>
      <div className="flex min-h-[60px] shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-2">
        <div className="flex min-w-0 items-center gap-2.5">
          {isSolo && activeBot ? <Initial name={activeBot.name} /> : null}
          <div className="min-w-0">
            <h2 className="truncate text-sm font-bold text-ink">
              {isSolo ? t.wsPanelTitleSolo : t.wsPanelTitleGroup}
            </h2>
            {isSolo && activeBot ? (
              <p className="truncate text-[11px] text-ink-muted">{activeBot.name}</p>
            ) : (
              <p className="truncate text-[11px] text-ink-muted">{room.title}</p>
            )}
          </div>
        </div>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label={t.wsClosePanel}
          title={t.wsClosePanel}
          className="icon-button shrink-0"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overflow-x-hidden px-4 py-5">
        {!isSolo && (
          <RoomEditor
            room={room}
            members={members}
            activeBotId={activeBotId}
            onSelect={setSelectedId}
          />
        )}

        {activeBot ? (
          <section
            data-bot-settings-bot={activeBot.id}
            className={`space-y-4 ${!isSolo ? 'border-t border-border pt-6' : ''}`}
          >
            {!isSolo && (
              <div className="flex min-w-0 items-center gap-2.5">
                <Initial name={activeBot.name} size="sm" />
                <SectionTitle>
                  {t.wsBotSection} · {activeBot.name}
                </SectionTitle>
              </div>
            )}
            <BotEditor key={botSignature} bot={activeBot} onDeleted={handleDeleted} />
          </section>
        ) : (
          <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-ink-muted">
            {t.wsSelectBotPrompt}
          </p>
        )}
      </div>
    </>
  );
};

export const BotSettingsPanel: React.FC = () => {
  const { currentRoom, t } = useApp();
  const { docked, visible, close } = useBotSettingsPanel();
  const [entered, setEntered] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const drawerOpen = visible && !docked;

  useEffect(() => () => resetDrawer(), []);

  useEffect(() => {
    if (!drawerOpen) return;
    const frame = requestAnimationFrame(() => {
      setEntered(true);
      closeRef.current?.focus();
    });
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      setEntered(false);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [drawerOpen, close]);

  if (!currentRoom || !visible) return null;

  const isSolo = currentRoom.kind === 'solo' || currentRoom.roster.length === 1;
  const panelLabel = isSolo ? t.wsPanelTitleSolo : t.wsPanelTitleGroup;

  if (docked) {
    return (
      <aside
        data-bot-settings-panel="docked"
        aria-label={panelLabel}
        className="sticky top-[76px] hidden h-[calc(100dvh-76px)] w-80 shrink-0 flex-col border-l border-border bg-surface-2/50 xl:flex"
      >
        <PanelBody room={currentRoom} onClose={close} />
      </aside>
    );
  }

  return (
    <>
      <div
        className="fixed inset-0 z-[60] bg-black/50 xl:hidden"
        onClick={close}
        aria-hidden="true"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={panelLabel}
        data-bot-settings-panel="drawer"
        className={`fixed inset-y-0 right-0 z-[70] flex h-dvh w-[min(92vw,400px)] flex-col border-l border-border bg-surface shadow-2xl transition-transform duration-200 ease-out xl:hidden ${
          entered ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <PanelBody room={currentRoom} onClose={close} closeRef={closeRef} />
      </aside>
    </>
  );
};
