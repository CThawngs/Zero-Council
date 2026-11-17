import type { ChatAttachment } from './engine';

interface StatusCopy {
  chatAttachmentRead: string;
  chatAttachmentUnread: string;
  chatAttachmentTruncated: string;
  chatImageAttached: string;
  chatVideoAttached?: string;
}

export const attachmentStatus = (attachment: ChatAttachment, copy: StatusCopy): string => {
  if (attachment.problem) return copy.chatAttachmentUnread.replace('{reason}', attachment.problem);
  if (attachment.kind === 'image') return copy.chatImageAttached;
  if (attachment.kind === 'video') {
    return copy.chatVideoAttached ?? copy.chatImageAttached;
  }
  if (attachment.truncated) {
    return copy.chatAttachmentTruncated.replace('{chars}', (attachment.text?.length ?? 0).toLocaleString());
  }
  return copy.chatAttachmentRead;
};
