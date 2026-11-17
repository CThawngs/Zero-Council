-- ============================================================
-- Migration 0008: Complete service_role grants (including zc_grants),
-- 8 built-in BYOK providers + custom OpenAI/Anthropic provider columns,
-- relaxed provider FKs for custom endpoints, and conversation metadata.
-- ============================================================

BEGIN;

-- 1. Drop legacy inline CHECK constraints on zc_provider_keys and zc_agents
--    that restricted provider to ('anthropic', 'openai').
DO $$
DECLARE
  con RECORD;
BEGIN
  FOR con IN
    SELECT t.relname AS tbl, c.conname
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND t.relname IN ('zc_provider_keys', 'zc_agents')
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%provider%'
  LOOP
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I', con.tbl, con.conname);
  END LOOP;
END $$;

-- 2. Drop strict provider foreign keys on zc_provider_keys and zc_agents so
--    user-defined custom OpenAI/Anthropic-compatible provider IDs (custom:...)
--    persist cleanly alongside built-in providers.
ALTER TABLE public.zc_provider_keys
  DROP CONSTRAINT IF EXISTS fk_zc_provider_keys_provider,
  DROP CONSTRAINT IF EXISTS zc_provider_keys_provider_fkey;

ALTER TABLE public.zc_agents
  DROP CONSTRAINT IF EXISTS fk_zc_agents_provider,
  DROP CONSTRAINT IF EXISTS zc_agents_provider_fkey;

-- 3. Add provider metadata columns for custom standards & model lists.
ALTER TABLE public.zc_provider_keys
  ADD COLUMN IF NOT EXISTS label TEXT,
  ADD COLUMN IF NOT EXISTS protocol TEXT,
  ADD COLUMN IF NOT EXISTS base_url TEXT,
  ADD COLUMN IF NOT EXISTS models JSONB NOT NULL DEFAULT '[]'::jsonb;

-- 4. Seed all 8 verified built-in providers and deliberation frameworks idempotently.
INSERT INTO public.zc_agent_providers (id, name)
VALUES
  ('anthropic', 'Anthropic'),
  ('openai', 'OpenAI'),
  ('google', 'Google Gemini'),
  ('groq', 'Groq'),
  ('xai', 'xAI (Grok)'),
  ('openrouter', 'OpenRouter'),
  ('nvidia', 'NVIDIA NIM'),
  ('deepseek', 'DeepSeek')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

INSERT INTO public.zc_frameworks (id, name, description, system_instruction)
VALUES
  ('scenarios', 'Good / Normal / Bad Scenarios', 'Explore best, expected, and worst case outcomes', 'Analyze the dilemma into three distinct probability branches: good, normal, and bad.'),
  ('hats', 'Six Thinking Hats', 'De Bono thinking hats method', 'Deconstruct perspectives across analytical, emotional, critical, and optimistic lenses.'),
  ('matrix', 'Decision Matrix', 'Weighted multi-criteria decision matrix', 'Score and evaluate alternatives across explicit weighted criteria.')
ON CONFLICT (id) DO NOTHING;

-- 5. Add structured metadata columns to zc_conversations and zc_messages
--    so solo bot threads, group chats, council sessions, and attachments round-trip cleanly.
ALTER TABLE public.zc_conversations
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.zc_messages
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 6. Grant full DML privileges on all zc_* application tables to service_role
--    (including zc_grants used by account.ts for 1-month subscriptions & cancellation).
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'zc_users',
    'zc_orders',
    'zc_coupons',
    'zc_coupon_redemptions',
    'zc_grants',
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

-- Grant sequence privileges for identity/serial primary keys (e.g. zc_grants.id)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

COMMIT;
