import React, { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { planById } from '../data/plans';
import { Bot, Check, Eye, LayoutList, Lock, MessagesSquare } from 'lucide-react';
import type { ChatMode } from '../chat/engine';
import type { AdvisorPersona, SavedConversation } from '../types';
import type { CommunicationMode } from '@/lib/deliberation/engine';
import { Modal } from './Modal';

export const JoinRoomModal: React.FC = () => {
  const { isJoinRoomOpen, editingGroupId, conversations } = useApp();
  const editingGroup = editingGroupId
    ? conversations.find((c) => c.id === editingGroupId && c.kind === 'group')
    : undefined;
  const isOpen = isJoinRoomOpen || Boolean(editingGroup);
  if (!isOpen) return null;
  return (
    <JoinRoomDialog
      key={editingGroup ? `edit-${editingGroup.id}` : 'create-group'}
      editingGroup={editingGroup}
    />
  );
};

const JoinRoomDialog: React.FC<{ editingGroup?: SavedConversation }> = ({ editingGroup }) => {
  const {
    closeJoinRoom,
    editingGroupId,
    closeEditGroup,
    updateGroupChat,
    joinRoom,
    personas,
    botsReady,
    isBotDisabled,
    currentPlanId,
    t,
  } = useApp();

  const plan = planById(currentPlanId);
  const cap = plan.maxActiveAdvisors;

  // Chỉ lấy bot do người dùng tạo, không lấy cố vấn mặc định từ mockData.
  const userBots = useMemo(
    () => personas.filter((persona) => persona.id.startsWith('bot:')),
    [personas]
  );

  const activePersonas = useMemo(
    () =>
      userBots.filter(
        (persona) => !isBotDisabled(persona.id.slice(4))
      ),
    [userBots, isBotDisabled]
  );

  const initialSelection = editingGroup
    ? editingGroup.roster.filter((id) =>
        userBots.some((persona) => persona.id === id)
      )
    : activePersonas
        .slice(0, Math.min(3, cap))
        .map((persona) => persona.id);

  const [groupTitle, setGroupTitle] = useState(editingGroup?.title ?? '');
  const [selected, setSelected] = useState<string[]>(initialSelection);
  const [communicationMode, setCommunicationMode] = useState<CommunicationMode>(
    editingGroup?.mode === 'panel' ? 'independent' : 'debate'
  );
  const [mode, setMode] = useState<ChatMode>(editingGroup?.mode ?? 'round-robin');
  const [saving, setSaving] = useState(false);

  const dismiss = () => {
    if (editingGroupId) {
      closeEditGroup();
    } else {
      closeJoinRoom();
    }
  };

  const toggle = (id: string) => {
    const isLockedBot = id.startsWith('bot:') && isBotDisabled(id.slice(4));
    setSelected((current) => {
      if (current.includes(id)) {
        return current.filter((item) => item !== id);
      }
      if (isLockedBot || current.length >= cap) return current;
      return [...current, id];
    });
  };

  const atCap = selected.length >= cap;
  const activeSelectedCount = selected.filter((id) => {
    if (!id.startsWith('bot:')) return true;
    return !isBotDisabled(id.slice(4));
  }).length;
  const meetsGroupMinimum =
    botsReady && selected.length >= 2 && (editingGroup ? selected.length >= 2 : activeSelectedCount >= 2);

  const submit = async () => {
    if (!meetsGroupMinimum || saving) return;
    if (editingGroup) {
      setSaving(true);
      await updateGroupChat(editingGroup.id, {
        title: groupTitle.trim() || editingGroup.title,
        mode,
        roster: selected,
      });
      setSaving(false);
      return;
    }
    const roster = selected
      .map((id) => userBots.find((persona) => persona.id === id))
      .filter((persona): persona is AdvisorPersona => Boolean(persona));
    if (roster.length < 2) return;
    joinRoom(roster, mode, groupTitle.trim() || undefined);
  };

  const communicationModes = [
    {
      id: 'independent' as const,
      title: t.modeIndependentTitle,
      body: t.modeIndependentBody,
      icon: Eye,
      chatMode: 'panel' as ChatMode,
    },
    {
      id: 'debate' as const,
      title: t.modeDebateTitle,
      body: t.modeDebateBody,
      icon: MessagesSquare,
      chatMode: 'round-robin' as ChatMode,
    },
    {
      id: 'chain' as const,
      title: t.modeChainTitle,
      body: t.modeChainBody,
      icon: LayoutList,
      chatMode: 'round-robin' as ChatMode,
    },
  ];

  return (
    <Modal
      isOpen={true}
      onClose={dismiss}
      title={editingGroup ? t.groupEditTitle : t.joinTitle}
      description={t.joinBody}
      closeLabel={t.close}
      footer={
        <>
          <button
            type="button"
            onClick={dismiss}
            className="button-secondary min-h-11 justify-center"
          >
            {t.cancel}
          </button>
          <button
            type="button"
            id="group-chat-submit-btn"
            onClick={() => void submit()}
            disabled={!meetsGroupMinimum || saving}
            className="button-primary min-h-11 justify-center disabled:cursor-not-allowed disabled:opacity-45"
          >
            <MessagesSquare className="h-4 w-4" aria-hidden="true" />
            {editingGroup ? t.groupSaveChanges : t.joinStart}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <label className="field">
          <span className="field-label">{t.groupChatTitleLabel}</span>
          <input
            id="group-chat-title"
            type="text"
            value={groupTitle}
            maxLength={100}
            placeholder={t.groupChatTitlePlaceholder}
            onChange={(event) => setGroupTitle(event.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-brass"
          />
        </label>

        <fieldset className="space-y-3">
          <legend className="field-label">{t.joinRoster}</legend>
          <p id="join-cap-hint" className="text-xs leading-relaxed text-ink-muted">
            {t.joinCap
              .replace('{used}', String(selected.length))
              .replace('{cap}', String(cap))}{' '}
            {t.joinOrderHint}
          </p>

          {!meetsGroupMinimum && (
            <p
              role="alert"
              className="rounded-lg border border-brass/40 bg-brass/10 px-3 py-2 text-xs font-medium text-ink"
            >
              {t.groupMinTwoHint.replace('{count}', String(selected.length))}
            </p>
          )}

          {!botsReady ? (
            <p className="py-4 text-center text-sm text-ink-muted">
              {t.joinBotsLoading}
            </p>
          ) : userBots.length === 0 ? (
            <div
              role="status"
              className="rounded-xl border border-dashed border-border bg-background/50 px-4 py-8 text-center"
            >
              <Bot className="mx-auto mb-3 h-8 w-8 text-ink-muted" />
              <p className="text-sm font-medium text-ink">
                {t.joinBotsEmpty}
              </p>
            </div>
          ) : (
            <ul
              className="grid gap-2 sm:grid-cols-2"
              aria-describedby="join-cap-hint"
            >
              {userBots.map((persona) => {
                const isSelected = selected.includes(persona.id);
                const isLockedBot = isBotDisabled(persona.id.slice(4));
                const isBlocked = (atCap && !isSelected) || (isLockedBot && !isSelected);
              return (
                <li key={persona.id}>
                  <button
                    type="button"
                    data-group-bot-option={persona.id}
                    onClick={() => toggle(persona.id)}
                    aria-pressed={isSelected}
                    disabled={isBlocked}
                    className={`flex min-h-11 w-full items-center gap-3 rounded-xl border p-3 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass disabled:cursor-not-allowed disabled:opacity-45 ${
                      isSelected
                        ? 'border-brass bg-background'
                        : 'border-border bg-background/50 hover:border-brass/50'
                    }`}
                  >
                    <span
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: persona.colorHex }}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className="truncate text-sm font-medium text-ink">
                          {persona.name}
                        </span>
                        {isLockedBot && (
                          <span className="inline-flex shrink-0 items-center gap-0.5 rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold text-brass">
                            <Lock className="h-2.5 w-2.5" aria-hidden="true" />
                            {t.botDisabledBadge}
                          </span>
                        )}
                      </span>
                      <span className="block min-w-0 truncate text-[11px] text-ink-muted">
                        {persona.stance}
                      </span>
                    </span>
                    {isSelected && (
                      <span
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brass text-[11px] font-semibold text-accent-ink"
                        aria-label={`${selected.indexOf(persona.id) + 1}`}
                      >
                        {selected.indexOf(persona.id) + 1}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
          )}
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="field-label">{t.modeLabel}</legend>
          <p className="text-xs leading-relaxed text-ink-muted">{t.modeHint}</p>
          <div className="grid gap-2">
            {communicationModes.map(({ id, title, body, icon: Icon, chatMode }) => {
              const isSelected = communicationMode === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setCommunicationMode(id);
                    setMode(chatMode);
                  }}
                  aria-pressed={isSelected}
                  className={`option-card relative w-full text-left ${
                    isSelected ? 'option-card-selected' : ''
                  }`}
                >
                  <span className="flex items-start gap-3">
                    <span className="icon-tile shrink-0">
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium text-ink">{title}</span>
                        {isSelected && (
                          <span className="badge-success shrink-0">
                            <Check className="h-3 w-3" aria-hidden="true" />
                            {t.selected}
                          </span>
                        )}
                      </span>
                      <span className="mt-2 block text-xs leading-relaxed text-ink-muted">
                        {body}
                      </span>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <p className="flex items-start gap-2 rounded-lg border border-border bg-background/60 p-3 text-xs leading-relaxed text-ink-muted">
          <Bot className="mt-0.5 h-4 w-4 shrink-0 text-brass" aria-hidden="true" />
          {t.joinA2a}
        </p>
      </div>
    </Modal>
  );
};
