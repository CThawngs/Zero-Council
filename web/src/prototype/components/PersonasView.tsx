import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Bot,
  Check,
  Loader2,
  Lock,
  MessageSquare,
  Pencil,
  PlusCircle,
  Trash2,
  Users,
} from 'lucide-react';
import { modelLabel, providerLabel } from '../data/mockData';
import { planById } from '../data/plans';
import type { ModelProvider, UserBot } from '../types';
import { Modal } from './Modal';

export const PersonasView: React.FC = () => {
  const {
    personas,
    bots,
    botCap,
    canCreateBot,
    isBotDisabled,
    updateBot,
    deleteBot,
    openBotChat,
    openJoinRoom,
    apiKeys,
    currentPlanId,
    goToPricing,
    setCurrentView,
    canAddPersona,
    personaCap,
    t,
  } = useApp();

  const [editingBot, setEditingBot] = useState<UserBot | null>(null);
  const [editName, setEditName] = useState('');
  const [editInstruction, setEditInstruction] = useState('');
  const [editProvider, setEditProvider] = useState<ModelProvider>('openai');
  const [editModel, setEditModel] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  // The bot the user wants to delete — set when confirm dialog opens.
  const [botToDelete, setBotToDelete] = useState<UserBot | null>(null);

  const connectedKeys = apiKeys.filter((k) => k.connected);
  const plan = planById(currentPlanId);
  const presetPersonas = personas.filter((p) => !p.id.startsWith('bot:'));

  const startEditBot = (bot: UserBot) => {
    setEditingBot(bot);
    setEditName(bot.name);
    setEditInstruction(bot.instruction);
    setEditProvider(bot.provider);
    setEditModel(bot.model);
    setEditError('');
  };

  const saveEditBot = async () => {
    if (!editingBot || editSaving) return;
    if (!editName.trim()) {
      setEditError(t.botErrorName);
      return;
    }
    if (!editInstruction.trim()) {
      setEditError(t.botErrorInstruction);
      return;
    }
    setEditSaving(true);
    const updated = await updateBot(editingBot.id, {
      name: editName.trim(),
      instruction: editInstruction.trim(),
      provider: editProvider,
      model: editModel,
    });
    setEditSaving(false);
    if (!updated) {
      setEditError(t.botErrorSave);
      return;
    }
    setEditingBot(null);
  };

  const confirmDeleteBot = (bot: UserBot) => {
    setBotToDelete(bot);
    setDeleteConfirmOpen(true);
  };

  const selectedEditProviderKey = connectedKeys.find((k) => k.provider === editProvider);
  const editProviderModels = selectedEditProviderKey
    ? selectedEditProviderKey.models && selectedEditProviderKey.models.length > 0
      ? Array.from(new Set([editModel, ...selectedEditProviderKey.models].filter(Boolean)))
      : [editModel || selectedEditProviderKey.modelName].filter(Boolean)
    : [editModel].filter(Boolean);

  return (
    <div className="content-shell space-y-8">
      <header className="page-header flex-col items-start gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">
            <span className="status-dot" />
            {t.personasEyebrow}
          </p>
          <h1>{t.personasTitle}</h1>
          <p>{t.personasBody}</p>
        </div>
        <div className="flex w-full flex-wrap gap-2.5 sm:w-auto">
          <button
            type="button"
            onClick={() => setCurrentView('bot-wizard')}
            disabled={!canCreateBot}
            title={
              !canCreateBot
                ? t.botCapReachedHint
                    .replace('{plan}', plan.name)
                    .replace('{cap}', String(botCap))
                : undefined
            }
            className="button-primary min-h-11 flex-1 justify-center disabled:cursor-not-allowed disabled:opacity-45 sm:flex-initial"
          >
            <PlusCircle className="h-4 w-4" aria-hidden="true" />
            {t.newBot}
          </button>
          <button
            type="button"
            onClick={openJoinRoom}
            className="button-secondary min-h-11 flex-1 justify-center sm:flex-initial"
          >
            <Users className="h-4 w-4" aria-hidden="true" />
            {t.newGroupChat}
          </button>
          <button
            type="button"
            onClick={() => setCurrentView('new-advisor')}
            disabled={!canAddPersona}
            title={
              !canAddPersona
                ? t.personaCapHint.replace('{cap}', String(personaCap))
                : undefined
            }
            className="button-secondary min-h-11 justify-center disabled:cursor-not-allowed disabled:opacity-45"
          >
            <PlusCircle className="h-4 w-4" aria-hidden="true" />
            {t.addPersona}
          </button>
        </div>
      </header>

      {/* User AI Bots CRUD Section */}
      <section className="space-y-4" aria-labelledby="user-bots-heading">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="user-bots-heading" className="font-serif text-2xl text-ink">
            {t.botsTitle} ({bots.length}/{botCap})
          </h2>
          {!canCreateBot && (
            <button type="button" onClick={goToPricing} className="button-quiet text-xs text-brass">
              {t.botCapReachedHint
                .replace('{plan}', plan.name)
                .replace('{cap}', String(botCap))}
            </button>
          )}
        </div>

        {bots.length === 0 ? (
          <div className="panel flex flex-col items-start justify-between gap-4 p-5 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <Bot className="h-5 w-5 shrink-0 text-brass" aria-hidden="true" />
              <p className="text-sm text-ink-muted">{t.botsEmpty}</p>
            </div>
            <button
              type="button"
              onClick={() => setCurrentView('bot-wizard')}
              className="button-primary min-h-10 shrink-0"
            >
              {t.newBot}
            </button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {bots.map((bot) => {
              const locked = isBotDisabled(bot.id);
              const providerItem = apiKeys.find((k) => k.provider === bot.provider);
              return (
                <article
                  key={bot.id}
                  data-bot-card={bot.id}
                  className={`panel flex flex-col justify-between gap-4 p-5 ${
                    locked ? 'border-border/60 opacity-75' : ''
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="truncate font-serif text-lg text-ink">{bot.name}</h3>
                        <p className="truncate text-xs text-ink-muted">
                          {(providerItem?.label || providerLabel(bot.provider))} ·{' '}
                          {modelLabel(bot.model)}
                        </p>
                      </div>
                      {locked ? (
                        <span className="badge-muted inline-flex shrink-0 items-center gap-1">
                          <Lock className="h-3 w-3 text-brass" aria-hidden="true" />
                          {t.botDisabledBadge}
                        </span>
                      ) : (
                        <span className="badge-success shrink-0">{t.soloBadge}</span>
                      )}
                    </div>
                    <p className="line-clamp-3 rounded-lg border border-border bg-background/60 p-3 text-xs leading-relaxed text-ink-muted">
                      {bot.instruction}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => openBotChat(bot.id)}
                      className="button-primary min-h-10 flex-1 justify-center text-xs"
                    >
                      <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
                      {t.soloBadge}
                    </button>
                    <button
                      type="button"
                      onClick={() => startEditBot(bot)}
                      aria-label={`${t.botEditTitle}: ${bot.name}`}
                      className="icon-button min-h-10 min-w-10"
                    >
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void confirmDeleteBot(bot)}
                      aria-label={`${t.deleteSession}: ${bot.name}`}
                      className="icon-button min-h-10 min-w-10 hover:bg-terracotta/10 hover:text-terracotta"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Preset Council Advisors Section */}
      <section className="space-y-4" aria-labelledby="preset-advisors-heading">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="preset-advisors-heading" className="font-serif text-2xl text-ink">
            {t.personasTitle}
          </h2>
          <p className="text-xs leading-relaxed text-ink-muted">
            {t.personaCapCount
              .replace('{used}', String(presetPersonas.length))
              .replace('{cap}', String(personaCap))}
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {presetPersonas.map((persona) => (
            <article key={persona.id} className="panel persona-card p-5 sm:p-6">
              <div className="flex min-w-0 flex-col items-start gap-3 sm:flex-row sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className="persona-dot"
                    style={{ backgroundColor: persona.colorHex }}
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <h3 className="break-words font-serif text-lg text-ink">{persona.name}</h3>
                    <p className="break-words text-xs text-brass">{persona.stance}</p>
                  </div>
                </div>
                <span className="badge-neutral min-w-0 max-w-full break-words">
                  {persona.archetype}
                </span>
              </div>
              <dl className="mt-5 space-y-4 text-sm">
                <div>
                  <dt className="field-label">{t.modelLabel}</dt>
                  <dd className="mt-1 text-ink">
                    {modelLabel(persona.model)} · {providerLabel(persona.provider)}
                  </dd>
                </div>
                <div>
                  <dt className="field-label">{t.primaryLens}</dt>
                  <dd className="mt-1 break-words text-ink">{persona.stance}</dd>
                </div>
                <div>
                  <dt className="field-label">{t.fixtureInstructions}</dt>
                  <dd className="mt-1 break-words rounded-lg border border-border bg-background/60 p-3 text-xs leading-relaxed text-ink-muted">
                    {persona.instructions}
                  </dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </section>

      {/* Edit Bot Modal */}
      <Modal
        isOpen={editingBot !== null}
        onClose={() => setEditingBot(null)}
        title={t.botEditTitle}
        closeLabel={t.close}
        footer={
          <>
            <button
              type="button"
              onClick={() => setEditingBot(null)}
              className="button-secondary min-h-11 justify-center"
            >
              {t.cancel}
            </button>
            <button
              type="button"
              id="edit-bot-save-btn"
              onClick={() => void saveEditBot()}
              disabled={editSaving}
              className="button-primary min-h-11 justify-center"
            >
              {editSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Check className="h-4 w-4" aria-hidden="true" />
              )}
              {t.save}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <label className="field">
            <span className="field-label">{t.botNameLabel}</span>
            <input
              id="edit-bot-name"
              type="text"
              value={editName}
              maxLength={80}
              onChange={(e) => setEditName(e.target.value)}
            />
          </label>

          <label className="field">
            <span className="field-label">{t.botInstructionLabel}</span>
            <textarea
              id="edit-bot-instruction"
              rows={5}
              maxLength={4000}
              value={editInstruction}
              onChange={(e) => setEditInstruction(e.target.value)}
            />
          </label>

          {connectedKeys.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="field">
                <span className="field-label">{t.providersTitle}</span>
                <select
                  id="edit-bot-provider"
                  value={editProvider}
                  onChange={(e) => {
                    const nextProv = e.target.value as ModelProvider;
                    setEditProvider(nextProv);
                    const found = connectedKeys.find((k) => k.provider === nextProv);
                    if (found) setEditModel(found.modelName || found.models?.[0] || '');
                  }}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-brass"
                >
                  {connectedKeys.map((k) => (
                    <option key={k.provider} value={k.provider}>
                      {k.label || providerLabel(k.provider)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span className="field-label">{t.botModelLabel}</span>
                <select
                  id="edit-bot-model"
                  value={editModel}
                  onChange={(e) => setEditModel(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-brass"
                >
                  {editProviderModels.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}

          {editError && (
            <p role="alert" className="text-sm font-medium text-terracotta">
              {editError}
            </p>
          )}
        </div>
      </Modal>

      {/* Delete Bot confirmation */}
      <Modal
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        title={t.deleteSession}
        description={botToDelete ? t.botDeleteConfirm.replace('{name}', botToDelete.name) : ''}
        closeLabel={t.close}
        footer={
          <>
            <button
              type="button"
              onClick={() => setDeleteConfirmOpen(false)}
              className="button-secondary min-h-11 justify-center"
            >
              {t.cancel}
            </button>
            <button
              type="button"
              onClick={async () => {
                if (!botToDelete) return;
                setDeleteConfirmOpen(false);
                await deleteBot(botToDelete.id);
                setBotToDelete(null);
              }}
              className="button-danger min-h-11 justify-center"
            >
              {t.deleteSession}
            </button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-ink-muted">
          {botToDelete ? t.botDeleteConfirm.replace('{name}', botToDelete.name) : ''}
        </p>
      </Modal>
    </div>
  );
};
