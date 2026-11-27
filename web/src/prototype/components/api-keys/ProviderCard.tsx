/**
 * Individual BYOK provider card displayed in the ApiKeysView grid.
 */

import React from 'react';
import { Check, Lock, Settings2, ShieldCheck, Sparkles } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { providerLabel } from '../../data/catalog';
import { builtinProviderById } from '../../chat/byok';
import { visibleModelsForProvider } from '../../chat/modelAllowList';
import type { ApiKeyConfig, ModelProvider } from '../../types';

interface ProviderCardProps {
  item: ApiKeyConfig;
  onOpen: (provider: ModelProvider) => void;
}

export const ProviderCard: React.FC<ProviderCardProps> = ({ item, onOpen }) => {
  const { t } = useApp();
  const itemBuiltin = builtinProviderById(item.provider);
  const displayLabel = item.label || providerLabel(item.provider);
  const displayBaseUrl = itemBuiltin?.baseUrl ?? item.baseUrl ?? '';
  const modelCount = visibleModelsForProvider(
    item.provider,
    item.models,
    item.connected ? item.modelName : undefined
  ).length;

  return (
    <article
      data-provider-card={item.provider}
      className="panel flex w-full min-w-0 max-w-full flex-col justify-between gap-4 p-5"
    >
      <div className="min-w-0 space-y-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="min-w-0 break-words font-serif text-lg text-ink">{displayLabel}</h2>
          {itemBuiltin ? (
            <span className="badge-neutral inline-flex max-w-full items-center gap-1 whitespace-normal break-words">
              <ShieldCheck className="h-3 w-3 text-brass" aria-hidden="true" />
              {t.providerVerifiedBadge}
            </span>
          ) : (
            <span className="badge-neutral inline-flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-brass" aria-hidden="true" />
              {t.providerCustomBadge}
            </span>
          )}
        </div>

        {displayBaseUrl && (
          <p className="flex items-center gap-1.5 truncate font-mono text-xs text-ink-muted">
            {itemBuiltin && <Lock className="h-3 w-3 shrink-0 text-brass" aria-hidden="true" />}
            <span className="truncate">{displayBaseUrl}</span>
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
          <span className="badge-neutral">{item.connected ? item.modelName : t.stateOff}</span>
          {item.connected && modelCount > 0 && (
            <span>{t.providerModelsCount.replace('{count}', String(modelCount))}</span>
          )}
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          id={`provider-connect-${item.provider}`}
          data-provider-connect={item.provider}
          onClick={() => onOpen(item.provider)}
          className={
            item.connected
              ? 'button-secondary min-h-11 w-full justify-center sm:w-auto'
              : 'button-primary min-h-11 w-full justify-center sm:w-auto'
          }
          aria-label={`${item.connected ? t.providerManage : t.toggleState}: ${displayLabel}`}
        >
          {item.connected ? (
            <>
              <Settings2 className="h-4 w-4" aria-hidden="true" />
              {t.providerManage}
            </>
          ) : (
            <>
              <Check className="h-4 w-4" aria-hidden="true" />
              {t.toggleState}
            </>
          )}
        </button>
      </div>
    </article>
  );
};
