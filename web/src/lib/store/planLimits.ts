import { planById, type PlanId } from '../../prototype/data/plans.ts';

export interface BotLikeForPlan {
  id: string;
  createdAt?: string;
}

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

export const rawBotIdFromPersonaId = (personaId: string): string | null =>
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
