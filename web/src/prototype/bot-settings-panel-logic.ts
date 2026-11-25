/**
 * Pure logic for the right-hand Bot & Group Room settings panel, plus the
 * workspace landing decision. Kept free of React/DOM imports so `node --test`
 * can exercise every branch directly.
 */

import { copy, type Copy } from './i18n.ts';
import type { ApiKeyConfig, ModelProvider, SavedConversation, UserBot } from './types.ts';

export type WorkspaceLang = 'en' | 'vi';

/* ------------------------------------------------------------------ */
/* Bilingual copy (EN / VI) sourced directly from i18n.ts             */
/* ------------------------------------------------------------------ */

const buildWorkspaceCopy = (c: Copy) => ({
  panelTitleSolo: c.wsPanelTitleSolo,
  panelTitleGroup: c.wsPanelTitleGroup,
  togglePanel: c.wsTogglePanel,
  openPanel: c.wsOpenPanel,
  closePanel: c.wsClosePanel,
  roomSection: c.wsRoomSection,
  roomName: c.wsRoomName,
  roomMode: c.wsRoomMode,
  roomModeRoundRobin: c.wsRoomModeRoundRobin,
  roomModePanel: c.wsRoomModePanel,
  roomModeRoundRobinHint: c.wsRoomModeRoundRobinHint,
  roomModePanelHint: c.wsRoomModePanelHint,
  roomSave: c.wsRoomSave,
  roomSaved: c.wsRoomSaved,
  roomSaveFailed: c.wsRoomSaveFailed,
  members: c.wsMembers,
  membersHint: c.wsMembersHint,
  presetBadge: c.wsPresetBadge,
  lockedBadge: c.wsLockedBadge,
  removeMember: c.wsRemoveMember,
  removeMemberMin: c.wsRemoveMemberMin,
  addMember: c.wsAddMember,
  addMemberAction: c.wsAddMemberAction,
  addMemberNone: c.wsAddMemberNone,
  addMemberLimit: c.wsAddMemberLimit,
  editMembersAdvanced: c.wsEditMembersAdvanced,
  botSection: c.wsBotSection,
  selectBotPrompt: c.wsSelectBotPrompt,
  nameLabel: c.wsNameLabel,
  instructionLabel: c.wsInstructionLabel,
  providerLabel: c.wsProviderLabel,
  modelLabel: c.wsModelLabel,
  providerDisconnected: c.wsProviderDisconnected,
  noProviders: c.wsNoProviders,
  goToKeys: c.wsGoToKeys,
  save: c.wsSave,
  saving: c.wsSaving,
  saved: c.wsSaved,
  saveFailed: c.wsSaveFailed,
  reset: c.wsReset,
  unsaved: c.wsUnsaved,
  errorName: c.wsErrorName,
  errorInstruction: c.wsErrorInstruction,
  errorProvider: c.wsErrorProvider,
  errorModel: c.wsErrorModel,
  deleteBot: c.wsDeleteBot,
  deleteConfirmBody: c.wsDeleteConfirmBody,
  deleteConfirm: c.wsDeleteConfirm,
  deleteCancel: c.wsDeleteCancel,
  deleting: c.wsDeleting,
  modelOf: c.wsModelOf,
  leftNav: c.wsLeftNav,
  newGroup: c.wsNewGroup,
  newBot: c.wsNewBot,
  groupsSection: c.wsGroupsSection,
  botsSection: c.wsBotsSection,
  groupsEmpty: c.wsGroupsEmpty,
  botsEmpty: c.wsBotsEmpty,
  members_n: c.wsMembersCount,
  apiKeys: c.wsApiKeys,
  settings: c.wsSettings,
  signOut: c.wsSignOut,
  private: c.wsPrivate,
  collapse: c.wsCollapse,
  expand: c.wsExpand,
  pinned: c.wsPinned,
  moreActions: c.wsMoreActions,
  closeMenu: c.wsCloseMenu,
});

export type WorkspaceCopy = ReturnType<typeof buildWorkspaceCopy>;
export type WorkspaceCopyKey = keyof WorkspaceCopy;

export const WORKSPACE_COPY: Record<WorkspaceLang, WorkspaceCopy> = {
  en: buildWorkspaceCopy(copy.en),
  vi: buildWorkspaceCopy(copy.vi),
};

export const workspaceCopy = (language: WorkspaceLang): WorkspaceCopy =>
  WORKSPACE_COPY[language] ?? WORKSPACE_COPY.en;

/** Replaces `{token}` placeholders. */
export const fill = (template: string, values: Record<string, string | number>): string =>
  template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match
  );

/* ------------------------------------------------------------------ */
/* Roster / selection                                                  */
/* ------------------------------------------------------------------ */

export const botPersonaIdOf = (botId: string): string => `bot:${botId}`;
export const rawBotId = (rosterId: string): string =>
  rosterId.startsWith('bot:') ? rosterId.slice(4) : rosterId;

export interface RosterMember {
  rosterId: string;
  /** The editable user bot, or null for a preset advisor persona. */
  bot: UserBot | null;
  name: string;
}

export const resolveRosterMembers = (
  roster: readonly string[],
  bots: readonly UserBot[],
  presetNames: Readonly<Record<string, string>> = {}
): RosterMember[] =>
  roster.map((rosterId) => {
    const bot = bots.find((item) => item.id === rawBotId(rosterId)) ?? null;
    return {
      rosterId,
      bot,
      name: bot?.name ?? presetNames[rosterId] ?? rawBotId(rosterId),
    };
  });

/** Which bot the right bar edits: the solo bot, or the clicked member of a group. */
export const resolveSelectedBotId = (args: {
  kind: 'solo' | 'group';
  soloBotId?: string | null;
  members: readonly RosterMember[];
  selectedId: string | null;
}): string | null => {
  const editable = args.members.filter((member) => member.bot).map((member) => member.bot!.id);
  if (args.kind === 'solo') {
    if (args.soloBotId && editable.includes(args.soloBotId)) return args.soloBotId;
    return editable[0] ?? null;
  }
  if (args.selectedId && editable.includes(args.selectedId)) return args.selectedId;
  return editable[0] ?? null;
};

export const MIN_GROUP_MEMBERS = 2;

export const canRemoveMember = (roster: readonly string[]): boolean =>
  roster.length > MIN_GROUP_MEMBERS;

export const removeRosterMember = (roster: readonly string[], rosterId: string): string[] | null =>
  canRemoveMember(roster) ? roster.filter((id) => id !== rosterId) : null;

export const canAddMember = (roster: readonly string[], maxMembers: number): boolean =>
  roster.length < maxMembers;

export const addRosterMember = (
  roster: readonly string[],
  rosterId: string,
  maxMembers: number
): string[] | null => {
  if (roster.includes(rosterId) || !canAddMember(roster, maxMembers)) return null;
  return [...roster, rosterId];
};

/** User bots that are not yet in the room. */
export const addableBots = (bots: readonly UserBot[], roster: readonly string[]): UserBot[] => {
  const taken = new Set(roster.map(rawBotId));
  return bots.filter((bot) => !taken.has(bot.id));
};

/* ------------------------------------------------------------------ */
/* Bot draft (form state)                                              */
/* ------------------------------------------------------------------ */

export interface BotDraft {
  name: string;
  instruction: string;
  provider: ModelProvider;
  model: string;
}

export const draftFromBot = (bot: UserBot): BotDraft => ({
  name: bot.name,
  instruction: bot.instruction,
  provider: bot.provider,
  model: bot.model,
});

export const normalizeDraft = (draft: BotDraft): BotDraft => ({
  ...draft,
  name: draft.name.trim(),
  instruction: draft.instruction.trim(),
});

export const isDraftDirty = (bot: UserBot, draft: BotDraft): boolean => {
  const next = normalizeDraft(draft);
  return (
    next.name !== bot.name.trim() ||
    next.instruction !== bot.instruction.trim() ||
    next.provider !== bot.provider ||
    next.model !== bot.model
  );
};

export type DraftError = 'name' | 'instruction' | 'provider' | 'model';

export const validateDraft = (draft: BotDraft): DraftError | null => {
  if (!draft.name.trim()) return 'name';
  if (!draft.instruction.trim()) return 'instruction';
  if (!draft.provider) return 'provider';
  if (!draft.model) return 'model';
  return null;
};

/* ------------------------------------------------------------------ */
/* Provider / model options                                            */
/* ------------------------------------------------------------------ */

export interface ProviderOption {
  provider: ModelProvider;
  label: string;
  connected: boolean;
  models: string[];
}

const unique = (items: readonly string[]): string[] => [...new Set(items.filter(Boolean))];

/**
 * Connected providers plus the bot's current provider (even if its key was
 * removed, so the select never silently shows a different value). The current
 * model is always present in its provider's list.
 */
export const buildProviderOptions = (
  apiKeys: readonly ApiKeyConfig[],
  current: { provider: ModelProvider; model: string },
  labelOf: (provider: ModelProvider, customLabel?: string) => string
): ProviderOption[] => {
  const options: ProviderOption[] = apiKeys
    .filter((key) => key.connected)
    .map((key) => {
      const base = key.models && key.models.length > 0 ? key.models : [key.modelName];
      const models = key.provider === current.provider ? [current.model, ...base] : base;
      return {
        provider: key.provider,
        label: labelOf(key.provider, key.label),
        connected: true,
        models: unique(models),
      };
    });

  if (current.provider && !options.some((option) => option.provider === current.provider)) {
    const known = apiKeys.find((key) => key.provider === current.provider);
    options.unshift({
      provider: current.provider,
      label: labelOf(current.provider, known?.label),
      connected: false,
      models: unique([current.model]),
    });
  }
  return options;
};

export const pickModelOnProviderChange = (
  option: ProviderOption | undefined,
  previousModel: string
): string => {
  if (!option) return '';
  return option.models.includes(previousModel) ? previousModel : (option.models[0] ?? '');
};

/* ------------------------------------------------------------------ */
/* Landing view                                                        */
/* ------------------------------------------------------------------ */

export type LandingTarget =
  | { type: 'group'; conversationId: string }
  | { type: 'solo'; botId: string; conversationId: string }
  | { type: 'bot'; botId: string }
  | { type: 'wizard' };

/** Where /dashboard should open: latest chat, else first bot, else bot creation. */
export const pickLandingTarget = (
  bots: readonly Pick<UserBot, 'id'>[],
  conversations: readonly Pick<SavedConversation, 'id' | 'kind' | 'botId' | 'updatedAt'>[]
): LandingTarget => {
  const botIds = new Set(bots.map((bot) => bot.id));
  const latest = [...conversations]
    .filter((conv) => conv.kind === 'group' || (conv.botId && botIds.has(conv.botId)))
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0))[0];
  if (latest) {
    return latest.kind === 'group'
      ? { type: 'group', conversationId: latest.id }
      : { type: 'solo', botId: latest.botId!, conversationId: latest.id };
  }
  if (bots.length > 0) return { type: 'bot', botId: bots[0].id };
  return { type: 'wizard' };
};

/* ------------------------------------------------------------------ */
/* Right-bar open preference (desktop only; mobile drawer is ephemeral) */
/* ------------------------------------------------------------------ */

export const PANEL_PREF_KEY = 'zc:bot-panel:v1';

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** Defaults to open when nothing (or garbage) is stored. */
export const readPanelPref = (storage: StorageLike | null | undefined): boolean => {
  try {
    const raw = storage?.getItem(PANEL_PREF_KEY);
    return raw === 'closed' ? false : true;
  } catch {
    return true;
  }
};

export const writePanelPref = (storage: StorageLike | null | undefined, open: boolean): void => {
  try {
    storage?.setItem(PANEL_PREF_KEY, open ? 'open' : 'closed');
  } catch {
    /* storage unavailable: preference simply isn't remembered */
  }
};

/** Breakpoint (px) at which the right bar becomes a docked column instead of a drawer. */
export const PANEL_DOCK_MIN_WIDTH = 1280;
