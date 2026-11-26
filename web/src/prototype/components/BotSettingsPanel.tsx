'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { Check, KeyRound, Loader2, Lock, Plus, RotateCcw, Settings2, Trash2, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { localizePersona, modelLabel, providerLabel } from '../data/catalog';
import { planById } from '../data/plans';
import type { ChatMode } from '../chat/engine';
import type { Copy } from '../i18n';
import type { UserBot } from '../types';
import {
  PANEL_DOCK_MIN_WIDTH,
  addRosterMember,
  addableBots,
  botPersonaIdOf,
  buildProviderOptions,
  canAddMember,
  canRemoveMember,
  draftFromBot,
  fill,
  isDraftDirty,
  normalizeDraft,
  pickModelOnProviderChange,
  readPanelPref,
  removeRosterMember,
  resolveRosterMembers,
  resolveSelectedBotId,
  validateDraft,
  writePanelPref,
  type BotDraft,
  type DraftError,
  type RosterMember,
} from '../bot-settings-panel-logic';

/* ------------------------------------------------------------------ */
/* Open/close store, shared by Header (toggle button) and the panel.   */
/* Desktop (>= xl) remembers the choice; the mobile drawer never does. */
/* ------------------------------------------------------------------ */

interface PanelState {
  desktopOpen: boolean;
  drawerOpen: boolean;
}

const SERVER_PANEL_STATE: PanelState = { desktopOpen: true, drawerOpen: false };
let panelState: PanelState = SERVER_PANEL_STATE;
let panelHydrated = false;
const panelListeners = new Set<() => void>();

const setPanelState = (next: PanelState) => {
  panelState = next;
  panelListeners.forEach((listener) => listener());
};

const subscribePanel = (listener: () => void) => {
  panelListeners.add(listener);
  return () => {
    panelListeners.delete(listener);
  };
};

const getPanelSnapshot = (): PanelState => {
  if (!panelHydrated && typeof window !== 'undefined') {
    panelHydrated = true;
    const desktopOpen = readPanelPref(window.localStorage);
    if (desktopOpen !== panelState.desktopOpen) panelState = { ...panelState, desktopOpen };
  }
  return panelState;
};

const getServerPanelSnapshot = (): PanelState => SERVER_PANEL_STATE;

const DOCK_QUERY = `(min-width: ${PANEL_DOCK_MIN_WIDTH}px)`;
const subscribeDock = (listener: () => void) => {
  const query = window.matchMedia(DOCK_QUERY);
  query.addEventListener('change', listener);
  return () => query.removeEventListener('change', listener);
};
const getDockSnapshot = () => window.matchMedia(DOCK_QUERY).matches;
const getServerDockSnapshot = () => false;

export const useBotSettingsPanel = () => {
  const state = useSyncExternalStore(subscribePanel, getPanelSnapshot, getServerPanelSnapshot);
  const docked = useSyncExternalStore(subscribeDock, getDockSnapshot, getServerDockSnapshot);
  const visible = docked ? state.desktopOpen : state.drawerOpen;

  const toggle = useCallback(() => {
    const current = getPanelSnapshot();
    if (window.matchMedia(DOCK_QUERY).matches) {
      const desktopOpen = !current.desktopOpen;
      writePanelPref(window.localStorage, desktopOpen);
      setPanelState({ ...current, desktopOpen });
    } else {
      setPanelState({ ...current, drawerOpen: !current.drawerOpen });
    }
  }, []);

  const close = useCallback(() => {
    const current = getPanelSnapshot();
    if (window.matchMedia(DOCK_QUERY).matches) {
      writePanelPref(window.localStorage, false);
      setPanelState({ ...current, desktopOpen: false });
    } else {
      setPanelState({ ...current, drawerOpen: false });
    }
  }, []);

  return { docked, visible, toggle, close };
};

const resetDrawer = () => {
  const current = getPanelSnapshot();
  if (current.drawerOpen) setPanelState({ ...current, drawerOpen: false });
};

/* ------------------------------------------------------------------ */
/* Small presentational pieces                                         */
/* ------------------------------------------------------------------ */

const Initial: React.FC<{ name: string; size?: 'sm' | 'md' }> = ({ name, size = 'md' }) => (
  <span
    aria-hidden="true"
    className={`flex shrink-0 items-center justify-center rounded-full bg-brass/15 font-bold uppercase text-brass ${
      size === 'sm' ? 'h-7 w-7 text-xs' : 'h-9 w-9 text-sm'
    }`}
  >
    {(name.trim()[0] ?? '?').toUpperCase()}
  </span>
);

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h3 className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink-muted">
    {children}
  </h3>
);

type ChatRoomState = NonNullable<ReturnType<typeof useApp>['currentRoom']>;

const draftErrorLabel = (t: Copy, error: DraftError): string => {
  switch (error) {
    case 'name':
      return t.wsErrorName;
    case 'instruction':
      return t.wsErrorInstruction;
    case 'provider':
      return t.wsErrorProvider;
    case 'model':
      return t.wsErrorModel;
  }
};

/* ------------------------------------------------------------------ */
/* Per-bot editor (name / instructions / provider / model / save / del)*/
/* ------------------------------------------------------------------ */

const BotEditor: React.FC<{ bot: UserBot; onDeleted: (botId: string) => void }> = ({
  bot,
  onDeleted,
}) => {
  const { apiKeys, updateBot, deleteBot, setCurrentView, t } = useApp();
  const [draft, setDraft] = useState<BotDraft>(() => draftFromBot(bot));
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState<DraftError | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const providerOptions = useMemo(
    () => buildProviderOptions(apiKeys, { provider: draft.provider, model: draft.model }, providerLabel),
    [apiKeys, draft.provider, draft.model]
  );
  const activeOption = providerOptions.find((option) => option.provider === draft.provider);
  const hasConnected = providerOptions.some((option) => option.connected);
  const dirty = isDraftDirty(bot, draft);

  const patch = (next: Partial<BotDraft>) => {
    setDraft((current) => ({ ...current, ...next }));
    setStatus('idle');
    setError(null);
  };

  const resetDraft = () => {
    setDraft(draftFromBot(bot));
    setStatus('idle');
    setError(null);
  };

  const onProviderChange = (provider: string) => {
    const option = providerOptions.find((item) => item.provider === provider);
    patch({ provider, model: pickModelOnProviderChange(option, draft.model) });
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (status === 'saving') return;
    const problem = validateDraft(draft);
    if (problem) {
      setError(problem);
      return;
    }
    setStatus('saving');
    const next = normalizeDraft(draft);
    const saved = await updateBot(bot.id, next);
    if (saved) {
      setDraft(draftFromBot(saved));
      setStatus('saved');
    } else {
      setStatus('error');
    }
  };

  const remove = async () => {
    if (deleting) return;
    setDeleting(true);
    await deleteBot(bot.id);
    setDeleting(false);
    setConfirmingDelete(false);
    onDeleted(bot.id);
  };

  const idBase = `bot-settings-${bot.id}`;

  return (
    <form
      onSubmit={(event) => void save(event)}
      data-bot-settings-form={bot.id}
      className="space-y-5"
      noValidate
    >
      <label className="field">
        <span className="field-label">{t.wsNameLabel}</span>
        <input
          id={`${idBase}-name`}
          data-bot-settings-name
          value={draft.name}
          maxLength={80}
          onChange={(event) => patch({ name: event.target.value })}
          aria-invalid={error === 'name'}
          className="!min-h-11 !rounded-xl !px-3 !py-2 !text-sm"
        />
      </label>

      <label className="field">
        <span className="field-label">{t.wsInstructionLabel}</span>
        <textarea
          id={`${idBase}-instruction`}
          data-bot-settings-instruction
          value={draft.instruction}
          rows={6}
          maxLength={4000}
          onChange={(event) => patch({ instruction: event.target.value })}
          aria-invalid={error === 'instruction'}
          className="!min-h-32 !rounded-xl !px-3 !py-2 !text-sm leading-relaxed"
        />
      </label>

      {hasConnected ? (
        <div className="grid gap-4">
          <label className="field">
            <span className="field-label">{t.wsProviderLabel}</span>
            <select
              id={`${idBase}-provider`}
              data-bot-settings-provider
              value={draft.provider}
              onChange={(event) => onProviderChange(event.target.value)}
              className="!min-h-11 !rounded-xl !px-3 !py-2 !text-sm"
            >
              {providerOptions.map((option) => (
                <option key={option.provider} value={option.provider}>
                  {option.connected
                    ? option.label
                    : fill(t.wsProviderDisconnected, { label: option.label })}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field-label">{t.wsModelLabel}</span>
            <select
              id={`${idBase}-model`}
              data-bot-settings-model
              value={draft.model}
              onChange={(event) => patch({ model: event.target.value })}
              className="!min-h-11 !rounded-xl !px-3 !py-2 !text-sm"
            >
              {(activeOption?.models ?? [draft.model]).map((model) => (
                <option key={model} value={model}>
                  {modelLabel(model)}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : (
        <div className="space-y-3 rounded-xl border border-border bg-surface-2 p-3">
          <p className="text-sm leading-relaxed text-ink-muted">{t.wsNoProviders}</p>
          <button
            type="button"
            onClick={() => setCurrentView('api-keys')}
            className="button-secondary min-h-11 w-full !px-4 !py-2 text-sm"
          >
            <KeyRound className="h-4 w-4" aria-hidden="true" />
            {t.wsGoToKeys}
          </button>
        </div>
      )}

      <div aria-live="polite" className="min-h-5 text-sm">
        {error ? (
          <p role="alert" className="font-medium text-terracotta">
            {draftErrorLabel(t, error)}
          </p>
        ) : status === 'error' ? (
          <p role="alert" className="font-medium text-terracotta">
            {t.wsSaveFailed}
          </p>
        ) : status === 'saved' && !dirty ? (
          <p className="inline-flex items-center gap-1.5 font-medium text-sage">
            <Check className="h-4 w-4" aria-hidden="true" />
            {t.wsSaved}
          </p>
        ) : dirty ? (
          <p className="text-ink-muted">{t.wsUnsaved}</p>
        ) : null}
      </div>

      <div className={dirty ? 'grid grid-cols-[1fr_auto] gap-2' : ''}>
        <button
          type="submit"
          data-bot-settings-save
          disabled={!dirty || status === 'saving'}
          className="button-primary min-h-11 w-full !px-4 !py-2 text-sm disabled:cursor-not-allowed disabled:opacity-45"
        >
          {status === 'saving' ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Check className="h-4 w-4" aria-hidden="true" />
          )}
          {status === 'saving' ? t.wsSaving : t.wsSave}
        </button>
        {dirty && (
          <button
            type="button"
            data-bot-settings-reset
            disabled={status === 'saving'}
            onClick={resetDraft}
            aria-label={t.wsReset}
            title={t.wsReset}
            className="button-secondary min-h-11 shrink-0 !px-3 !py-2 text-sm"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            <span>{t.wsReset}</span>
          </button>
        )}
      </div>

      <div className="border-t border-border pt-4">
        {confirmingDelete ? (
          <div
            role="alertdialog"
            aria-label={t.wsDeleteBot}
            data-bot-settings-delete-confirm
            className="space-y-3 rounded-xl border border-terracotta/40 bg-terracotta/10 p-3"
          >
            <p className="text-sm leading-relaxed text-ink">
              {fill(t.wsDeleteConfirmBody, { name: bot.name })}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                disabled={deleting}
                className="button-secondary min-h-11 !px-3 !py-2 text-sm"
              >
                {t.wsDeleteCancel}
              </button>
              <button
                type="button"
                data-bot-settings-delete-yes
                onClick={() => void remove()}
                disabled={deleting}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-terracotta px-3 py-2 text-sm font-bold text-accent-ink transition hover:opacity-90 disabled:opacity-60"
              >
                {deleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                )}
                {deleting ? t.wsDeleting : t.wsDeleteConfirm}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            data-bot-settings-delete
            onClick={() => setConfirmingDelete(true)}
            className="button-danger min-h-11 w-full !px-4 !py-2 text-sm"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            {t.wsDeleteBot}
          </button>
        )}
      </div>
    </form>
  );
};

/* ------------------------------------------------------------------ */
/* Group-room section: name, mode, members (click to edit that bot)    */
/* ------------------------------------------------------------------ */

const RoomEditor: React.FC<{
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
  const titleDirty = titleDraft !== null && titleDraft.trim() !== '' && titleDraft.trim() !== room.title;
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

/* ------------------------------------------------------------------ */
/* Panel body (shared by the docked column and the mobile drawer)      */
/* ------------------------------------------------------------------ */

const PanelBody: React.FC<{ room: ChatRoomState; onClose: () => void; closeRef?: React.Ref<HTMLButtonElement> }> = ({
  room,
  onClose,
  closeRef,
}) => {
  const { bots, personas, language, openFirstBotOrWizard, t } = useApp();
  const isSolo = room.kind === 'solo' || room.roster.length === 1;
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const presetNames = useMemo(
    () =>
      Object.fromEntries(personas.map((persona) => [persona.id, localizePersona(persona, language).name])),
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

/* ------------------------------------------------------------------ */
/* Public component                                                    */
/* ------------------------------------------------------------------ */

export const BotSettingsPanel: React.FC = () => {
  const { currentRoom, t } = useApp();
  const { docked, visible, close } = useBotSettingsPanel();
  const [entered, setEntered] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const drawerOpen = visible && !docked;

  // Leaving the chat view must never leave a stale drawer open for next time.
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
