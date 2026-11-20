import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { ArrowRight, Plus, Search, Settings2, Trash2, Users } from 'lucide-react';
import { Modal } from './Modal';
import type { SavedConversation } from '../types';

export const SessionsListView: React.FC = () => {
  const {
    conversations,
    personas,
    openGroupChat,
    openEditGroup,
    deleteConversationById,
    openJoinRoom,
    t,
  } = useApp();

  const [search, setSearch] = useState('');
  const [groupToDelete, setGroupToDelete] = useState<SavedConversation | null>(null);
  const [deleting, setDeleting] = useState(false);

  const groupChats = conversations.filter((c) => c.kind === 'group');

  const normalizedSearch = search.trim().toLowerCase();
  const filteredGroupChats = groupChats.filter((group) => {
    if (!normalizedSearch) return true;
    if (group.title.toLowerCase().includes(normalizedSearch)) return true;
    const memberPersonas = group.roster.map(
      (id) => personas.find((p) => p.id === id || p.id === `bot:${id}`)
    );
    return memberPersonas.some((p) => p?.name.toLowerCase().includes(normalizedSearch));
  });

  const handleDelete = async () => {
    if (!groupToDelete || deleting) return;
    setDeleting(true);
    try {
      await deleteConversationById(groupToDelete.id);
      setGroupToDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-7 py-4 sm:py-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brass">
            {t.sessionsEyebrow}
          </p>
          <h1 className="mt-2 font-serif text-3xl text-ink sm:text-4xl">{t.groupChatsTitle}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-muted">
            {t.groupChatsEmpty}
          </p>
        </div>
        <button
          type="button"
          onClick={openJoinRoom}
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-brass px-4 py-2.5 text-sm font-semibold text-background transition hover:bg-brass/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass sm:w-auto"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          {t.newGroupChat}
        </button>
      </header>

      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-md">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
            aria-hidden="true"
          />
          <label htmlFor="group-search" className="sr-only">
            {t.groupChatsTitle}
          </label>
          <input
            id="group-search"
            name="group-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t.groupChatsTitle}
            className="min-h-11 w-full rounded-lg border border-border bg-background py-2.5 pl-10 pr-3 text-sm text-ink placeholder:text-ink-muted focus:border-brass focus:outline-none focus:ring-2 focus:ring-brass/20"
          />
        </div>
        <span className="text-xs text-ink-muted">
          {groupChats.length} {t.groupChatsTitle.toLowerCase()}
        </span>
      </div>

      {filteredGroupChats.length === 0 ? (
        <section
          className="rounded-2xl border border-border bg-surface px-5 py-12 text-center"
          aria-live="polite"
        >
          <Users className="mx-auto h-9 w-9 text-ink-muted" aria-hidden="true" />
          <h2 className="mt-4 font-serif text-2xl text-ink">
            {search.trim() ? t.emptySessionsTitle : t.groupChatsTitle}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-muted">
            {t.groupChatsEmpty}
          </p>
          <button
            type="button"
            onClick={openJoinRoom}
            className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brass px-5 py-3 text-sm font-semibold text-background transition hover:bg-brass/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            {t.newGroupChat}
          </button>
        </section>
      ) : (
        <ul className="grid gap-4" aria-label={t.groupChatsTitle}>
          {filteredGroupChats.map((group) => {
            const titleId = `group-chat-${group.id}`;
            const memberPersonas = group.roster
              .map((id) => personas.find((p) => p.id === id || p.id === `bot:${id}`))
              .filter((p): p is (typeof personas)[number] => Boolean(p));

            return (
              <li key={group.id}>
                <article
                  className="flex flex-col gap-5 rounded-2xl border border-border bg-surface p-5 transition hover:border-brass/45 sm:flex-row sm:items-center sm:justify-between sm:p-6"
                  aria-labelledby={titleId}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1 text-[11px] font-medium text-brass">
                        <Users className="h-3 w-3" aria-hidden="true" />
                        {t.groupBadge.replace('{count}', String(group.roster.length))}
                      </span>
                      <span className="rounded-md border border-border bg-background px-2 py-1 text-[11px] text-ink-muted">
                        {group.mode === 'panel' ? t.modePanel : t.modeRoundRobin}
                      </span>
                    </div>

                    <h2 id={titleId} className="mt-3 break-words font-serif text-xl text-ink">
                      {group.title}
                    </h2>

                    {memberPersonas.length > 0 && (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <div className="flex -space-x-1.5" aria-hidden="true">
                          {memberPersonas.slice(0, 5).map((advisor) => (
                            <span
                              key={advisor.id}
                              title={advisor.name}
                              className="h-6 w-6 rounded-full border-2 border-surface"
                              style={{ backgroundColor: advisor.colorHex }}
                            />
                          ))}
                        </div>
                        <span className="text-xs text-ink-muted">
                          {memberPersonas.map((m) => m.name).join(', ')}
                        </span>
                      </div>
                    )}

                    <p className="mt-2 text-xs text-ink-muted">
                      {t.summaryStatTurns}: {group.messages.filter((m) => m.authorId !== 'user').length}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                    <button
                      type="button"
                      onClick={() => openGroupChat(group.id)}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-semibold text-ink transition hover:border-brass/50 hover:bg-brass hover:text-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
                    >
                      {t.joinStart}
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditGroup(group.id)}
                      aria-label={t.groupEditTitle}
                      className="icon-button min-h-11 min-w-11"
                    >
                      <Settings2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setGroupToDelete(group)}
                      aria-label={t.deleteSession}
                      className="icon-button min-h-11 min-w-11 hover:bg-terracotta/10 hover:text-terracotta"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      )}

      {/* Delete Group Chat Confirmation Modal */}
      <Modal
        isOpen={groupToDelete !== null}
        onClose={() => !deleting && setGroupToDelete(null)}
        title={t.deleteSession}
        closeLabel={t.close}
        footer={
          <>
            <button
              type="button"
              disabled={deleting}
              onClick={() => setGroupToDelete(null)}
              className="button-secondary min-h-11 justify-center disabled:opacity-50"
            >
              {t.cancel}
            </button>
            <button
              type="button"
              disabled={deleting}
              onClick={() => void handleDelete()}
              className="button-danger min-h-11 justify-center disabled:opacity-50"
            >
              {t.deleteSession}
            </button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-ink-muted">
          {groupToDelete ? t.botDeleteConfirm.replace('{name}', groupToDelete.title) : ''}
        </p>
      </Modal>
    </div>
  );
};
