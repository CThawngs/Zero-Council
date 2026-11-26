/**
 * Stateful controller hook for ApiKeysView (connection tests, model verification, and provider persistence).
 */

import { useRef, useState } from 'react';
import { slugifyCustomProvider } from '@/lib/store/botValidation';
import { sanitizeApiKey } from '@/lib/byok/verify';
import { useApp } from '../../context/AppContext';
import type { ModelProvider } from '../../types';
import {
  builtinProviderById,
  normalizeBaseUrl,
  resolveProviderEndpoint,
  verifyProviderConnection,
  type ProviderProtocol,
} from '../../chat/byok';
import {
  savedOrError,
  targetFingerprint,
  testMatchesInput,
  type CustomModelState,
  type RetestState,
  type TestState,
  type TestedConnection,
} from './helpers';

export const useApiKeysController = () => {
  const {
    apiKeys,
    bots,
    connectApiKey,
    updateProviderModels,
    getProviderSecret,
    removeApiKey,
    revokeAllKeys,
    setCurrentView,
    t,
  } = useApp();

  const [retest, setRetest] = useState<RetestState>({ phase: 'idle' });
  const [activeProvider, setActiveProvider] = useState<ModelProvider | null>(null);
  const [isCustomOpen, setIsCustomOpen] = useState(false);
  const [isClearOpen, setIsClearOpen] = useState(false);

  const [draftKey, setDraftKey] = useState('');
  const [test, setTest] = useState<TestState>({ phase: 'idle' });

  const [customStandard, setCustomStandard] = useState<'openai' | 'anthropic'>('openai');
  const [customName, setCustomName] = useState('');
  const [customBaseUrl, setCustomBaseUrl] = useState('');
  const [customKey, setCustomKey] = useState('');
  const [customTest, setCustomTest] = useState<TestState>({ phase: 'idle' });

  const [customModelInput, setCustomModelInput] = useState('');
  const [customModelState, setCustomModelState] = useState<CustomModelState>({ phase: 'idle' });

  const builtinTestRun = useRef(0);
  const customTestRun = useRef(0);
  const customModelTestRun = useRef(0);

  const activeItem = activeProvider
    ? apiKeys.find((key) => key.provider === activeProvider)
    : undefined;
  const builtin = activeProvider ? builtinProviderById(activeProvider) : undefined;

  const resetCustomModelBox = () => {
    customModelTestRun.current += 1;
    setCustomModelInput('');
    setCustomModelState({ phase: 'idle' });
  };

  const invalidateCustomTest = () => {
    customTestRun.current += 1;
    customModelTestRun.current += 1;
    setCustomTest({ phase: 'idle' });
    setCustomModelState((current) => (current.phase === 'idle' ? current : { phase: 'idle' }));
  };

  const openProvider = (next: ModelProvider) => {
    builtinTestRun.current += 1;
    setActiveProvider(next);
    setDraftKey('');
    setTest({ phase: 'idle' });
    setRetest({ phase: 'idle' });
    resetCustomModelBox();
  };

  const closeModal = () => {
    builtinTestRun.current += 1;
    setActiveProvider(null);
    setDraftKey('');
    setTest({ phase: 'idle' });
    setRetest({ phase: 'idle' });
    resetCustomModelBox();
  };

  const openCustomModal = () => {
    customTestRun.current += 1;
    setIsCustomOpen(true);
    setCustomStandard('openai');
    setCustomName('');
    setCustomBaseUrl('');
    setCustomKey('');
    setCustomTest({ phase: 'idle' });
    resetCustomModelBox();
  };

  const closeCustomModal = () => {
    customTestRun.current += 1;
    setIsCustomOpen(false);
    setCustomTest({ phase: 'idle' });
    resetCustomModelBox();
  };

  const activeProtocol = (builtin?.protocol ?? activeItem?.protocol) as
    | ProviderProtocol
    | undefined;
  const activeEndpointUrl = activeProvider
    ? builtin?.baseUrl ?? activeItem?.baseUrl ?? ''
    : '';
  const builtinTarget = targetFingerprint(activeProtocol, activeEndpointUrl);
  const customTarget = targetFingerprint(customStandard, customBaseUrl);

  const testConnection = async () => {
    if (!activeProvider || test.phase === 'testing' || test.phase === 'saving') return;
    const key = sanitizeApiKey(draftKey);
    if (!key) {
      setTest({ phase: 'error', message: 'EMPTY_KEY' });
      return;
    }
    const runId = ++builtinTestRun.current;
    const testedTarget = builtinTarget;
    setTest({ phase: 'testing' });
    try {
      const endpoint = resolveProviderEndpoint({
        provider: activeProvider,
        protocol: activeProtocol,
        baseUrl: activeEndpointUrl,
      });
      const result = await verifyProviderConnection(endpoint, key);
      if (runId !== builtinTestRun.current) return;
      setTest({
        phase: 'tested',
        models: result.models,
        selected: result.verifiedModel,
        testedKey: key,
        testedTarget,
        saveBaseUrl: result.resolvedBaseUrl ?? endpoint.baseUrl,
        ...(result.warning ? { warning: result.warning } : {}),
      });
    } catch (error) {
      if (runId !== builtinTestRun.current) return;
      setTest({ phase: 'error', message: (error as Error).message });
    }
  };

  const saveConnection = async () => {
    if (!activeProvider || test.phase !== 'tested') return;
    if (!testMatchesInput(test, draftKey, builtinTarget)) return;
    const passed: TestedConnection = { ...test, saveError: undefined };
    setTest({ ...passed, phase: 'saving' });
    const result = await connectApiKey(activeProvider, passed.testedKey, passed.selected, {
      models: passed.models,
      label: activeItem?.label ?? builtin?.label,
      protocol: activeProtocol,
      baseUrl: builtin?.baseUrl ?? passed.saveBaseUrl,
      isCustom: Boolean(activeItem?.isCustom && !builtin),
    });
    if (!result.ok) {
      setTest(savedOrError(passed, result.error));
      return;
    }
    closeModal();
  };

  const testCustomConnection = async () => {
    if (customTest.phase === 'testing' || customTest.phase === 'saving') return;
    const trimmedName = customName.trim();
    const normalizedUrl = normalizeBaseUrl(customBaseUrl);
    const key = sanitizeApiKey(customKey);
    if (!trimmedName) {
      setCustomTest({ phase: 'error', message: 'INVALID_NAME' });
      return;
    }
    if (!/^https?:\/\/[^\s/]+/i.test(normalizedUrl)) {
      setCustomTest({ phase: 'error', message: 'BAD_URL_FORMAT' });
      return;
    }
    if (!key) {
      setCustomTest({ phase: 'error', message: 'EMPTY_KEY' });
      return;
    }
    const providerId = slugifyCustomProvider(customStandard, trimmedName);
    const runId = ++customTestRun.current;
    const testedTarget = customTarget;
    setCustomTest({ phase: 'testing' });
    try {
      const typedModel = customModelInput.trim();
      const result = await verifyProviderConnection(
        { provider: providerId, protocol: customStandard, baseUrl: normalizedUrl },
        key,
        typedModel ? { model: typedModel } : {}
      );
      if (runId !== customTestRun.current) return;
      setCustomTest({
        phase: 'tested',
        models: result.models,
        selected: result.verifiedModel,
        testedKey: key,
        testedTarget,
        saveBaseUrl: result.resolvedBaseUrl ?? normalizedUrl,
        ...(result.warning ? { warning: result.warning } : {}),
      });
    } catch (error) {
      if (runId !== customTestRun.current) return;
      setCustomTest({ phase: 'error', message: (error as Error).message });
    }
  };

  const saveCustomConnection = async () => {
    if (customTest.phase !== 'tested') return;
    if (!testMatchesInput(customTest, customKey, customTarget)) return;
    const trimmedName = customName.trim();
    if (!trimmedName) {
      setCustomTest({ phase: 'error', message: 'INVALID_NAME' });
      return;
    }
    const providerId = slugifyCustomProvider(customStandard, trimmedName);
    const passed: TestedConnection = { ...customTest, saveError: undefined };
    setCustomTest({ ...passed, phase: 'saving' });
    const result = await connectApiKey(providerId, passed.testedKey, passed.selected, {
      models: passed.models,
      label: trimmedName,
      protocol: customStandard,
      baseUrl: passed.saveBaseUrl,
      isCustom: true,
    });
    if (!result.ok) {
      setCustomTest(savedOrError(passed, result.error));
      return;
    }
    closeCustomModal();
  };

  const retestConnection = async () => {
    if (!activeProvider || retest.phase === 'testing') return;
    setRetest({ phase: 'testing' });
    try {
      const response = await fetch('/api/providers/test', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerId: activeProvider }),
      });
      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        error?: unknown;
        verifiedModel?: unknown;
      } | null;
      if (payload?.ok === true && typeof payload.verifiedModel === 'string') {
        setRetest({ phase: 'ok', model: payload.verifiedModel });
        return;
      }
      setRetest({
        phase: 'error',
        message: typeof payload?.error === 'string' ? payload.error : 'PROVIDER_ERROR',
      });
    } catch {
      setRetest({ phase: 'error', message: 'NETWORK_FAILED' });
    }
  };

  const disconnect = async () => {
    if (!activeProvider) return;
    await removeApiKey(activeProvider);
    closeModal();
  };

  const runCustomModelTest = async (context: {
    provider: ModelProvider;
    apiKey: string;
    protocol?: ProviderProtocol;
    baseUrl?: string;
    useStoredKey?: boolean;
  }) => {
    const candidate = customModelInput.trim();
    if (!candidate || customModelState.phase === 'testing' || customModelState.phase === 'saving') {
      return;
    }
    const runId = ++customModelTestRun.current;
    setCustomModelState({ phase: 'testing' });
    try {
      if (context.useStoredKey) {
        const response = await fetch('/api/providers/test', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ providerId: context.provider, model: candidate }),
        });
        const payload = (await response.json().catch(() => null)) as {
          ok?: boolean;
          error?: unknown;
          resolvedBaseUrl?: unknown;
        } | null;
        if (runId !== customModelTestRun.current) return;
        if (payload?.ok !== true) {
          setCustomModelState({
            phase: 'error',
            message: typeof payload?.error === 'string' ? payload.error : 'PROVIDER_ERROR',
          });
          return;
        }
        setCustomModelState({
          phase: 'verified',
          modelId: candidate,
          testedKey: '',
          testedTarget: targetFingerprint(context.protocol, context.baseUrl),
          saveBaseUrl:
            typeof payload.resolvedBaseUrl === 'string'
              ? payload.resolvedBaseUrl
              : normalizeBaseUrl(context.baseUrl ?? ''),
        });
        return;
      }
      const key = sanitizeApiKey(context.apiKey);
      const result = await verifyProviderConnection(
        { provider: context.provider, protocol: context.protocol, baseUrl: context.baseUrl },
        key,
        { model: candidate }
      );
      if (runId !== customModelTestRun.current) return;
      setCustomModelState({
        phase: 'verified',
        modelId: candidate,
        testedKey: key,
        testedTarget: targetFingerprint(context.protocol, context.baseUrl),
        saveBaseUrl: result.resolvedBaseUrl ?? normalizeBaseUrl(context.baseUrl ?? ''),
      });
    } catch (error) {
      if (runId !== customModelTestRun.current) return;
      setCustomModelState({ phase: 'error', message: (error as Error).message });
    }
  };

  const saveCustomModelToConnectDraft = (isCustomProviderModal: boolean) => {
    if (customModelState.phase !== 'verified') return;
    const verified = customModelState;
    const currentKey = isCustomProviderModal ? customKey : draftKey;
    const currentTarget = isCustomProviderModal ? customTarget : builtinTarget;
    if (verified.testedKey !== sanitizeApiKey(currentKey) || verified.testedTarget !== currentTarget) {
      setCustomModelState({ phase: 'idle' });
      return;
    }
    const merge = (prev: TestState): TestState => {
      const previousModels = prev.phase === 'tested' ? prev.models : [];
      return {
        phase: 'tested',
        models: Array.from(new Set([verified.modelId, ...previousModels])),
        selected: verified.modelId,
        testedKey: verified.testedKey,
        testedTarget: verified.testedTarget,
        saveBaseUrl: prev.phase === 'tested' ? prev.saveBaseUrl : verified.saveBaseUrl,
      };
    };
    if (isCustomProviderModal) {
      setCustomTest(merge);
    } else {
      setTest(merge);
    }
    resetCustomModelBox();
  };

  const saveCustomModelToConnectedProvider = async () => {
    if (!activeProvider || !activeItem || customModelState.phase !== 'verified') return;
    const verifiedModel = customModelState.modelId;
    setCustomModelState({ phase: 'saving', modelId: verifiedModel });
    const existing =
      activeItem.models && activeItem.models.length > 0
        ? activeItem.models
        : [activeItem.modelName].filter(Boolean);
    const merged = Array.from(new Set([verifiedModel, ...existing]));
    const ok = await updateProviderModels(activeProvider, verifiedModel, merged);
    if (!ok) {
      setCustomModelState({ phase: 'error', message: 'SAVE_FAILED' });
      return;
    }
    resetCustomModelBox();
  };

  const changeConnectedDefaultModel = async (nextModel: string) => {
    if (!activeProvider || !activeItem || !nextModel) return;
    const existing =
      activeItem.models && activeItem.models.length > 0
        ? activeItem.models
        : [activeItem.modelName].filter(Boolean);
    const merged = Array.from(new Set([nextModel, ...existing]));
    await updateProviderModels(activeProvider, nextModel, merged);
  };

  const updateDraftKey = (next: string, resetTest: boolean) => {
    if (resetTest) {
      builtinTestRun.current += 1;
      setDraftKey(next);
      setTest({ phase: 'idle' });
      setCustomModelState((current) => (current.phase === 'idle' ? current : { phase: 'idle' }));
    } else {
      setDraftKey(next);
    }
  };

  const tested = testMatchesInput(test, draftKey, builtinTarget);
  const busy = test.phase === 'testing' || test.phase === 'saving';
  const customTested = testMatchesInput(customTest, customKey, customTarget);
  const customBusy = customTest.phase === 'testing' || customTest.phase === 'saving';
  const activeSecret =
    (activeProvider ? getProviderSecret(activeProvider) : undefined) || draftKey.trim();
  const hasConnectedKey = apiKeys.some((k) => k.connected);

  return {
    apiKeys,
    bots,
    t,
    setCurrentView,
    revokeAllKeys,
    retest,
    activeProvider,
    activeItem,
    builtin,
    activeEndpointUrl,
    activeSecret,
    isCustomOpen,
    isClearOpen,
    setIsClearOpen,
    draftKey,
    test,
    setTest,
    tested,
    busy,
    customStandard,
    setCustomStandard,
    customName,
    setCustomName,
    customBaseUrl,
    setCustomBaseUrl,
    customKey,
    setCustomKey,
    customTest,
    setCustomTest,
    customTested,
    customBusy,
    customModelInput,
    setCustomModelInput,
    customModelState,
    setCustomModelState,
    hasConnectedKey,
    openProvider,
    closeModal,
    openCustomModal,
    closeCustomModal,
    invalidateCustomTest,
    updateDraftKey,
    testConnection,
    saveConnection,
    testCustomConnection,
    saveCustomConnection,
    retestConnection,
    disconnect,
    runCustomModelTest,
    saveCustomModelToConnectDraft,
    saveCustomModelToConnectedProvider,
    changeConnectedDefaultModel,
  };
};
