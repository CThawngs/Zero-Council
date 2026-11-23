import type { ChatAttachment } from './engine';
import { copy as i18nCopy, localizeAttachmentProblem } from '../i18n.ts';

interface StatusCopy {
  chatAttachmentRead: string;
  chatAttachmentUnread: string;
  chatAttachmentTruncated: string;
  chatImageAttached: string;
  chatVideoAttached?: string;
}

export const attachmentStatus = (attachment: ChatAttachment, copy: StatusCopy): string => {
  const isVi =
    copy === i18nCopy.vi ||
    copy.chatAttachmentRead === i18nCopy.vi.chatAttachmentRead ||
    copy.chatAttachmentUnread.includes('Chưa đọc');
  if (attachment.problem) {
    const localized = localizeAttachmentProblem(attachment.problem, isVi ? 'vi' : 'en');
    return copy.chatAttachmentUnread.replace('{reason}', localized);
  }
  if (attachment.kind === 'image') return copy.chatImageAttached;
  if (attachment.kind === 'video') {
    return copy.chatVideoAttached ?? copy.chatImageAttached;
  }
  if (attachment.truncated) {
    return copy.chatAttachmentTruncated.replace('{chars}', (attachment.text?.length ?? 0).toLocaleString());
  }
  return copy.chatAttachmentRead;
};
