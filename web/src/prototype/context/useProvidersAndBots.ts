/**
 * Domain hook managing encrypted BYOK provider metadata (`apiKeys`), user-created AI bots (`bots`),
 * plan-based bot locks, and the combined advisor persona catalog (`personas`).
 *
 * Security invariant: Browser state NEVER hydrates or retains plaintext provider keys once saved
 * server-side (`/api/providers` returns only `hasKey: true` and `maskedKey`).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  AdvisorPersona,
  ApiKeyConfig,
  Language,
  ModelProvider,
  UserBot,
  ViewType,
} from '../types';
import { INITIAL_PROVIDERS, localizePersona } from '../data/catalog';
import { sanitizeApiKey } from '@/lib/byok/verify';
import type { PlanId } from '../data/plans';
import { disabledBotIdsForPlan } from '@/lib/store/planLimits';
import { botToPersona } from './helpers';
import type {
  ConnectApiKeyResult,
  ConnectProviderMeta,
  ToastKey,
  ToastValues,
} from './types';

export function useProvidersAndBots({
  authUser,
  language,
  currentPlanId,
  personaCap,
  setCurrentView,
  showToast,
}: {
  authUser: { id: string; email: string } | null;
  language: Language;
  currentPlanId: PlanId;
  personaCap: number;
  setCurrentView: (view: ViewType) => void;
  showToast: (key: ToastKey, values?: ToastValues) => void;
}) {
  const [personas, setPersonas] = useState<AdvisorPersona[]>([]);
  const [bots, setBots] = useState<UserBot[]>([]);
  const [botsReady, setBotsReady] = useState(false);
  const [apiKeys, setApiKeys] = useState<ApiKeyConfig[]>(INITIAL_PROVIDERS);
  const [keys, setKeys] = useState<Record<string, string>>({});

  const disabledBotIds = useMemo(
    () => disabledBotIdsForPlan(bots, currentPlanId),
    [bots, currentPlanId]
  );

  const isBotDisabled = useCallback(
    (botId: string) => disabledBotIds.has(botId),
    [disabledBotIds]
  );

  const localizedPersonas = useMemo(
    () => personas.map((persona) => localizePersona(persona, language)),
    [language, personas]
  );

  // Restore connected providers (all 8 built-ins + any custom OpenAI/Anthropic endpoints).
  useEffect(() => {
    if (!authUser) return;
    let cancelled = false;
    void fetch('/api/providers', { credentials: 'same-origin' })
      .then((response) => (response.ok ? response.json() : null))
      .then(
        (
          body: {
            providers?: {
              provider: string;
              model: string;
              models?: string[];
              label?: string;
              protocol?: 'anthropic' | 'openai' | 'google';
              baseUrl?: string;
              hasKey?: boolean;
              maskedKey?: string;
            }[];
          } | null
        ) => {
          if (cancelled || !body?.providers) return;
          const saved = new Map(body.providers.map((entry) => [entry.provider, entry]));
          setKeys({});
          setApiKeys(() => {
            const builtinUpdated = INITIAL_PROVIDERS.map((item) => {
              const entry = saved.get(item.provider);
              if (!entry) return item;
              return {
                ...item,
                connected: true,
                hasKey: entry.hasKey ?? true,
                ...(entry.maskedKey ? { maskedKey: entry.maskedKey } : {}),
                modelName: entry.model,
                models:
                  entry.models && entry.models.length > 0
                    ? entry.models
                    : [entry.model, ...(item.models ?? [])],
              };
            });
            const builtinIds = new Set(INITIAL_PROVIDERS.map((item) => item.provider));
            const customEntries: ApiKeyConfig[] = body.providers!
              .filter((entry) => !builtinIds.has(entry.provider))
              .map((entry) => ({
                provider: entry.provider,
                modelName: entry.model,
                models: entry.models && entry.models.length > 0 ? entry.models : [entry.model],
                connected: true,
                hasKey: entry.hasKey ?? true,
                ...(entry.maskedKey ? { maskedKey: entry.maskedKey } : {}),
                label: entry.label ?? entry.provider,
                protocol:
                  entry.protocol ??
                  (entry.provider.startsWith('custom:anthropic:') ? 'anthropic' : 'openai'),
                baseUrl: entry.baseUrl ?? '',
                isCustom: true,
              }));
            return [...builtinUpdated, ...customEntries];
          });
        }
      )
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [authUser]);

  // Load account bots on sign-in.
  useEffect(() => {
    if (!authUser) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset readiness when account changes
    setBotsReady(false);
    void fetch('/api/bots', { credentials: 'same-origin' })
      .then((response) => (response.ok ? response.json() : null))
      .then((body: { bots?: UserBot[] } | null) => {
        if (cancelled) return;
        setBots(body?.bots ?? []);
        setBotsReady(true);
      })
      .catch(() => {
        if (!cancelled) setBotsReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [authUser]);

  // Mirror server bots into the unified personas roster.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- synchronize personas list with bots
    setPersonas((value) => [
      ...value.filter((persona) => !persona.id.startsWith('bot:')),
      ...bots.map((bot, idx) => botToPersona(bot, idx)),
    ]);
  }, [bots]);

  const addPersona = (persona: AdvisorPersona) => {
    const presetCount = personas.filter((p) => !p.id.startsWith('bot:')).length;
    if (presetCount >= personaCap) {
      showToast('toastPersonaCap', { cap: String(personaCap) });
      return;
    }
    setPersonas((value) => [persona, ...value]);
    showToast('toastPersona', { name: persona.archetype });
    setCurrentView('personas');
  };

  const createBot = async (input: {
    name: string;
    instruction: string;
    provider: ModelProvider;
    model: string;
  }): Promise<UserBot | null> => {
    try {
      const response = await fetch('/api/bots', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!response.ok) return null;
      const body = (await response.json()) as { bot: UserBot };
      setBots((value) => [...value, body.bot]);
      return body.bot;
    } catch {
      return null;
    }
  };

  const updateBot = async (
    id: string,
    input: { name: string; instruction: string; provider: ModelProvider; model: string }
  ): Promise<UserBot | null> => {
    try {
      const response = await fetch('/api/bots', {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...input }),
      });
      if (!response.ok) return null;
      const body = (await response.json()) as { bot: UserBot };
      setBots((value) => value.map((bot) => (bot.id === id ? body.bot : bot)));
      return body.bot;
    } catch {
      return null;
    }
  };

  const removeBotRecord = async (id: string) => {
    await fetch(`/api/bots?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
      credentials: 'same-origin',
    }).catch(() => undefined);
    setBots((value) => value.filter((bot) => bot.id !== id));
  };

  const connectApiKey = async (
    provider: ModelProvider,
    rawKey: string,
    model: string,
    meta: ConnectProviderMeta = {}
  ): Promise<ConnectApiKeyResult> => {
    const cleanSecret = sanitizeApiKey(rawKey);
    const modelList =
      meta.models && meta.models.length > 0
        ? [...new Set([model, ...meta.models])]
        : [model];
    let savedBaseUrl = meta.baseUrl;
    let warning: string | undefined;
    let serverMaskedKey: string | undefined;
    try {
      const response = await fetch('/api/providers', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          model,
          models: modelList,
          key: cleanSecret,
          ...(meta.label ? { label: meta.label } : {}),
          ...(meta.baseUrl ? { baseUrl: meta.baseUrl } : {}),
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: unknown;
        warning?: unknown;
        provider?: { baseUrl?: unknown; maskedKey?: unknown };
      } | null;
      if (!response.ok) {
        return {
          ok: false,
          error: typeof payload?.error === 'string' ? payload.error : 'SAVE_FAILED',
        };
      }
      if (typeof payload?.provider?.baseUrl === 'string') savedBaseUrl = payload.provider.baseUrl;
      if (typeof payload?.warning === 'string') warning = payload.warning;
      if (typeof payload?.provider?.maskedKey === 'string') {
        serverMaskedKey = payload.provider.maskedKey;
      }
    } catch {
      return { ok: false, error: 'NETWORK_FAILED' };
    }
    const finalMeta = { ...meta, ...(savedBaseUrl ? { baseUrl: savedBaseUrl } : {}) };
    setKeys((value) => {
      if (!(provider in value)) return value;
      const next = { ...value };
      delete next[provider];
      return next;
    });
    setApiKeys((value) => {
      const exists = value.some((item) => item.provider === provider);
      if (exists) {
        return value.map((item) =>
          item.provider === provider
            ? {
                ...item,
                connected: true,
                hasKey: true,
                ...(serverMaskedKey ? { maskedKey: serverMaskedKey } : {}),
                modelName: model,
                models: modelList,
                ...(finalMeta.label ? { label: finalMeta.label } : {}),
                ...(finalMeta.baseUrl ? { baseUrl: finalMeta.baseUrl } : {}),
              }
            : item
        );
      }
      return [
        ...value,
        {
          provider,
          modelName: model,
          models: modelList,
          connected: true,
          hasKey: true,
          ...(serverMaskedKey ? { maskedKey: serverMaskedKey } : {}),
          label: finalMeta.label ?? provider,
          protocol: finalMeta.protocol ?? 'openai',
          baseUrl: finalMeta.baseUrl ?? '',
          isCustom: true,
        },
      ];
    });
    showToast('toastProviderOn', { provider: finalMeta.label ?? provider });
    return warning ? { ok: true, warning } : { ok: true };
  };

  const updateProviderModels = async (
    provider: ModelProvider,
    model: string,
    models: string[]
  ): Promise<boolean> => {
    const deduped = [...new Set([model, ...models])];
    try {
      const response = await fetch('/api/providers', {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, model, models: deduped }),
      });
      if (!response.ok) return false;
    } catch {
      return false;
    }
    setApiKeys((value) =>
      value.map((item) =>
        item.provider === provider ? { ...item, modelName: model, models: deduped } : item
      )
    );
    return true;
  };

  const getProviderSecret = (provider: ModelProvider): string | undefined => keys[provider];

  const removeApiKey = async (provider: ModelProvider) => {
    await fetch(`/api/providers?provider=${encodeURIComponent(provider)}`, {
      method: 'DELETE',
      credentials: 'same-origin',
    }).catch(() => undefined);
    setKeys((value) => {
      const next = { ...value };
      delete next[provider];
      return next;
    });
    setApiKeys((value) =>
      value
        .filter((item) => !(item.provider === provider && item.isCustom))
        .map((item) =>
          item.provider === provider
            ? { ...item, connected: false, hasKey: false, maskedKey: undefined }
            : item
        )
    );
    showToast('toastProviderOff', { provider });
  };

  const revokeAllKeys = async () => {
    await fetch('/api/providers', { method: 'DELETE', credentials: 'same-origin' }).catch(
      () => undefined
    );
    setKeys({});
    setApiKeys(
      INITIAL_PROVIDERS.map((item) => ({
        ...item,
        connected: false,
        hasKey: false,
        maskedKey: undefined,
      }))
    );
    showToast('toastProvidersCleared');
  };

  const presetPersonaCount = personas.filter((p) => !p.id.startsWith('bot:')).length;

  return {
    personas,
    localizedPersonas,
    presetPersonaCount,
    addPersona,
    bots,
    botsReady,
    disabledBotIds,
    isBotDisabled,
    createBot,
    updateBot,
    removeBotRecord,
    apiKeys,
    keys,
    connectApiKey,
    updateProviderModels,
    getProviderSecret,
    removeApiKey,
    revokeAllKeys,
  };
}
