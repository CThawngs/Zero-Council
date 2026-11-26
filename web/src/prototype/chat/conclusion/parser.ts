/**
 * Resilient JSON and partial-stream parser for AI Chair conclusion payloads.
 *
 * Handles fenced JSON blocks, trailing commas, unescaped newlines inside string literals, and
 * truncated model outputs so raw JSON markup never leaks into the user-visible conclusion view.
 */

import type { AdvisorPersona, Language, ScenarioBranch } from '../../types.ts';
import type { ConclusionAnalysis } from './types.ts';
import { analystSubtitle } from './transcript.ts';

const cleanString = (val: unknown, fallback: string): string =>
  typeof val === 'string' && val.trim().length > 0 ? val.trim() : fallback;

const cleanActions = (val: unknown, fallback: string[]): string[] => {
  if (!Array.isArray(val)) return fallback;
  const items = val
    .filter((item): item is string => typeof item === 'string')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return items.length > 0 ? items : fallback;
};

const stripCodeFences = (text: string): string => {
  const trimmed = text.trim();
  const closed = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (closed) return closed[1].trim();
  const opened = trimmed.match(/```(?:json)?\s*([\s\S]*)$/i);
  if (opened) return opened[1].trim();
  return trimmed;
};

const looksLikeJsonPayload = (text: string): boolean => {
  const stripped = stripCodeFences(text);
  if (/^\s*[\[{]/.test(stripped)) return true;
  return /"(?:summary|dissent|recommendation|scenarios)"\s*:/.test(stripped);
};

const sanitizeJsonText = (input: string): string => {
  let out = '';
  let inString = false;
  let escaped = false;
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (inString) {
      if (escaped) {
        out += ch;
        escaped = false;
      } else if (ch === '\\') {
        out += ch;
        escaped = true;
      } else if (ch === '"') {
        out += ch;
        inString = false;
      } else if (ch === '\n') {
        out += '\\n';
      } else if (ch === '\r') {
        out += '\\r';
      } else if (ch === '\t') {
        out += '\\t';
      } else {
        out += ch;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      out += ch;
      continue;
    }
    if (ch === ',') {
      let nextIdx = i + 1;
      while (nextIdx < input.length && /\s/.test(input[nextIdx])) nextIdx += 1;
      if (input[nextIdx] === '}' || input[nextIdx] === ']') continue;
    }
    out += ch;
  }
  return out;
};

const readJsonStringToken = (
  text: string,
  quoteIndex: number
): { value: string; nextIndex: number; closed: boolean } => {
  let out = '';
  let i = quoteIndex + 1;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '"') {
      return { value: out, nextIndex: i + 1, closed: true };
    }
    if (ch === '\\') {
      if (i + 1 >= text.length) break;
      const esc = text[i + 1];
      switch (esc) {
        case 'n':
          out += '\n';
          i += 2;
          break;
        case 'r':
          out += '\r';
          i += 2;
          break;
        case 't':
          out += '\t';
          i += 2;
          break;
        case 'b':
          out += '\b';
          i += 2;
          break;
        case 'f':
          out += '\f';
          i += 2;
          break;
        case '"':
          out += '"';
          i += 2;
          break;
        case '\\':
          out += '\\';
          i += 2;
          break;
        case '/':
          out += '/';
          i += 2;
          break;
        case 'u': {
          const hex = text.slice(i + 2, i + 6);
          if (/^[0-9a-fA-F]{4}$/.test(hex)) {
            out += String.fromCharCode(parseInt(hex, 16));
            i += 6;
          } else {
            i = text.length;
          }
          break;
        }
        default:
          out += esc;
          i += 2;
      }
    } else {
      out += ch;
      i += 1;
    }
  }
  return { value: out, nextIndex: text.length, closed: false };
};

const jsonObjectSlice = (raw: string): string => {
  const stripped = stripCodeFences(raw);
  const firstBrace = stripped.indexOf('{');
  return firstBrace === -1 ? stripped : stripped.slice(firstBrace);
};

const findJsonPropertyValueStart = (
  jsonSlice: string,
  key: string,
  targetDepth?: number
): number => {
  let depth = 0;
  let i = 0;
  while (i < jsonSlice.length) {
    const ch = jsonSlice[i];
    if (ch === '{' || ch === '[') {
      depth += 1;
      i += 1;
    } else if (ch === '}' || ch === ']') {
      depth = Math.max(0, depth - 1);
      i += 1;
    } else if (ch === '"') {
      const decoded = readJsonStringToken(jsonSlice, i);
      i = decoded.nextIndex;
      if (
        decoded.closed &&
        decoded.value === key &&
        (targetDepth === undefined || depth === targetDepth)
      ) {
        let j = i;
        while (j < jsonSlice.length && /\s/.test(jsonSlice[j])) j += 1;
        if (jsonSlice[j] === ':') {
          j += 1;
          while (j < jsonSlice.length && /\s/.test(jsonSlice[j])) j += 1;
          return j;
        }
      }
    } else {
      i += 1;
    }
  }
  return -1;
};

const extractJsonStringField = (
  jsonSlice: string,
  key: string,
  targetDepth?: number
): string | null => {
  const valStart = findJsonPropertyValueStart(jsonSlice, key, targetDepth);
  if (valStart === -1 || jsonSlice[valStart] !== '"') return null;
  const { value } = readJsonStringToken(jsonSlice, valStart);
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const extractJsonStringArrayField = (
  jsonSlice: string,
  key: string,
  targetDepth?: number
): string[] | null => {
  const valStart = findJsonPropertyValueStart(jsonSlice, key, targetDepth);
  if (valStart === -1 || jsonSlice[valStart] !== '[') return null;
  const items: string[] = [];
  let i = valStart + 1;
  while (i < jsonSlice.length) {
    const ch = jsonSlice[i];
    if (ch === ']') break;
    if (ch === '"') {
      const token = readJsonStringToken(jsonSlice, i);
      const item = token.value.trim();
      if (item.length > 0) items.push(item);
      i = token.nextIndex;
    } else {
      i += 1;
    }
  }
  return items.length > 0 ? items : null;
};

const tryParseLenientJson = (raw: string): Record<string, unknown> | null => {
  const stripped = stripCodeFences(raw);
  const firstBrace = stripped.indexOf('{');
  const lastBrace = stripped.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace <= firstBrace) return null;

  const candidate = stripped.slice(firstBrace, lastBrace + 1);
  for (const text of [candidate, sanitizeJsonText(candidate)]) {
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // Try sanitized candidate next.
    }
  }
  return null;
};

/**
 * Ensures the summary rendered in `SessionConcludedView` is plain readable prose, unwrapping
 * nested or truncated JSON payloads so raw braces/keys never leak into the UI.
 */
export const extractReadableSummary = (
  raw: unknown,
  fallbackSummary = ''
): string => {
  let current = typeof raw === 'string' ? raw.trim() : '';
  for (let depth = 0; depth < 3; depth += 1) {
    if (!current) return fallbackSummary;
    if (!looksLikeJsonPayload(current)) return current;

    const parsed = tryParseLenientJson(current);
    if (parsed && typeof parsed.summary === 'string' && parsed.summary.trim().length > 0) {
      current = parsed.summary.trim();
      continue;
    }

    const slice = jsonObjectSlice(current);
    const extracted =
      extractJsonStringField(slice, 'summary', 1) ??
      extractJsonStringField(slice, 'summary');
    if (extracted) {
      current = extracted;
      continue;
    }

    return fallbackSummary;
  }
  return looksLikeJsonPayload(current) ? fallbackSummary : current;
};

const sanitizePlainField = (val: unknown, fallback: string): string => {
  const cleaned = cleanString(val, fallback);
  return looksLikeJsonPayload(cleaned) ? fallback : cleaned;
};

const extractPartialBranch = (
  jsonSlice: string,
  branchKey: 'good' | 'normal' | 'bad',
  subtitle: string,
  fbBranch: ScenarioBranch
): ScenarioBranch => {
  const start = findJsonPropertyValueStart(jsonSlice, branchKey, 2);
  if (start === -1 || jsonSlice[start] !== '{') {
    return { ...fbBranch, subtitle };
  }
  const branchSlice = jsonSlice.slice(start);
  return {
    title: extractJsonStringField(branchSlice, 'title', 1) ?? fbBranch.title,
    subtitle,
    description:
      extractJsonStringField(branchSlice, 'description', 1) ?? fbBranch.description,
    actions: extractJsonStringArrayField(branchSlice, 'actions', 1) ?? fbBranch.actions,
  };
};

/** Parses raw LLM conclusion text into a normalized `ConclusionAnalysis` object. */
export const parseConclusionResponse = (
  rawText: string,
  fallback: ConclusionAnalysis,
  analyst: AdvisorPersona,
  language: Language
): ConclusionAnalysis => {
  const trimmed = (rawText ?? '').trim();
  if (!trimmed) return fallback;

  const subtitle = analystSubtitle(analyst, language);
  const parsed = tryParseLenientJson(trimmed);

  if (parsed) {
    const rawScenarios =
      parsed.scenarios && typeof parsed.scenarios === 'object'
        ? (parsed.scenarios as Record<string, unknown>)
        : {};

    const parseBranch = (
      rawBranch: unknown,
      fbBranch: ScenarioBranch
    ): ScenarioBranch => {
      const b =
        rawBranch && typeof rawBranch === 'object'
          ? (rawBranch as Record<string, unknown>)
          : {};
      return {
        title: cleanString(b.title, fbBranch.title),
        subtitle,
        description: cleanString(b.description, fbBranch.description),
        actions: cleanActions(b.actions, fbBranch.actions),
      };
    };

    return {
      analyst,
      chair: {
        summary: extractReadableSummary(parsed.summary, fallback.chair.summary),
        dissent: sanitizePlainField(parsed.dissent, fallback.chair.dissent),
        recommendation: sanitizePlainField(
          parsed.recommendation,
          fallback.chair.recommendation
        ),
      },
      scenarios: {
        good: parseBranch(rawScenarios.good, fallback.scenarios.good),
        normal: parseBranch(rawScenarios.normal, fallback.scenarios.normal),
        bad: parseBranch(rawScenarios.bad, fallback.scenarios.bad),
      },
    };
  }

  if (looksLikeJsonPayload(trimmed)) {
    const slice = jsonObjectSlice(trimmed);
    const extractedDissent =
      extractJsonStringField(slice, 'dissent', 1) ?? fallback.chair.dissent;
    const extractedRecommendation =
      extractJsonStringField(slice, 'recommendation', 1) ??
      fallback.chair.recommendation;

    return {
      analyst,
      chair: {
        summary: extractReadableSummary(trimmed, fallback.chair.summary),
        dissent: sanitizePlainField(extractedDissent, fallback.chair.dissent),
        recommendation: sanitizePlainField(
          extractedRecommendation,
          fallback.chair.recommendation
        ),
      },
      scenarios: {
        good: extractPartialBranch(slice, 'good', subtitle, fallback.scenarios.good),
        normal: extractPartialBranch(slice, 'normal', subtitle, fallback.scenarios.normal),
        bad: extractPartialBranch(slice, 'bad', subtitle, fallback.scenarios.bad),
      },
    };
  }

  return {
    ...fallback,
    analyst,
    chair: {
      ...fallback.chair,
      summary: trimmed,
    },
  };
};
