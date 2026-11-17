-- ============================================================
-- Migration 0008: Complete service_role grants, 3-provider BYOK
-- constraints (openai, anthropic, google), and conversation metadata.
-- ============================================================

BEGIN;

-- 1. Drop legacy inline CHECK constraint from 0004_zc_provider_keys.sql
--    that restricted provider to ('anthropic', 'openai') and blocked 'google'.
DO $$
DECLARE
  con RECORD;
BEGIN
  FOR con IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND t.relname = 'zc_provider_keys'
      AND c.contype = 'c'
  LOOP
    EXECUTE format('ALTER TABLE public.zc_provider_keys DROP CONSTRAINT IF EXISTS %I', con.conname);
  END LOOP;
END $$;

-- 2. Seed core providers and deliberation frameworks idempotently so
--    foreign keys on zc_provider_keys, zc_agents, and zc_conversations
--    always succeed on fresh `supabase db push` without manual seed scripts.
INSERT INTO public.zc_agent_providers (id, name)
VALUES
  ('openai', 'OpenAI'),
  ('anthropic', 'Anthropic'),
  ('google', 'Google')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

INSERT INTO public.zc_frameworks (id, name, description, system_instruction)
VALUES
  ('scenarios', 'Good / Normal / Bad Scenarios', 'Explore best, expected, and worst case outcomes', 'Analyze the dilemma into three distinct probability branches: good, normal, and bad.'),
  ('hats', 'Six Thinking Hats', 'De Bono thinking hats method', 'Deconstruct perspectives across analytical, emotional, critical, and optimistic lenses.'),
  ('matrix', 'Decision Matrix', 'Weighted multi-criteria decision matrix', 'Score and evaluate alternatives across explicit weighted criteria.')
ON CONFLICT (id) DO NOTHING;

-- 3. Add structured metadata columns to zc_conversations and zc_messages
--    so full council sessions (rounds, advisor snapshots, scenario branches,
--    and preset/bot speaker handles) round-trip without lossy schema hacks.
ALTER TABLE public.zc_conversations
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.zc_messages
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 4. Grant full DML privileges on all zc_* application tables to service_role.
--    0007 only granted SELECT on zc_agents and SELECT/INSERT on zc_users,
--    which caused server-side CRUD on bots, keys, and conversations to fail.
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'zc_users',
    'zc_orders',
    'zc_coupons',
    'zc_coupon_redemptions',
    'zc_plan_grants',
    'zc_subscription_plans',
    'zc_agent_providers',
    'zc_agent_models',
    'zc_frameworks',
    'zc_provider_keys',
    'zc_agents',
    'zc_agent_tools',
    'zc_conversations',
    'zc_participants',
    'zc_messages',
    'zc_message_attachments'
  ]
  LOOP
    IF to_regclass('public.' || tbl) IS NOT NULL THEN
      EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role', tbl);
    END IF;
  END LOOP;
END $$;

COMMIT;
