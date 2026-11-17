import assert from 'node:assert/strict';
import test from 'node:test';

const { planChangeAction } = await import('../web/src/lib/store/planChange.ts?plan-change=1');
const { disabledBotIdsForPlan, partitionRoomRosterByPlan } = await import(
  '../web/src/lib/store/planLimits.ts?plan-limits=1'
);

test('pro -> free is a plain cancel', () => {
  assert.equal(planChangeAction('pro', 'free'), 'cancel');
});

test('ultra -> free is a plain cancel', () => {
  assert.equal(planChangeAction('ultra', 'free'), 'cancel');
});

test('ultra -> pro needs a fresh pro payment', () => {
  assert.equal(planChangeAction('ultra', 'pro'), 'downgrade-pay');
});

test('free has nothing to downgrade from', () => {
  assert.equal(planChangeAction('free', 'free'), 'invalid');
  assert.equal(planChangeAction('free', 'pro'), 'invalid');
});

test('same plan and unknown targets are invalid', () => {
  assert.equal(planChangeAction('pro', 'pro'), 'invalid');
  assert.equal(planChangeAction('ultra', 'ultra'), 'invalid');
  assert.equal(planChangeAction('pro', 'gold'), 'invalid');
  assert.equal(planChangeAction('pro', ''), 'invalid');
});

test('downgrading or expiring from Pro to Free disables excess bots in account and group chats', () => {
  const bots = [
    { id: 'b1', createdAt: '2026-01-01T00:00:00Z' },
    { id: 'b2', createdAt: '2026-01-02T00:00:00Z' },
    { id: 'b3', createdAt: '2026-01-03T00:00:00Z' },
    { id: 'b4', createdAt: '2026-01-04T00:00:00Z' },
  ];

  // On Pro (maxBots = 6, maxActiveAdvisors = 4): all 4 bots are active in Group Chat
  const disabledPro = disabledBotIdsForPlan(bots, 'pro');
  assert.equal(disabledPro.size, 0);
  const groupPro = partitionRoomRosterByPlan(
    ['bot:b1', 'bot:b2', 'bot:b3', 'bot:b4'],
    'pro',
    disabledPro
  );
  assert.deepEqual(groupPro.activeIds, ['bot:b1', 'bot:b2', 'bot:b3', 'bot:b4']);
  assert.deepEqual(groupPro.disabledIds, []);

  // After cancelling to Free OR 1-month expiry to Free (maxBots = 2, maxActiveAdvisors = 2):
  // b3 & b4 become disabled and silent in Group Chat!
  const disabledFree = disabledBotIdsForPlan(bots, 'free');
  assert.deepEqual([...disabledFree].sort(), ['b3', 'b4']);
  const groupFree = partitionRoomRosterByPlan(
    ['bot:b1', 'bot:b2', 'bot:b3', 'bot:b4'],
    'free',
    disabledFree
  );
  assert.deepEqual(groupFree.activeIds, ['bot:b1', 'bot:b2']);
  assert.deepEqual(groupFree.disabledIds, ['bot:b3', 'bot:b4']);
});
