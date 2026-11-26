'use client';

/**
 * Group room configuration section inside BotSettingsPanel (title, mode, roster management).
 */

import React, { useState } from 'react';
import { Check, Lock, Plus, Settings2, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { modelLabel, providerLabel } from '../../data/catalog';
import { planById } from '../../data/plans';
import type { ChatMode } from '../../chat/engine';
import {
  addRosterMember,
  addableBots,
  botPersonaIdOf,
  canAddMember,
  canRemoveMember,
  fill,
  removeRosterMember,
  type RosterMember,
} from '../../bot-settings-panel-logic';
import { Initial, SectionTitle, type ChatRoomState } from './useBotSettingsStore';

export const RoomEditor: React.FC<{
  room: ChatRoomState;
  members: RosterMember[];
  activeBotId: string | null;
  onSelect: (botId: string) => void;
}> = ({ room, members, activeBotId, onSelect }) => {
  const { bots, updateGroupChat, openEditGroup, currentPlanId, isBotDisabled, t } = useApp();
  const conversationId = room.conversationId;
  const [titleDraft, setTitleDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<'saved' | 'error' | null>(null);
  const [toAdd, setToAdd] = useState('');

  const maxMembers = planById(currentPlanId).maxActiveAdvisors;
  const candidates = addableBots(bots, room.roster);
  const addTarget = candidates.find((bot) => bot.id === toAdd) ?? candidates[0];
  const titleValue = titleDraft ?? room.title;
  const titleDirty =
    titleDraft !== null && titleDraft.trim() !== '' && titleDraft.trim() !== room.title;
  const canEdit = Boolean(conversationId);

  const apply = async (patch: { title?: string; mode?: ChatMode; roster?: string[] }) => {
    if (!conversationId || busy) return;
    setBusy(true);
    const ok = await updateGroupChat(conversationId, patch);
    setBusy(false);
    setNotice(ok ? 'saved' : 'error');
    if (ok && patch.title !== undefined) setTitleDraft(null);
  };

  return (
    <section data-bot-settings-room className="space-y-5">
      <SectionTitle>{t.wsRoomSection}</SectionTitle>

      <label className="field">
        <span className="field-label">{t.wsRoomName}</span>
        <div className="flex min-w-0 gap-2">
          <input
            data-bot-settings-room-title
            value={titleValue}
            maxLength={100}
            disabled={!canEdit}
            onChange={(event) => {
              setTitleDraft(event.target.value);
              setNotice(null);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && titleDirty) {
                event.preventDefault();
                void apply({ title: titleValue.trim() });
              }
            }}
            className="!min-h-11 min-w-0 !rounded-xl !px-3 !py-2 !text-sm"
          />
          <button
            type="button"
            data-bot-settings-room-save
            disabled={!titleDirty || busy}
            onClick={() => void apply({ title: titleValue.trim() })}
            aria-label={t.wsRoomSave}
            title={t.wsRoomSave}
            className="icon-button shrink-0 !rounded-xl disabled:cursor-not-allowed disabled:opacity-45"
          >
            <Check className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </label>

      <fieldset className="min-w-0 space-y-2" disabled={!canEdit || busy}>
        <legend className="field-label mb-2">{t.wsRoomMode}</legend>
        <div className="grid grid-cols-2 gap-2">
          {(['round-robin', 'panel'] as const).map((mode) => {
            const active = room.mode === mode;
            return (
              <button
                key={mode}
                type="button"
                data-bot-settings-mode={mode}
                aria-pressed={active}
                onClick={() => {
                  if (!active) void apply({ mode });
                }}
                className={`min-h-11 truncate rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                  active
                    ? 'border-brass bg-brass/10 text-ink'
                    : 'border-border bg-surface text-ink-muted hover:text-ink'
                }`}
              >
                {mode === 'panel' ? t.wsRoomModePanel : t.wsRoomModeRoundRobin}
              </button>
            );
          })}
        </div>
        <p className="text-xs leading-relaxed text-ink-muted">
          {room.mode === 'panel' ? t.wsRoomModePanelHint : t.wsRoomModeRoundRobinHint}
        </p>
      </fieldset>

      <div className="space-y-2">
        <SectionTitle>{fill(t.wsMembers, { count: members.length })}</SectionTitle>
        <p className="text-xs leading-relaxed text-ink-muted">{t.wsMembersHint}</p>
        <ul className="space-y-1.5">
          {members.map((member) => {
            const isActive = member.bot?.id === activeBotId;
            const locked = member.bot ? isBotDisabled(member.bot.id) : false;
            const removable = canEdit && canRemoveMember(room.roster);
            return (
              <li
                key={member.rosterId}
                data-bot-settings-member={member.bot?.id ?? member.rosterId}
                className={`flex min-w-0 items-center gap-1 rounded-xl border pr-1 ${
                  isActive ? 'border-brass bg-brass/10' : 'border-border bg-surface'
                }`}
              >
                <button
                  type="button"
                  disabled={!member.bot}
                  aria-pressed={isActive}
                  onClick={() => member.bot && onSelect(member.bot.id)}
                  className="flex min-h-11 min-w-0 flex-1 items-center gap-2.5 rounded-xl px-2.5 text-left disabled:cursor-default"
                >
                  <Initial name={member.name} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">
                      {member.name}
                    </span>
                    <span className="block truncate text-[11px] text-ink-muted">
                      {member.bot
                        ? fill(t.wsModelOf, {
                            provider: providerLabel(member.bot.provider),
                            model: modelLabel(member.bot.model),
                          })
                        : t.wsPresetBadge}
                    </span>
                  </span>
                  {locked && (
                    <Lock className="h-3.5 w-3.5 shrink-0 text-brass" aria-label={t.wsLockedBadge} />
                  )}
                </button>
                <button
                  type="button"
                  data-bot-settings-remove={member.rosterId}
                  onClick={() => {
                    const next = removeRosterMember(room.roster, member.rosterId);
                    if (next) void apply({ roster: next });
                  }}
                  disabled={!removable || busy}
                  aria-label={fill(t.wsRemoveMember, { name: member.name })}
                  title={removable ? fill(t.wsRemoveMember, { name: member.name }) : t.wsRemoveMemberMin}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-ink-muted transition hover:bg-surface-2 hover:text-terracotta disabled:cursor-not-allowed disabled:opacity-35"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>

        {candidates.length > 0 && canAddMember(room.roster, maxMembers) ? (
          <div className="flex min-w-0 gap-2 pt-1">
            <select
              aria-label={t.wsAddMember}
              data-bot-settings-add-select
              value={addTarget?.id ?? ''}
              onChange={(event) => setToAdd(event.target.value)}
              disabled={!canEdit || busy}
              className="min-h-11 min-w-0 flex-1 rounded-xl border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brass"
            >
              {candidates.map((bot) => (
                <option key={bot.id} value={bot.id}>
                  {bot.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              data-bot-settings-add
              disabled={!canEdit || busy || !addTarget}
              onClick={() => {
                if (!addTarget) return;
                const next = addRosterMember(room.roster, botPersonaIdOf(addTarget.id), maxMembers);
                if (next) void apply({ roster: next });
              }}
              className="button-secondary min-h-11 shrink-0 !px-3 !py-2 text-sm disabled:opacity-45"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              {t.wsAddMemberAction}
            </button>
          </div>
        ) : (
          <p className="text-xs leading-relaxed text-ink-muted">
            {candidates.length === 0
              ? t.wsAddMemberNone
              : fill(t.wsAddMemberLimit, { max: maxMembers })}
          </p>
        )}
      </div>

      <div aria-live="polite" className="min-h-5 text-sm">
        {notice === 'saved' && (
          <p className="inline-flex items-center gap-1.5 font-medium text-sage">
            <Check className="h-4 w-4" aria-hidden="true" />
            {t.wsRoomSaved}
          </p>
        )}
        {notice === 'error' && (
          <p role="alert" className="font-medium text-terracotta">
            {t.wsRoomSaveFailed}
          </p>
        )}
      </div>

      {conversationId && (
        <button
          type="button"
          onClick={() => openEditGroup(conversationId)}
          className="button-quiet min-h-11 w-full !px-3 !py-2 text-sm"
        >
          <Settings2 className="h-4 w-4" aria-hidden="true" />
          {t.wsEditMembersAdvanced}
        </button>
      )}
    </section>
  );
};
