/**
 * What to tell the human about one attachment, in one place.
 *
 * The composer chip, the message bubble and the meeting summary all show this line. Three copies
 * of the same three-way branch is how one of them ends up claiming "read in full" for a file that
 * was cut — which is exactly the lie this line exists to prevent.
 */

import type { ChatAttachment } from './engine';

interface StatusCopy {
  chatAttachmentRead: string;
  chatAttachmentUnread: string;
  chatAttachmentTruncated: string;
}

export const attachmentStatus = (attachment: ChatAttachment, copy: StatusCopy): string => {
  if (attachment.problem) return copy.chatAttachmentUnread.replace('{reason}', attachment.problem);
  if (attachment.truncated) {
    return copy.chatAttachmentTruncated.replace('{chars}', (attachment.text?.length ?? 0).toLocaleString());
  }
  return copy.chatAttachmentRead;
};
