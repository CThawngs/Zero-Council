/**
 * Preparing an image the human drops into the room, entirely in their browser.
 *
 * Same stance as `read-file-web.ts`: no upload endpoint, the picture never touches our server.
 * It goes from this tab to the provider the human already gave a key for, and nowhere else.
 *
 * Every image is redrawn onto a canvas and re-encoded as JPEG. That is deliberate, not a detour:
 *  - it shrinks a 12 MP phone photo to something a provider accepts and bills sanely for;
 *  - it drops EXIF, which can carry the GPS position of where the photo was taken;
 *  - it turns webp / gif / png into the one format every provider takes.
 *
 * Ceilings, stated plainly: an animated GIF becomes its first frame; transparency becomes white;
 * HEIC works only where the browser can decode it (Safari); there is no OCR — the model reads
 * the picture itself, so a model without vision would not be able to.
 */

import { UnreadableFileError } from './read-file-web.ts';

/** Raw input ceiling. The output is far smaller; this only stops a pasted 500 MB file. */
export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
/** Longest side after resizing. Providers downscale anything bigger anyway, after charging for it. */
export const MAX_IMAGE_EDGE = 1568;
/** Each image is sent to every advisor on every turn, on the human's own key. */
export const MAX_IMAGES_PER_MESSAGE = 4;
/** Anthropic rejects a single image over 5 MB; base64 inflates by 4/3. */
const MAX_OUTPUT_DATA_URL = Math.floor((5 * 1024 * 1024 * 4) / 3);

export const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.heic', '.heif'] as const;

export const isImageFile = (file: { name: string; type?: string }): boolean => {
  if (file.type?.startsWith('image/')) return true;
  const dot = file.name.lastIndexOf('.');
  return dot >= 0 && (IMAGE_EXTENSIONS as readonly string[]).includes(file.name.slice(dot).toLowerCase());
};

/** Scales (width, height) down to fit `max` on the longest side. Never scales up. */
export const fitWithin = (width: number, height: number, max: number = MAX_IMAGE_EDGE): { width: number; height: number } => {
  const longest = Math.max(width, height);
  if (longest <= max) return { width, height };
  const scale = max / longest;
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
};

/** `data:image/jpeg;base64,AAAA` → the two parts each provider wants separately. */
export const splitDataUrl = (dataUrl: string): { mediaType: string; base64: string } | null => {
  const match = /^data:([a-z]+\/[a-z0-9.+-]+);base64,(.+)$/i.exec(dataUrl);
  return match ? { mediaType: match[1], base64: match[2] } : null;
};

export interface ImageReading {
  dataUrl: string;
  width: number;
  height: number;
}

export const readImageInBrowser = async (file: Blob & { name: string }): Promise<ImageReading> => {
  if (file.size === 0) throw new UnreadableFileError('The file is empty.');
  if (file.size > MAX_IMAGE_BYTES) {
    throw new UnreadableFileError(`The image is larger than ${MAX_IMAGE_BYTES / (1024 * 1024)} MB.`);
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new UnreadableFileError('This image could not be opened. The format may not be supported by your browser.');
  }

  try {
    const { width, height } = fitWithin(bitmap.width, bitmap.height);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new UnreadableFileError('This browser cannot process images.');
    // JPEG has no alpha: without this a transparent PNG turns black.
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);

    // Lower the quality instead of failing: a dense screenshot can exceed the provider's limit.
    for (const quality of [0.85, 0.7, 0.5]) {
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      if (dataUrl.length <= MAX_OUTPUT_DATA_URL) return { dataUrl, width, height };
    }
    throw new UnreadableFileError('This image is too detailed to send. Try a smaller one.');
  } finally {
    bitmap.close();
  }
};
