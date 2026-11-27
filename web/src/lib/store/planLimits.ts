import { planById, type Plan, type PlanId } from '../../prototype/data/plans.ts';

export interface BotLikeForPlan {
  id: string;
  createdAt?: string;
}

/** Returns the active plan's `{ maxActiveAdvisors, maxBots }` limits (defaults to Free). */
export const planLimits = (planId: PlanId | null | undefined): Plan =>
  planById(planId ?? 'free');

/** Deduplicates and trims a raw roster array for plan-limit evaluation. */
export const normalizeRosterIds = (roster: unknown): string[] => {
  if (!Array.isArray(roster)) return [];
  return [
    ...new Set(
      roster
        .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        .map((item) => item.trim())
    ),
  ];
};

/** True when a group conversation roster exceeds the plan's `maxActiveAdvisors` allowance. */
export const isGroupRosterOverPlanLimit = (
  rosterLength: number,
  planId: PlanId | null | undefined
): boolean => rosterLength > planLimits(planId).maxActiveAdvisors;

const normalizeRequestBotId = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith('builtin-')) return null;
  const normalized = trimmed.startsWith('bot:') ? trimmed.slice('bot:'.length).trim() : trimmed;
  return normalized || null;
};

/** Returns every distinct custom bot ID supplied by either request field. */
export const resolveRequestBotIds = (explicitBotId: unknown, turnBotId?: unknown): string[] =>
  [normalizeRequestBotId(explicitBotId), normalizeRequestBotId(turnBotId)].filter(
    (id, index, ids): id is string => Boolean(id) && ids.indexOf(id) === index
  );

/** The bot carried by the actual turn request takes precedence over the legacy explicit field. */
export const resolveRequestBotId = (explicitBotId: unknown, turnBotId?: unknown): string | null => {
  const ids = resolveRequestBotIds(explicitBotId, turnBotId);
  return ids.length > 0 ? ids[ids.length - 1] : null;
};

/**
 * Computes which user-created bots exceed the active plan's `maxBots` allowance.
 * Keeps the earliest-created bots active and marks excess bots disabled (never deleted),
 * so cancelling to Free or letting a 1-month grant expire locks excess bots cleanly until renewal.
 */
export const disabledBotIdsForPlan = (
  bots: readonly BotLikeForPlan[],
  planId: PlanId
): Set<string> => {
  const cap = planById(planId).maxBots;
  if (bots.length <= cap) return new Set();
  const ordered = [...bots].sort((a, b) => {
    const ca = a.createdAt ?? '';
    const cb = b.createdAt ?? '';
    if (ca !== cb) return ca.localeCompare(cb);
    return a.id.localeCompare(b.id);
  });
  return new Set(ordered.slice(cap).map((bot) => bot.id));
};

/** True when `botId` belongs to a user bot locked out by the account's current `maxBots` cap. */
export const isBotDisabledForPlan = (
  botId: string | null | undefined,
  bots: readonly BotLikeForPlan[],
  planId: PlanId | null | undefined
): boolean => {
  if (!botId) return false;
  const normalized = botId.startsWith('bot:') ? botId.slice('bot:'.length) : botId;
  return disabledBotIdsForPlan(bots, planId ?? 'free').has(normalized);
};

const rawBotIdFromPersonaId = (personaId: string): string | null =>
  personaId.startsWith('bot:') ? personaId.slice('bot:'.length) : null;

/**
 * Splits a room's roster into `activeIds` (allowed to speak under `planId`) and `disabledIds`
 * (locked in the room because the user downgraded / expired to a lower tier).
 */
export const partitionRoomRosterByPlan = (
  rosterIds: readonly string[],
  planId: PlanId,
  disabledBotIds: ReadonlySet<string> = new Set()
): { activeIds: string[]; disabledIds: string[] } => {
  const seatCap = planById(planId).maxActiveAdvisors;
  const activeIds: string[] = [];
  const disabledIds: string[] = [];

  for (const personaId of rosterIds) {
    const botId = rawBotIdFromPersonaId(personaId);
    if (botId && disabledBotIds.has(botId)) {
      disabledIds.push(personaId);
      continue;
    }
    if (activeIds.length >= seatCap) {
      disabledIds.push(personaId);
      continue;
    }
    activeIds.push(personaId);
  }

  return { activeIds, disabledIds };
};
