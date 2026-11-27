/**
 * Public and internal TypeScript contracts for the application workspace context (`AppContext`).
 */

import type {
  AdvisorPersona,
  ApiKeyConfig,
  ConversationKind,
  DeliberationSession,
  Language,
  ModelProvider,
  SavedConversation,
  UserBot,
  ViewType,
} from '../types';
import type { copy } from '../i18n';
import type { Theme } from '../theme';
import type { ContentPanelPayload } from '../chat/content-render';
import type {
  ChatAttachment,
  ChatMode,
  ChatMessage,
  TurnError,
  TurnFailure,
  TurnFailureReason,
  WhyStop,
} from '../chat/engine';
import type { Plan, PlanId } from '../data/plans';
import type { AnalyticsConsent } from '../components/CookieNotice';

export interface ChatRoom {
  conversationId?: string;
  kind?: ConversationKind;
  botId?: string;
  title: string;
  mode: ChatMode;
  roster: string[];
  messages: ChatMessage[];
  pending: ChatAttachment[];
  turns: number;
  stoppedBy: WhyStop | null;
  failures: TurnFailure[];
  failureReason?: TurnFailureReason;
  turnError?: TurnError | null;
  held: string[];
}

export type ChatRoomState = ChatRoom;

export interface ConnectProviderMeta {
  models?: string[];
  label?: string;
  protocol?: 'anthropic' | 'openai' | 'google';
  baseUrl?: string;
  isCustom?: boolean;
}

/** Outcome of saving a provider key: returns the server's stable error code on failure. */
export type ConnectApiKeyResult = { ok: true; warning?: string } | { ok: false; error: string };

export type ToastKey = {
  [K in keyof (typeof copy)['en']]: (typeof copy)['en'][K] extends string ? K : never;
}[keyof (typeof copy)['en']];

export type ToastValues = Record<string, string>;
export type ToastMessage = { key: ToastKey; values?: ToastValues };

export interface AppContextType {
  currentView: ViewType;
  setCurrentView: (view: ViewType) => void;
  language: Language;
  setLanguage: (language: Language) => Promise<void>;
  theme: Theme;
  toggleTheme: () => void;
  t: (typeof copy)[Language];
  sessions: DeliberationSession[];
  currentSessionId: string;
  setCurrentSessionId: (id: string) => void;
  currentSession: DeliberationSession;
  cancelRound: () => void;
  isDeliberating: boolean;
  selectedRoundIndex: number;
  selectRound: (index: number) => void;
  purgeSessions: () => void;
  renameSession: (id: string, title: string) => void;
  deleteSession: (id: string) => void;
  personas: AdvisorPersona[];
  addPersona: (persona: AdvisorPersona) => void;
  bots: UserBot[];
  botsReady: boolean;
  botCap: number;
  canCreateBot: boolean;
  disabledBotIds: Set<string>;
  isBotDisabled: (botId: string) => boolean;
  createBot: (input: {
    name: string;
    instruction: string;
    provider: ModelProvider;
    model: string;
  }) => Promise<UserBot | null>;
  updateBot: (
    id: string,
    input: { name: string; instruction: string; provider: ModelProvider; model: string }
  ) => Promise<UserBot | null>;
  deleteBot: (id: string) => Promise<void>;
  openBotChat: (botId: string, conversationId?: string) => void;
  openFirstBotOrWizard: (excludeBotId?: string) => void;
  createSoloThread: (botId: string, title?: string) => Promise<void>;
  conversations: SavedConversation[];
  createGroupChat: (
    roster: AdvisorPersona[],
    mode: ChatMode,
    title?: string
  ) => Promise<SavedConversation | null>;
  openGroupChat: (conversationId: string) => void;
  updateGroupChat: (
    id: string,
    patch: { title?: string; mode?: ChatMode; roster?: string[] }
  ) => Promise<boolean>;
  renameConversation: (id: string, title: string) => Promise<void>;
  deleteConversationById: (id: string) => Promise<void>;
  editingGroupId: string | null;
  openEditGroup: (id: string) => void;
  closeEditGroup: () => void;
  apiKeys: ApiKeyConfig[];
  connectApiKey: (
    provider: ModelProvider,
    key: string,
    model: string,
    meta?: ConnectProviderMeta
  ) => Promise<ConnectApiKeyResult>;
  updateProviderModels: (
    provider: ModelProvider,
    model: string,
    models: string[]
  ) => Promise<boolean>;
  getProviderSecret: (provider: ModelProvider) => string | undefined;
  removeApiKey: (provider: ModelProvider) => Promise<void>;
  revokeAllKeys: () => Promise<void>;
  contentPanel: ContentPanelPayload | null;
  openContentPanel: (payload: ContentPanelPayload) => void;
  closeContentPanel: () => void;
  currentPlanId: PlanId;
  planExpiresAt: string | null;
  authUser: { id: string; email: string } | null;
  isAdmin: boolean;
  isFounder: boolean;
  authReady: boolean;
  signOut: () => Promise<void>;
  checkoutPlan: Plan | null;
  consent: AnalyticsConsent | null;
  closeCheckout: () => void;
  requestCheckout: (plan: Plan) => void;
  refreshPlan: () => Promise<void>;
  cancelPlanToFree: () => Promise<boolean>;
  downgradeToPro: () => Promise<boolean>;
  goToPricing: () => void;
  isJoinRoomOpen: boolean;
  openJoinRoom: () => void;
  closeJoinRoom: () => void;
  joinRoom: (roster: AdvisorPersona[], mode: ChatMode, title?: string) => void;
  startCouncilChat: (question: string, advisors?: AdvisorPersona[], mode?: ChatMode) => void;
  wrapUpRoom: () => void;
  openRoomConclusion: () => void;
  conclusionError: { reason: TurnFailureReason; message: string } | null;
  clearConclusionError: () => void;
  currentRoom: ChatRoom | null;
  roomRosterPartition: { activeIds: string[]; disabledIds: string[] };
  sendMessage: (body: string) => Promise<void>;
  retryLastTurn: () => Promise<void>;
  stopRoom: () => void;
  clearRoom: () => void;
  isRoomBusy: boolean;
  attachLink: (url: string) => Promise<void>;
  attachFiles: (files: File[]) => Promise<void>;
  removePending: (id: string) => void;
  isReadingLink: boolean;
  isReadingFile: boolean;
  webSearchEnabled: boolean;
  setWebSearchEnabled: (enabled: boolean) => void;
  isSearchingWeb: boolean;
  canAddPersona: boolean;
  personaCap: number;
  toastMessage: ToastMessage | null;
  showToast: (key: ToastKey, values?: ToastValues) => void;
}
