/**
 * Sub-hook managing room attachments (browser/server link reader, documents, images, video keyframes, and web search).
 */

import { useState } from 'react';
import { copy } from '../i18n';
import type { Language } from '../types';
import type { ChatAttachment } from '../chat/engine';
import { UnreadableLinkError, readLinkInBrowser } from '../chat/read-link-web';
import { UnreadableFileError, readFileInBrowser } from '../chat/read-file-web';
import { MAX_IMAGES_PER_MESSAGE, isImageFile, readImageInBrowser } from '../chat/read-image-web';
import { isVideoFile, readVideoInBrowser } from '../chat/read-video-web';
import type { ChatRoom } from './types';

export function useRoomAttachments({
  authUser,
  language,
  currentRoom,
  setCurrentRoom,
}: {
  authUser: { id: string; email: string } | null;
  language: Language;
  currentRoom: ChatRoom | null;
  setCurrentRoom: React.Dispatch<React.SetStateAction<ChatRoom | null>>;
}) {
  const [isReadingLink, setIsReadingLink] = useState(false);
  const [isReadingFile, setIsReadingFile] = useState(false);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [isSearchingWeb, setIsSearchingWeb] = useState(false);

  const attachLink = async (url: string) => {
    const href = url.trim();
    if (!href) return;
    setIsReadingLink(true);
    const attachment: ChatAttachment = {
      id: `att-${Date.now()}`,
      kind: 'link',
      name: href,
      href,
    };
    try {
      const reading = await readLinkInBrowser(href, { language });
      attachment.text = reading.text;
    } catch (error) {
      let resolvedViaServer = false;
      if (authUser) {
        try {
          const res = await fetch('/api/read-link', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: href }),
          });
          if (res.ok) {
            const data = (await res.json()) as {
              title?: string;
              text?: string;
              truncated?: boolean;
            };
            if (data.text) {
              attachment.text = data.text;
              attachment.truncated = Boolean(data.truncated);
              if (data.title) attachment.name = data.title;
              resolvedViaServer = true;
            }
          }
        } catch {
          // Server link reader failed; record original browser error below.
        }
      }
      if (!resolvedViaServer) {
        attachment.problem = error instanceof UnreadableLinkError ? error.reason : String(error);
      }
    } finally {
      setIsReadingLink(false);
      setCurrentRoom((room) =>
        room ? { ...room, pending: [...room.pending, attachment] } : room
      );
    }
  };

  const attachFiles = async (files: File[]) => {
    if (files.length === 0) return;
    setIsReadingFile(true);
    let images = (currentRoom?.pending ?? []).filter(
      (item) => item.kind === 'image' && !item.problem
    ).length;
    try {
      for (const file of files) {
        const video = isVideoFile(file);
        const image = !video && isImageFile(file);
        const kind: ChatAttachment['kind'] = video ? 'video' : image ? 'image' : 'file';
        const attachment: ChatAttachment = {
          id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          kind,
          name: file.name,
          href: `${kind}:${file.name}`,
        };
        try {
          if (video) {
            const videoReading = await readVideoInBrowser(file, { language });
            attachment.previewUrl = videoReading.previewUrl;
            attachment.frames = videoReading.frames;
            attachment.text = videoReading.summary;
          } else if (image) {
            if (images >= MAX_IMAGES_PER_MESSAGE * 2) {
              throw new UnreadableFileError(
                copy[language].chatMaxImagesError.replace('{max}', String(MAX_IMAGES_PER_MESSAGE * 2))
              );
            }
            attachment.dataUrl = (await readImageInBrowser(file, { language })).dataUrl;
            images += 1;
          } else {
            const reading = await readFileInBrowser(file, { language });
            attachment.text = reading.text;
            if (reading.truncated) attachment.truncated = true;
          }
        } catch (error) {
          attachment.problem = error instanceof UnreadableFileError ? error.reason : String(error);
        }
        setCurrentRoom((room) =>
          room ? { ...room, pending: [...room.pending, attachment] } : room
        );
      }
    } finally {
      setIsReadingFile(false);
    }
  };

  const removePending = (id: string) => {
    setCurrentRoom((room) =>
      room ? { ...room, pending: room.pending.filter((item) => item.id !== id) } : room
    );
  };

  return {
    isReadingLink,
    isReadingFile,
    webSearchEnabled,
    setWebSearchEnabled,
    isSearchingWeb,
    setIsSearchingWeb,
    attachLink,
    attachFiles,
    removePending,
  };
}
