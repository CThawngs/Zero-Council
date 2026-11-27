/**
 * Runtime error and attachment-problem localizers (EN <-> VI).
 *
 * Converts raw Supabase/OAuth error strings and browser file/link/media reader errors into
 * user-friendly localized messages without leaking internal error codes.
 */

import type { Language } from '../types.ts';
import { copyEn } from './en.ts';
import { copyVi } from './vi.ts';
import type { Copy } from './types.ts';

const copyByLang = {
  en: copyEn,
  vi: copyVi,
} as const;

/** Maps raw Supabase / OAuth English error messages or codes to localized user-facing copy. */
export const localizeAuthError = (
  rawMessage: string,
  languageOrCopy: Language | Copy
): string => {
  const trimmed = rawMessage.trim();
  if (!trimmed) return '';
  const dict: Copy =
    typeof languageOrCopy === 'string' ? copyByLang[languageOrCopy] : languageOrCopy;
  const lower = trimmed.toLowerCase();

  if (
    lower.includes('invalid login credentials') ||
    lower.includes('invalid_credentials') ||
    lower.includes('invalid email or password')
  ) {
    return dict.authErrInvalidCredentials;
  }
  if (lower.includes('email not confirmed') || lower.includes('email_not_confirmed')) {
    return dict.authErrEmailNotConfirmed;
  }
  if (
    lower.includes('user already registered') ||
    lower.includes('user_already_exists') ||
    lower.includes('email_exists')
  ) {
    return dict.authErrUserAlreadyRegistered;
  }
  if (
    lower.includes('password should be at least') ||
    lower.includes('weak_password') ||
    lower.includes('at least 8 characters') ||
    lower.includes('at least 6 characters')
  ) {
    return dict.authErrPasswordTooShort;
  }
  if (lower.includes('new password should be different') || lower.includes('same_password')) {
    return dict.authErrSamePassword;
  }
  if (
    lower.includes('for security purposes') ||
    lower.includes('rate limit') ||
    lower.includes('over_email_send_rate_limit') ||
    lower.includes('over_request_rate_limit') ||
    lower.includes('too many requests')
  ) {
    return dict.authErrRateLimited;
  }
  if (
    lower.includes('unable to validate email address') ||
    lower.includes('validation_failed') ||
    lower.includes('invalid format')
  ) {
    return dict.authErrInvalidEmail;
  }
  if (lower.includes('signup requires a valid password')) {
    return dict.authErrPasswordRequired;
  }
  if (lower.includes('auth session missing') || lower.includes('session_not_found')) {
    return dict.authErrSessionMissing;
  }
  if (
    lower.includes('no authentication code or token was provided') ||
    lower === 'missing_code'
  ) {
    return dict.authErrMissingCode;
  }
  if (
    lower.includes('token has expired or is invalid') ||
    lower.includes('email link is invalid or has expired') ||
    lower.includes('otp_expired') ||
    lower.includes('flow_state_expired')
  ) {
    return dict.authErrTokenExpired;
  }
  if (lower.includes('access_denied') || lower.includes('user_cancelled')) {
    return dict.authErrOAuthDenied;
  }
  if (lower === 'server_error' || lower === 'unexpected_failure') {
    return dict.authErrorDefaultMessage;
  }
  return trimmed;
};

const ATTACHMENT_EXACT_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ['This does not look like a text file.', 'Tệp này không giống tệp văn bản.'],
  ['The text encoding is not supported. Save it as UTF-8 and try again.', 'Bảng mã văn bản không được hỗ trợ. Hãy lưu dưới dạng UTF-8 rồi thử lại.'],
  ['This file is damaged or is not an Office document.', 'Tệp này bị hỏng hoặc không phải tài liệu Office.'],
  ['This archive is too large to read (ZIP64).', 'Tệp nén quá lớn để đọc (ZIP64).'],
  ['This file is password-protected.', 'Tệp này đang được đặt mật khẩu bảo vệ.'],
  ['This document is too large to read.', 'Tài liệu này quá lớn để đọc.'],
  ['This file uses a compression the reader does not support.', 'Tệp này dùng chuẩn nén không được hỗ trợ.'],
  ['This is not a Word document (.docx).', 'Đây không phải tài liệu Word (.docx).'],
  ['This is not a PowerPoint file (.pptx).', 'Đây không phải tệp PowerPoint (.pptx).'],
  ['This is not an Excel file (.xlsx).', 'Đây không phải tệp Excel (.xlsx).'],
  ['The file is empty.', 'Tệp đang trống.'],
  ['This file could not be read. It may be damaged.', 'Không thể đọc tệp này. Có thể tệp đã bị hỏng.'],
  ['No readable text was found in this file.', 'Không tìm thấy văn bản đọc được trong tệp này.'],
  ['This image could not be opened. The format may not be supported by your browser.', 'Không mở được ảnh này. Định dạng có thể chưa được trình duyệt hỗ trợ.'],
  ['This browser cannot process images.', 'Trình duyệt này không hỗ trợ xử lý ảnh.'],
  ['This image is too detailed to send. Try a smaller one.', 'Ảnh quá chi tiết nên vượt giới hạn gửi. Hãy thử ảnh nhỏ hơn.'],
  ['The video file is empty.', 'Tệp video đang trống.'],
  ['That does not look like a link.', 'Đường dẫn này không giống một liên kết hợp lệ.'],
  ['Only http and https links can be read.', 'Chỉ đọc được liên kết http và https.'],
  ['The page had no readable text.', 'Trang này không có nội dung văn bản đọc được.'],
  ['The page took too long to answer.', 'Trang phản hồi quá lâu.'],
  ['The browser would not share this page. Most sites block that.', 'Trình duyệt không cho phép đọc trực tiếp trang này (đa số trang web chặn CORS).'],
  ['The video was not kept when the page reloaded. Attach it again.', 'Video không được giữ lại sau khi tải lại trang. Vui lòng đính kèm lại.'],
  ['The image was not kept when the page reloaded. Attach it again.', 'Ảnh không được giữ lại sau khi tải lại trang. Vui lòng đính kèm lại.'],
];

/** Bidirectional EN <-> VI translator for browser file/image/video/link/reload attachment problems. */
export const localizeAttachmentProblem = (problem: string, language: Language): string => {
  const trimmed = problem.trim();
  if (!trimmed) return '';

  for (const [enText, viText] of ATTACHMENT_EXACT_PAIRS) {
    if (trimmed === enText || trimmed === viText) {
      return language === 'vi' ? viText : enText;
    }
  }

  let m = /^Old (\.[a-z0-9]+) files are not supported. Save it as (\.[a-z0-9]+) and attach that\.$/i.exec(trimmed)
    ?? /^Không hỗ trợ tệp (\.[a-z0-9]+) cũ. Hãy lưu thành (\.[a-z0-9]+) rồi đính kèm lại\.$/i.exec(trimmed);
  if (m) {
    return language === 'vi'
      ? `Không hỗ trợ tệp ${m[1]} cũ. Hãy lưu thành ${m[2]} rồi đính kèm lại.`
      : `Old ${m[1]} files are not supported. Save it as ${m[2]} and attach that.`;
  }

  m = /^Supported files: (.+)\.$/i.exec(trimmed)
    ?? /^Định dạng hỗ trợ: (.+)\.$/i.exec(trimmed);
  if (m) {
    return language === 'vi'
      ? `Định dạng hỗ trợ: ${m[1]}.`
      : `Supported files: ${m[1]}.`;
  }

  m = /^The (file|image|video) is larger than (\d+) MB\.$/i.exec(trimmed);
  if (m) {
    if (language === 'en') return trimmed;
    const kindVi = m[1].toLowerCase() === 'image' ? 'Ảnh' : m[1].toLowerCase() === 'video' ? 'Video' : 'Tệp';
    return `${kindVi} lớn hơn giới hạn ${m[2]} MB.`;
  }
  m = /^(Tệp|Ảnh|Video) lớn hơn giới hạn (\d+) MB\.$/i.exec(trimmed);
  if (m) {
    if (language === 'vi') return trimmed;
    const kindEn = m[1] === 'Ảnh' ? 'image' : m[1] === 'Video' ? 'video' : 'file';
    return `The ${kindEn} is larger than ${m[2]} MB.`;
  }

  m = /^The page answered (\d+)\.$/i.exec(trimmed)
    ?? /^Trang phản hồi mã trạng thái (\d+)\.$/i.exec(trimmed);
  if (m) {
    return language === 'vi'
      ? `Trang phản hồi mã trạng thái ${m[1]}.`
      : `The page answered ${m[1]}.`;
  }

  m = /^At most (\d+) images per message\.$/i.exec(trimmed)
    ?? /^Tối đa (\d+) ảnh mỗi tin nhắn\.$/i.exec(trimmed);
  if (m) {
    return copyByLang[language].chatMaxImagesError.replace('{max}', m[1]);
  }

  return trimmed;
};
