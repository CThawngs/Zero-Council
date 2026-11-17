/**
 * Preparing a video the user attaches in the browser.
 *
 * Provides two things at once:
 *  1. `previewUrl` (an in-memory Blob URL) so the chat composer and message bubble render an
 *     interactive `<video controls>` player immediately.
 *  2. `frames` (up to 3 downscaled JPEG keyframes sampled across the clip) so multimodal vision
 *     providers (Anthropic, OpenAI, Gemini, Groq, xAI, OpenRouter, NVIDIA) can visually inspect
 *     what happens in the video without needing proprietary server-side video upload APIs.
 */

import { UnreadableFileError } from './read-file-web.ts';
import { fitWithin } from './read-image-web.ts';

export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
export const MAX_VIDEO_FRAME_EDGE = 1024;
export const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mov', '.m4v', '.ogg'] as const;

export const isVideoFile = (file: { name: string; type?: string }): boolean => {
  if (file.type?.startsWith('video/')) return true;
  const dot = file.name.lastIndexOf('.');
  return dot >= 0 && (VIDEO_EXTENSIONS as readonly string[]).includes(file.name.slice(dot).toLowerCase());
};

export interface VideoReading {
  previewUrl: string;
  frames: string[];
  durationSec: number;
  width: number;
  height: number;
  summary: string;
}

const formatBytes = (bytes: number): string => {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const readVideoInBrowser = async (file: Blob & { name: string }): Promise<VideoReading> => {
  if (file.size === 0) throw new UnreadableFileError('The video file is empty.');
  if (file.size > MAX_VIDEO_BYTES) {
    throw new UnreadableFileError(`The video is larger than ${MAX_VIDEO_BYTES / (1024 * 1024)} MB.`);
  }

  if (typeof document === 'undefined' || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
    return {
      previewUrl: `video://${encodeURIComponent(file.name)}`,
      frames: [],
      durationSec: 0,
      width: 0,
      height: 0,
      summary: `${file.name} (${formatBytes(file.size)})`,
    };
  }

  const previewUrl = URL.createObjectURL(file);

  try {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    video.src = previewUrl;

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('VIDEO_TIMEOUT')), 6000);
      video.onloadeddata = () => {
        clearTimeout(timer);
        resolve();
      };
      video.onloadedmetadata = () => {
        if (video.readyState >= 1) {
          clearTimeout(timer);
          resolve();
        }
      };
      video.onerror = () => {
        clearTimeout(timer);
        reject(new Error('VIDEO_DECODE_ERROR'));
      };
    });

    const durationSec = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0;
    const rawW = video.videoWidth || 640;
    const rawH = video.videoHeight || 360;
    const { width, height } = fitWithin(rawW, rawH, MAX_VIDEO_FRAME_EDGE);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    const frames: string[] = [];

    if (ctx) {
      const points = durationSec > 0.6 ? [0.1, 0.5, 0.85].map((p) => p * durationSec) : [0];
      for (const targetTime of points) {
        try {
          if (durationSec > 0) {
            video.currentTime = Math.min(Math.max(0, targetTime), Math.max(0, durationSec - 0.05));
            await new Promise<void>((resolve) => {
              const timer = setTimeout(resolve, 1500);
              video.onseeked = () => {
                clearTimeout(timer);
                resolve();
              };
            });
          }
          ctx.fillStyle = '#000000';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(video, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
          if (dataUrl.startsWith('data:image/jpeg;base64,')) {
            frames.push(dataUrl);
          }
        } catch {
          // Best-effort frame extraction; keep previewUrl even if seeking is unsupported.
        }
      }
    }

    const durationLabel = durationSec > 0 ? `${durationSec.toFixed(1)}s` : formatBytes(file.size);
    return {
      previewUrl,
      frames,
      durationSec,
      width: rawW,
      height: rawH,
      summary: `${rawW}×${rawH} · ${durationLabel} · ${formatBytes(file.size)}`,
    };
  } catch {
    return {
      previewUrl,
      frames: [],
      durationSec: 0,
      width: 0,
      height: 0,
      summary: `${formatBytes(file.size)}`,
    };
  }
};
