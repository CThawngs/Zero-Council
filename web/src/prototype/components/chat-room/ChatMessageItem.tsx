/**
 * Chat message bubble (user & AI advisor), rich media/source chips, and inline turn error card.
 */

import React from 'react';
import { AlertCircle, ExternalLink, KeyRound, Maximize2, RotateCcw } from 'lucide-react';
import { USER_HANDLE, type ChatMessage } from '../../chat/engine';
import { attachmentStatus } from '../../chat/attachment-status';
import { hasRichContent } from '../../chat/content-render';
import { useApp } from '../../context/AppContext';
import { modelLabel, providerLabel } from '../../data/catalog';
import type { AdvisorPersona } from '../../types';
import { ContentRenderPanel } from '../ContentRenderPanel';
import { ExpandableText } from '../ExpandableText';
import {
  AttachmentGlyph,
  Avatar,
  matchPersonaId,
  renderBody,
  type TurnFailureCardData,
} from './helpers';

interface ChatMessageItemProps {
  message: ChatMessage;
  roster: AdvisorPersona[];
  rosterNames: string[];
}

export const ChatMessageItem: React.FC<ChatMessageItemProps> = ({
  message,
  roster,
  rosterNames,
}) => {
  const { openContentPanel, t } = useApp();
  const isUser = message.authorId === USER_HANDLE;
  const persona = roster.find((item) => matchPersonaId(item, message.authorId));

  const attachments =
    message.attachments && message.attachments.length > 0 ? (
      <div className="mt-3 space-y-2">
        {message.attachments.some(
          (att) =>
            (att.kind === 'image' && att.dataUrl) ||
            (att.kind === 'video' && (att.previewUrl || (att.frames && att.frames.length > 0)))
        ) && (
          <div className="grid gap-2 sm:grid-cols-2">
            {message.attachments.map((att) => {
              if (att.kind === 'image' && att.dataUrl) {
                return (
                  <div
                    key={`${att.id}-img`}
                    className="overflow-hidden rounded-xl border border-border/60 bg-black/10"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={att.dataUrl}
                      alt={att.name}
                      className="max-h-52 w-full object-cover"
                    />
                  </div>
                );
              }
              if (att.kind === 'video' && att.previewUrl) {
                return (
                  <div
                    key={`${att.id}-vid`}
                    className="overflow-hidden rounded-xl border border-border/60 bg-black/20"
                  >
                    <video
                      src={att.previewUrl}
                      controls
                      preload="metadata"
                      className="max-h-52 w-full object-contain"
                    />
                  </div>
                );
              }
              if (att.kind === 'video' && att.frames && att.frames[0]) {
                return (
                  <div
                    key={`${att.id}-frame`}
                    className="overflow-hidden rounded-xl border border-border/60 bg-black/10"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={att.frames[0]}
                      alt={att.name}
                      className="max-h-48 w-full object-cover"
                    />
                  </div>
                );
              }
              return null;
            })}
          </div>
        )}

        <ul className="space-y-1.5">
          {message.attachments.map((attachment) => {
            const isExternalUrl =
              attachment.kind === 'link' && /^https?:\/\//i.test(attachment.href);
            const hasProblem = Boolean(attachment.problem);
            const chipClasses = hasProblem
              ? isUser
                ? 'border-terracotta/50 bg-surface/95 text-ink'
                : 'border-terracotta/45 bg-terracotta/10 text-ink'
              : isUser
                ? 'border-current/30 bg-black/10'
                : 'border-border bg-background/60 text-ink-muted';
            const iconClasses = hasProblem ? 'text-terracotta' : isUser ? '' : 'text-brass';
            return (
              <li
                key={attachment.id}
                className={`flex items-start gap-2 rounded-lg border px-2.5 py-1.5 text-[11px] leading-relaxed ${chipClasses}`}
              >
                <AttachmentGlyph
                  attachment={attachment}
                  className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${iconClasses}`}
                />
                <span className="min-w-0 flex-1 break-all">
                  {isExternalUrl ? (
                    <a
                      href={attachment.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-semibold underline decoration-current/40 hover:decoration-current"
                    >
                      <span>{attachment.name}</span>
                      <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
                    </a>
                  ) : (
                    <span className={`font-medium ${isUser && !hasProblem ? '' : 'text-ink'}`}>
                      {attachment.name}
                    </span>
                  )}{' '}
                  {attachmentStatus(attachment, t)}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    ) : null;

  if (isUser) {
    return (
      <article className="chat-pop flex flex-col items-end gap-1.5">
        <span className="pr-1 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
          {t.chatYou}
        </span>
        <div
          className="max-w-[88%] rounded-2xl rounded-tr-md px-4 py-2.5 shadow-sm sm:max-w-[min(72%,46rem)]"
          style={{
            backgroundColor: 'var(--color-accent)',
            color: 'var(--color-accent-ink)',
          }}
        >
          <ExpandableText
            key={message.id}
            text={message.body}
            maxLines={5}
            className="text-sm leading-relaxed"
            buttonClassName="text-current opacity-85 hover:opacity-100"
            showMoreLabel={t.summaryShowMore}
            showLessLabel={t.summaryShowLess}
          >
            {renderBody(message.body, rosterNames, true)}
          </ExpandableText>
          {attachments}
        </div>
      </article>
    );
  }

  const color = persona?.colorHex ?? 'var(--color-ink-muted)';
  const rich = hasRichContent(message.body);

  return (
    <article className="chat-pop flex items-start gap-2.5 sm:gap-3">
      <Avatar name={persona?.name ?? '?'} color={color} />
      <div className="min-w-0 max-w-[88%] sm:max-w-[min(72%,46rem)]">
        <header className="mb-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 pl-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-ink">
            {persona?.name ?? message.authorId}
          </span>
          {persona && (
            <span className="text-[11px] text-ink-muted">
              {modelLabel(persona.model)} · {providerLabel(persona.provider)}
            </span>
          )}
        </header>
        <div
          className="rounded-2xl rounded-tl-md border px-4 py-3 shadow-sm"
          style={{
            backgroundColor: `color-mix(in srgb, ${color} 9%, var(--color-surface))`,
            borderColor: `color-mix(in srgb, ${color} 34%, var(--color-border))`,
          }}
        >
          {rich ? (
            <ExpandableText
              key={message.id}
              as="div"
              text={message.body}
              maxHeight={280}
              showMoreLabel={t.summaryShowMore}
              showLessLabel={t.summaryShowLess}
            >
              <ContentRenderPanel
                content={message.body}
                compact
                showHeader={false}
                renderMentionText={(plain) => renderBody(plain, rosterNames)}
              />
            </ExpandableText>
          ) : (
            <ExpandableText
              key={message.id}
              text={message.body}
              maxLines={5}
              className="text-sm leading-relaxed text-ink"
              showMoreLabel={t.summaryShowMore}
              showLessLabel={t.summaryShowLess}
            >
              {renderBody(message.body, rosterNames)}
            </ExpandableText>
          )}
          {rich && (
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                onClick={() =>
                  openContentPanel({
                    title: persona?.name ?? t.contentPanelTitle,
                    content: message.body,
                  })
                }
                className="inline-flex items-center gap-1 rounded-md border border-border bg-background/70 px-2 py-0.5 text-[11px] font-medium text-ink-muted transition hover:border-brass/60 hover:text-ink"
              >
                <Maximize2 className="h-3 w-3" aria-hidden="true" />
                <span>{t.contentPanelOpen}</span>
              </button>
            </div>
          )}
          {attachments}
        </div>
      </div>
    </article>
  );
};

export const ChatTurnErrorCard: React.FC<{ card: TurnFailureCardData }> = ({ card }) => {
  const { retryLastTurn, setCurrentView, t } = useApp();

  return (
    <div
      id="chat-turn-error-card"
      role="alert"
      className="mx-auto max-w-lg rounded-2xl border border-terracotta/45 bg-terracotta/10 p-4 text-xs leading-relaxed text-ink"
    >
      <div className="flex items-start gap-2.5">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-terracotta" aria-hidden="true" />
        <div className="min-w-0 flex-1 space-y-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-ink">{card.cardTitle}</p>
            {card.botName && <span className="badge-neutral text-[10px]">{card.botName}</span>}
          </div>
          <p className="text-ink-muted">{card.bodyText}</p>
          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            {card.needsKey && (
              <button
                type="button"
                id="chat-turn-connect-key-btn"
                onClick={() => setCurrentView('api-keys')}
                className="button-primary min-h-9 justify-center px-3 py-1.5 text-xs"
              >
                <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{t.turnConnectApiKey}</span>
              </button>
            )}
            <button
              type="button"
              id="chat-turn-retry-btn"
              onClick={() => void retryLastTurn()}
              className={
                card.needsKey
                  ? 'button-secondary min-h-9 justify-center px-3 py-1.5 text-xs'
                  : 'button-primary min-h-9 justify-center px-3 py-1.5 text-xs'
              }
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{t.turnRetryCta}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
