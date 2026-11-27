/**
 * BYOK provider management workspace view (8 built-in locked providers + custom OpenAI/Anthropic endpoints).
 */

import React from 'react';
import { Bot, Plus, RotateCcw } from 'lucide-react';
import { slugifyCustomProvider } from '@/lib/store/botValidation';
import { normalizeBaseUrl } from '../chat/byok';
import { Modal } from './Modal';
import { CustomProviderModal } from './api-keys/CustomProviderModal';
import { ProviderCard } from './api-keys/ProviderCard';
import { ProviderManageModal } from './api-keys/ProviderManageModal';
import { useApiKeysController } from './api-keys/useApiKeysController';

export const ApiKeysView: React.FC = () => {
  const c = useApiKeysController();

  return (
    <div className="content-shell w-full min-w-0 max-w-full space-y-7">
      <header className="page-header flex w-full min-w-0 flex-col items-start gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="page-header w-full min-w-0 sm:flex-1">
          <h2 className="break-words text-3xl">{c.t.providersTitle}</h2>
          <p className="break-words">{c.t.providersBody}</p>
        </div>

        <div className="flex w-full min-w-0 flex-col gap-2.5 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
          <button
            type="button"
            id="add-custom-provider-btn"
            onClick={c.openCustomModal}
            className="button-primary min-h-11 w-full min-w-0 justify-center sm:w-auto"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            {c.t.providerAddCustom}
          </button>

          <button
            type="button"
            onClick={() => c.setIsClearOpen(true)}
            className="button-secondary min-h-11 w-full min-w-0 justify-center sm:w-auto"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            {c.t.clearStates}
          </button>
        </div>
      </header>

      {c.hasConnectedKey && c.bots.length === 0 && (
        <div
          id="apikeys-create-first-bot-banner"
          role="status"
          className="flex flex-col items-start justify-between gap-3 rounded-2xl border border-sage/40 bg-sage/10 p-4 sm:flex-row sm:items-center sm:p-5"
        >
          <div className="flex items-start gap-3">
            <Bot className="mt-0.5 h-5 w-5 shrink-0 text-sage" aria-hidden="true" />
            <p className="text-sm font-medium leading-relaxed text-ink">
              {c.t.apiKeyConnectedCreateBotHint}
            </p>
          </div>
          <button
            type="button"
            id="apikeys-create-first-bot-btn"
            onClick={() => c.setCurrentView('bot-wizard')}
            className="button-primary min-h-10 w-full shrink-0 justify-center sm:w-auto"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            {c.t.apiKeyCreateFirstBotCta}
          </button>
        </div>
      )}

      <div className="min-w-0 flex-1">
        <h2 className="font-medium text-ink">{c.t.noCredentialTitle}</h2>
        <p className="mt-1 break-words text-sm leading-relaxed text-ink-muted">
          {c.t.noCredentialBody}
        </p>
      </div>

      <div className="grid w-full min-w-0 grid-cols-1 gap-4 md:grid-cols-2">
        {c.apiKeys.map((item) => (
          <ProviderCard key={item.provider} item={item} onOpen={c.openProvider} />
        ))}
      </div>

      <ProviderManageModal
        activeProvider={c.activeProvider}
        activeItem={c.activeItem}
        activeEndpointUrl={c.activeEndpointUrl}
        activeSecret={c.activeSecret}
        draftKey={c.draftKey}
        test={c.test}
        tested={c.tested}
        busy={c.busy}
        retest={c.retest}
        customModelInput={c.customModelInput}
        customModelState={c.customModelState}
        onClose={c.closeModal}
        onDraftKeyChange={c.updateDraftKey}
        onTestConnection={() => void c.testConnection()}
        onBackFromTest={() => c.setTest({ phase: 'idle' })}
        onSaveConnection={() => void c.saveConnection()}
        onSelectTestedModel={(model) =>
          c.setTest((current) =>
            current.phase === 'tested' ? { ...current, selected: model } : current
          )
        }
        onRetestConnection={() => void c.retestConnection()}
        onDisconnect={() => void c.disconnect()}
        onChangeConnectedModel={(model) => void c.changeConnectedDefaultModel(model)}
        onCustomModelInputChange={(next) => {
          c.setCustomModelInput(next);
          if (c.customModelState.phase !== 'idle') c.setCustomModelState({ phase: 'idle' });
        }}
        onTestConnectedCustomModel={() =>
          c.activeItem &&
          void c.runCustomModelTest({
            provider: c.activeItem.provider,
            apiKey: c.activeSecret,
            protocol: c.builtin?.protocol ?? c.activeItem.protocol,
            baseUrl: c.activeEndpointUrl,
            useStoredKey: !c.activeSecret && Boolean(c.activeItem.hasKey),
          })
        }
        onSaveConnectedCustomModel={() => void c.saveCustomModelToConnectedProvider()}
        onTestConnectDraftCustomModel={() =>
          c.activeProvider &&
          void c.runCustomModelTest({
            provider: c.activeProvider,
            apiKey: c.draftKey,
            protocol: c.builtin?.protocol ?? c.activeItem?.protocol,
            baseUrl: c.activeEndpointUrl,
          })
        }
        onSaveConnectDraftCustomModel={() => c.saveCustomModelToConnectDraft(false)}
      />

      <CustomProviderModal
        isOpen={c.isCustomOpen}
        customStandard={c.customStandard}
        customName={c.customName}
        customBaseUrl={c.customBaseUrl}
        customKey={c.customKey}
        customTest={c.customTest}
        customTested={c.customTested}
        customBusy={c.customBusy}
        customModelInput={c.customModelInput}
        customModelState={c.customModelState}
        onClose={c.closeCustomModal}
        onChangeStandard={(next) => {
          c.setCustomStandard(next);
          c.invalidateCustomTest();
        }}
        onChangeName={(next) => {
          c.setCustomName(next);
          c.setCustomTest({ phase: 'idle' });
        }}
        onChangeBaseUrl={(next) => {
          c.setCustomBaseUrl(next);
          c.invalidateCustomTest();
        }}
        onChangeKey={(next) => {
          c.setCustomKey(next);
          c.invalidateCustomTest();
        }}
        onTest={() => void c.testCustomConnection()}
        onBackFromTest={() => c.setCustomTest({ phase: 'idle' })}
        onSave={() => void c.saveCustomConnection()}
        onSelectModel={(model) =>
          c.setCustomTest((current) =>
            current.phase === 'tested' ? { ...current, selected: model } : current
          )
        }
        onCustomModelInputChange={(next) => {
          c.setCustomModelInput(next);
          if (c.customModelState.phase !== 'idle') c.setCustomModelState({ phase: 'idle' });
        }}
        onTestCustomModel={() => {
          const providerId = slugifyCustomProvider(
            c.customStandard,
            c.customName.trim() || 'gateway'
          );
          void c.runCustomModelTest({
            provider: providerId,
            apiKey: c.customKey,
            protocol: c.customStandard,
            baseUrl: normalizeBaseUrl(c.customBaseUrl),
          });
        }}
        onSaveCustomModel={() => c.saveCustomModelToConnectDraft(true)}
      />

      <Modal
        isOpen={c.isClearOpen}
        onClose={() => c.setIsClearOpen(false)}
        title={c.t.clearStates}
        description={c.t.clearStatesConfirm}
        closeLabel={c.t.close}
        footer={
          <>
            <button
              type="button"
              onClick={() => c.setIsClearOpen(false)}
              className="button-secondary min-h-11 justify-center"
            >
              {c.t.cancel}
            </button>
            <button
              type="button"
              onClick={() => {
                c.setIsClearOpen(false);
                void c.revokeAllKeys();
              }}
              className="button-danger min-h-11 justify-center"
            >
              {c.t.clearStates}
            </button>
          </>
        }
      />
    </div>
  );
};
