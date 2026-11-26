/**
 * Shared primitives, mention body renderer, avatar badges, and failure-card builder for ChatRoomView.
 */

import React from 'react';
import { FileText, Film, ImageIcon, Link2 } from 'lucide-react';
import { ACCEPT_ATTRIBUTE } from '../../chat/read-file-web';
import { IMAGE_EXTENSIONS } from '../../chat/read-image-web';
import { VIDEO_EXTENSIONS } from '../../chat/read-video-web';
import type { ChatAttachment } from '../../chat/engine';
import { tokenizeMentions, type CHAT_UX_COPY } from '../../chat/mentions';
import { providerLabel } from '../../data/catalog';
import type { Copy, Language } from '../../i18n';
import type { AdvisorPersona } from '../../types';
import type { ChatRoomState } from '../../context/types';

export const FILE_INPUT_ACCEPT = `${ACCEPT_ATTRIBUTE},${IMAGE_EXTENSIONS.join(',')},${VIDEO_EXTENSIONS.join(',')},video/*`;

export const matchPersonaId = (p: { id: string }, id: string): boolean => {
  if (p.id === id) return true;
  const strip = (s: string) => (s.startsWith('bot:') ? s.slice(4) : s);
  return strip(p.id) === strip(id);
};

export const renderBody = (body: string, names: string[] = [], onAccent = false) =>
  tokenizeMentions(body, names).map((segment, index) => {
    if (segment.kind === 'text') {
      return <span key={index}>{segment.text}</span>;
    }
    if (onAccent) {
      return (
        <span
          key={index}
          data-mention-pill={segment.kind}
          className="inline-block rounded-md border border-border/80 bg-surface px-1.5 py-0.5 text-[0.92em] font-semibold text-ink shadow-2xs"
        >
          {segment.text}
        </span>
      );
    }
    const toneClass =
      segment.kind === 'user'
        ? 'border-sage/50 bg-surface text-ink shadow-2xs'
        : 'border-brass/45 bg-surface text-ink shadow-2xs';
    return (
      <span
        key={index}
        data-mention-pill={segment.kind}
        className={`inline-block rounded-md border px-1.5 py-0.5 text-[0.92em] font-semibold ${toneClass}`}
      >
        {segment.text}
      </span>
    );
  });

const initialsOf = (name: string): string => {
  const words = name.split(/\s+/).filter((word) => word && !/^(the|a|an)$/i.test(word));
  const letters = (words.length > 0 ? words : [name]).slice(0, 2).map((word) => word.charAt(0));
  return letters.join('').toUpperCase();
};

export const AttachmentGlyph = ({
  attachment,
  className,
}: {
  attachment: ChatAttachment;
  className: string;
}) => {
  if (attachment.kind === 'image' && attachment.dataUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={attachment.dataUrl} alt="" className="h-7 w-7 shrink-0 rounded object-cover" />;
  }
  if (attachment.kind === 'video') return <Film className={className} aria-hidden="true" />;
  if (attachment.kind === 'image') return <ImageIcon className={className} aria-hidden="true" />;
  if (attachment.kind === 'file') return <FileText className={className} aria-hidden="true" />;
  return <Link2 className={className} aria-hidden="true" />;
};

export const Avatar: React.FC<{ name: string; color: string; size?: 'sm' | 'md' }> = ({
  name,
  color,
  size = 'md',
}) => (
  <span
    aria-hidden="true"
    className={`flex shrink-0 select-none items-center justify-center rounded-full border font-serif font-semibold text-ink ${
      size === 'sm' ? 'h-7 w-7 text-[11px]' : 'h-9 w-9 text-sm'
    }`}
    style={{
      backgroundColor: `color-mix(in srgb, ${color} 24%, var(--color-background))`,
      borderColor: `color-mix(in srgb, ${color} 55%, transparent)`,
    }}
  >
    {initialsOf(name)}
  </span>
);

export interface TurnFailureCardData {
  reason: string;
  cardTitle: string;
  botName?: string;
  bodyText: string;
  needsKey: boolean;
}

export const buildTurnFailureCard = (params: {
  isRunning: boolean;
  currentRoom: ChatRoomState | null;
  roster: AdvisorPersona[];
  t: Copy;
  ux: (typeof CHAT_UX_COPY)[Language];
}): TurnFailureCardData | null => {
  const { isRunning, currentRoom, roster, t, ux } = params;
  if (
    isRunning ||
    !currentRoom ||
    currentRoom.messages.length === 0 ||
    (currentRoom.stoppedBy !== 'failed' && !currentRoom.turnError)
  ) {
    return null;
  }
  const reason =
    currentRoom.turnError?.reason ??
    currentRoom.failureReason ??
    (currentRoom.failures[0]?.kind === 'timeout' ? 'timeout' : 'provider-error');
  const failedPersona = currentRoom.turnError?.botId
    ? roster.find((persona) => matchPersonaId(persona, currentRoom.turnError!.botId))
    : undefined;
  const failedProvider = providerLabel(
    currentRoom.turnError?.provider ??
      failedPersona?.provider ??
      roster[0]?.provider ??
      'openai'
  );
  const botDisplayName = failedPersona?.name ?? roster[0]?.name ?? 'Bot';
  const cardTitle =
    reason === 'missing-key'
      ? t.turnMissingApiKeyTitle
      : t.turnFailedTitle.replace('{bot}', botDisplayName);
  const bodyText = (() => {
    switch (reason) {
      case 'missing-key':
        return t.turnMissingApiKeyBody
          .replace('{bot}', botDisplayName)
          .replace('{provider}', failedProvider);
      case 'timeout':
        return t.turnFailedBody.replace('{reason}', `${failedProvider} ? ${ux.failureTimeout}`);
      case 'rate-limit':
        return t.turnFailedBody.replace('{reason}', `${failedProvider} ? ${ux.failureTransient}`);
      case 'provider-auth':
        return t.turnFailedBody.replace('{reason}', `${failedProvider} ? ${ux.failureFatal}`);
      default:
        return t.turnFailedBody.replace('{reason}', `${failedProvider} ? ${ux.failureUnknown}`);
    }
  })();
  return {
    reason,
    cardTitle,
    botName: failedPersona?.name,
    bodyText,
    needsKey: reason === 'missing-key' || reason === 'provider-auth',
  };
};
