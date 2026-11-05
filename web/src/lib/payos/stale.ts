/**
 * Purge rule for the order store. Only successful transactions are kept: an order
 * that is still unpaid five minutes after its QR was shown, or one the gateway
 * reported as failed, is deleted outright instead of being left in a terminal
 * state. A payOS webhook that arrives after the row is gone gets a 404 and grants
 * nothing — that race is accepted, because keeping expired rows forever is worse.
 */
export const ORDER_TTL_MS = 5 * 60 * 1000;

export const isStaleOrder = (status: string, createdAt: string, now: number): boolean => {
  if (status === 'PAID') return false;
  if (status === 'FAILED' || status === 'EXPIRED') return true;
  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) return true;
  return now - created > ORDER_TTL_MS;
};
