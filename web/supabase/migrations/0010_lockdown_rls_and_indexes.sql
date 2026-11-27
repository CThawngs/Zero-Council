-- ============================================================
-- Migration 0010: Lock down client RLS policies & grants across all
-- 8 active tables, harden handle_new_auth_user() search_path/null-email,
-- and add composite user history indexes.
-- ============================================================

BEGIN;

-- 1. Explicitly drop legacy client-accessible RLS policies on zc_users,
--    zc_agents, and zc_conversations (eliminates P0 self-promotion to admin
--    via PostgREST PATCH on public.zc_users).
DROP POLICY IF EXISTS "Users can read/manage their own profile" ON public.zc_users;

DROP POLICY IF EXISTS "Users can read system presets or own agents" ON public.zc_agents;
DROP POLICY IF EXISTS "Users can modify their own custom agents" ON public.zc_agents;
DROP POLICY IF EXISTS "Users can view agents" ON public.zc_agents;
DROP POLICY IF EXISTS "Users can insert own agents" ON public.zc_agents;
DROP POLICY IF EXISTS "Users can update own agents" ON public.zc_agents;
DROP POLICY IF EXISTS "Users can delete own agents" ON public.zc_agents;

DROP POLICY IF EXISTS "Users can manage conversations they own" ON public.zc_conversations;
DROP POLICY IF EXISTS "Users can view own conversations" ON public.zc_conversations;
DROP POLICY IF EXISTS "Users can create own conversations" ON public.zc_conversations;
DROP POLICY IF EXISTS "Users can update own conversations" ON public.zc_conversations;
DROP POLICY IF EXISTS "Users can delete own conversations" ON public.zc_conversations;

-- 2. Sweep any remaining RLS policies across all 8 active tables, enforce RLS,
--    revoke all table privileges from anon/authenticated, and preserve full
--    service_role access used exclusively by Next.js server stores.
DO $$
DECLARE
  tbl TEXT;
  pol RECORD;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'zc_users',
    'zc_orders',
    'zc_coupons',
    'zc_coupon_redemptions',
    'zc_grants',
    'zc_provider_keys',
    'zc_agents',
    'zc_conversations'
  ]
  LOOP
    IF to_regclass('public.' || tbl) IS NOT NULL THEN
      FOR pol IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'public' AND tablename = tbl
      LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, tbl);
      END LOOP;

      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated', tbl);
      EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role', tbl);
    END IF;
  END LOOP;
END $$;

REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- 3. Harden auth.users -> public.zc_users trigger function with an empty
--    search_path and an explicit NULL / blank email guard.
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF new.email IS NULL OR pg_catalog.btrim(new.email) = '' THEN
    RETURN new;
  END IF;

  INSERT INTO public.zc_users (id, email, role)
  VALUES (new.id, pg_catalog.lower(pg_catalog.btrim(new.email)), 'user')
  ON CONFLICT (email) DO UPDATE
    SET id = EXCLUDED.id;

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- 4. Composite performance indexes for per-user conversation and order listings.
CREATE INDEX IF NOT EXISTS idx_zc_conversations_user_updated
  ON public.zc_conversations (user_email, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_zc_orders_user_created
  ON public.zc_orders (user_email, created_at DESC);

COMMIT;
