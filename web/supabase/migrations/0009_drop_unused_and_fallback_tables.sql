-- ============================================================
-- Migration 0009: Drop unused and legacy fallback tables.
-- Keeps active tables:
--   zc_users, zc_orders, zc_coupons, zc_coupon_redemptions,
--   zc_grants, zc_provider_keys, zc_agents, zc_conversations
-- ============================================================

BEGIN;

-- Drop child/unused tables first, then catalog/fallback tables.
-- CASCADE also removes any remaining legacy foreign keys on active tables
-- (e.g. fk_agents_model, fk_conversations_framework, provider FKs).
DROP TABLE IF EXISTS public.zc_message_attachments CASCADE;
DROP TABLE IF EXISTS public.zc_messages CASCADE;
DROP TABLE IF EXISTS public.zc_participants CASCADE;
DROP TABLE IF EXISTS public.zc_agent_tools CASCADE;
DROP TABLE IF EXISTS public.zc_frameworks CASCADE;
DROP TABLE IF EXISTS public.zc_agent_models CASCADE;
DROP TABLE IF EXISTS public.zc_agent_providers CASCADE;
DROP TABLE IF EXISTS public.zc_subscription_plans CASCADE;

COMMIT;
