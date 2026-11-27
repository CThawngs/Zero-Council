/**
 * Live AI Chair conclusion orchestrator and public barrel for conclusion helpers.
 *
 * Submodules under `./conclusion/`:
 * - `types.ts`: `ConclusionAnalysis` & `ConclusionAnalysisError`
 * - `transcript.ts`: analyst selection, transcript extraction, fallback synthesis
 * - `prompts.ts`: bilingual Chair synthesis prompt builder
 * - `parser.ts`: resilient JSON & truncated-stream parser
 */

import {
  classifyTurnFailureReason,
  type ChatMessage,
} from './engine.ts';
import { completeByokText } from './byok.ts';
import type {
  AdvisorPersona,
  ApiKeyConfig,
  Language,
} from '../types.ts';
import type { Contribution } from '../../lib/deliberation/types.ts';
import {
  ConclusionAnalysisError,
  type ConclusionAnalysis,
} from './conclusion/types.ts';
import {
  buildFallbackConclusion,
  extractChatTranscriptAndContributions,
  pickConclusionAnalyst,
} from './conclusion/transcript.ts';
import { buildConclusionPrompt } from './conclusion/prompts.ts';
import { parseConclusionResponse } from './conclusion/parser.ts';

export {
  ConclusionAnalysisError,
  type ConclusionAnalysis,
} from './conclusion/types.ts';

export {
  matchPersonaId,
  pickConclusionAnalyst,
  extractChatTranscriptAndContributions,
  analystSubtitle,
  buildFallbackConclusion,
} from './conclusion/transcript.ts';

export { buildConclusionPrompt } from './conclusion/prompts.ts';

export {
  extractReadableSummary,
  parseConclusionResponse,
} from './conclusion/parser.ts';

/** Runs live AI Chair synthesis over a room's transcript to produce Good/Normal/Bad scenarios. */
export const analyzeChatRoomConclusion = async (params: {
  topic: string;
  messages: ChatMessage[];
  seated: AdvisorPersona[];
  allPersonas: AdvisorPersona[];
  apiKeys: ApiKeyConfig[];
  keys: Record<string, string>;
  language: Language;
  signal?: AbortSignal;
  completeFn?: typeof completeByokText;
}): Promise<{
  analysis: ConclusionAnalysis;
  contributions: Contribution[];
}> => {
  const {
    topic,
    messages,
    seated,
    allPersonas,
    apiKeys,
    keys,
    language,
    signal,
    completeFn = completeByokText,
  } = params;

  const { analyst, keyMeta, apiKey, model } = pickConclusionAnalyst(seated, apiKeys, keys, language);
  const { transcript, contributions } = extractChatTranscriptAndContributions(
    messages,
    seated,
    allPersonas,
    language
  );
  const fallback = buildFallbackConclusion(topic, messages, seated, analyst, language);

  const hasConnectedKey =
    Boolean(keyMeta) && (Boolean(apiKey) || (Boolean(keyMeta?.hasKey) && completeFn !== completeByokText));
  if (!keyMeta || !hasConnectedKey) {
    throw new ConclusionAnalysisError(
      'missing-key',
      'PROVIDER_NOT_CONNECTED',
      { provider: analyst.provider, model }
    );
  }

  let rawText: string;
  try {
    const { system, prompt } = buildConclusionPrompt(topic, transcript, analyst, language);
    rawText = await completeFn(
      {
        provider: keyMeta.provider,
        model,
        apiKey: apiKey ?? '',
        protocol: keyMeta.protocol,
        baseUrl: keyMeta.baseUrl,
      },
      {
        system,
        prompt,
        maxTokens: 3000,
        signal,
      }
    );
  } catch (err) {
    if (signal?.aborted || (err as { name?: string } | null)?.name === 'DeliberationCancelled') {
      throw err;
    }
    const detail = err instanceof Error ? err.message : String(err);
    throw new ConclusionAnalysisError(classifyTurnFailureReason(detail), detail, {
      provider: keyMeta.provider,
      model,
    });
  }

  if (!rawText || !rawText.trim()) {
    throw new ConclusionAnalysisError('provider-error', 'EMPTY_CONCLUSION_RESPONSE', {
      provider: keyMeta.provider,
      model,
    });
  }

  const analysis = parseConclusionResponse(rawText, fallback, analyst, language);

  const finalContributions: Contribution[] =
    contributions.length > 0
      ? contributions
      : [
          {
            advisorId: analyst.id,
            text: analysis.chair.summary,
            rebuts: null,
            buildsOn: null,
          },
        ];

  return {
    analysis,
    contributions: finalContributions,
  };
};
