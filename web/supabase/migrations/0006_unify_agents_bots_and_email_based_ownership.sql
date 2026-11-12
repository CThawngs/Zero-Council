-- ============================================================
-- Migration: Unify agents and provider keys; use email ownership
-- Filename: 0006_unify_agents_bots_and_email_based_ownership.sql
--
-- Assumptions:
--   * Existing tables and columns match the previous schema.
--   * zc_bots contains no data and can be dropped.
--   * zc_users.email values match existing user ownership records.
--   * zc_agents.system_prompt is the existing instruction content.
--

-- Review existing RLS policies before applying in production.
-- ============================================================

BEGIN;

-- ============================================================
-- 1. ZC_PROVIDER_KEYS
-- One encrypted API key per user and provider.
-- ============================================================

DROP TABLE IF EXISTS public.zc_provider_keys;

CREATE TABLE IF NOT EXISTS public.zc_provider_keys (
    user_email TEXT NOT NULL,
    provider TEXT NOT NULL,
    encrypted_key TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT zc_provider_keys_pkey
        PRIMARY KEY (user_email, provider),

    CONSTRAINT zc_provider_keys_user_email_fkey
        FOREIGN KEY (user_email)
        REFERENCES public.zc_users(email)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT zc_provider_keys_provider_fkey
        FOREIGN KEY (provider)
        REFERENCES public.zc_agent_providers(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

ALTER TABLE public.zc_provider_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own provider keys"
    ON public.zc_provider_keys;

-- API keys are managed by the trusted backend only.
REVOKE ALL ON public.zc_provider_keys FROM anon, authenticated;
GRANT ALL ON public.zc_provider_keys TO service_role;


-- ============================================================
-- 2. ZC_AGENTS
-- Merge the agent schema with the former bot fields.
--
-- Changes:
--   archetype     -> name
--   system_prompt -> instructions
--   user_id       -> user_email
--   model_id      -> provider + model
--   decision_lens -> removed
--
-- zc_bots is empty, so no bot rows need to be migrated.
-- ============================================================

ALTER TABLE public.zc_agents
    RENAME COLUMN archetype TO name;

ALTER TABLE public.zc_agents
    RENAME COLUMN system_prompt TO instructions;

ALTER TABLE public.zc_agents
    ADD COLUMN user_email TEXT,
    ADD COLUMN provider TEXT,
    ADD COLUMN model TEXT;

-- Migrate ownership from the old UUID relationship to email.
UPDATE public.zc_agents AS a
SET user_email = u.email
FROM public.zc_users AS u
WHERE a.user_id = u.id
  AND a.user_email IS NULL;

-- Migrate provider and model from the old model catalog.
UPDATE public.zc_agents AS a
SET
    provider = m.provider_id,
    model = m.id
FROM public.zc_agent_models AS m
WHERE a.model_id = m.id;

-- Remove old foreign keys and columns.
ALTER TABLE public.zc_agents
    DROP CONSTRAINT IF EXISTS zc_agents_user_id_fkey,
    DROP CONSTRAINT IF EXISTS zc_agents_model_id_fkey;

ALTER TABLE public.zc_agents
    DROP COLUMN user_id,
    DROP COLUMN model_id,
    DROP COLUMN decision_lens;

-- name and instructions are required for every agent.
ALTER TABLE public.zc_agents
    ALTER COLUMN name SET NOT NULL,
    ALTER COLUMN instructions SET NOT NULL;

-- Add the new ownership and provider relationships.
ALTER TABLE public.zc_agents
    ADD CONSTRAINT zc_agents_user_email_fkey
        FOREIGN KEY (user_email)
        REFERENCES public.zc_users(email)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    ADD CONSTRAINT zc_agents_provider_fkey
        FOREIGN KEY (provider)
        REFERENCES public.zc_agent_providers(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_zc_agents_user_email
    ON public.zc_agents(user_email);

CREATE INDEX IF NOT EXISTS idx_zc_agents_provider
    ON public.zc_agents(provider);

-- zc_bots has no data and is no longer needed.
DROP TABLE IF EXISTS public.zc_bots;


-- ============================================================
-- 3. ZC_CONVERSATIONS
-- Replace user_id with user_email.
-- ============================================================

ALTER TABLE public.zc_conversations
    ADD COLUMN user_email TEXT;

-- Backfill email using the existing user_id relationship.
UPDATE public.zc_conversations AS c
SET user_email = u.email
FROM public.zc_users AS u
WHERE c.user_id = u.id
  AND c.user_email IS NULL;

-- Set NOT NULL before removing the old ownership column.
ALTER TABLE public.zc_conversations
    ALTER COLUMN user_email SET NOT NULL;

ALTER TABLE public.zc_conversations
    DROP CONSTRAINT IF EXISTS zc_conversations_user_id_fkey;

ALTER TABLE public.zc_conversations
    DROP COLUMN user_id;

ALTER TABLE public.zc_conversations
    ADD CONSTRAINT zc_conversations_user_email_fkey
        FOREIGN KEY (user_email)
        REFERENCES public.zc_users(email)
        ON UPDATE CASCADE
        ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_zc_conversations_user_email
    ON public.zc_conversations(user_email);


-- ============================================================
-- 4. RLS POLICIES
-- Ownership is checked through the authenticated JWT email.
-- ============================================================

-- zc_agents
ALTER TABLE public.zc_agents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view agents"
    ON public.zc_agents;
DROP POLICY IF EXISTS "Users can insert own agents"
    ON public.zc_agents;
DROP POLICY IF EXISTS "Users can update own agents"
    ON public.zc_agents;
DROP POLICY IF EXISTS "Users can delete own agents"
    ON public.zc_agents;

CREATE POLICY "Users can view agents"
ON public.zc_agents
FOR SELECT
TO authenticated
USING (
    user_email IS NULL
    OR user_email = (auth.jwt() ->> 'email')
);

CREATE POLICY "Users can insert own agents"
ON public.zc_agents
FOR INSERT
TO authenticated
WITH CHECK (
    user_email = (auth.jwt() ->> 'email')
);

CREATE POLICY "Users can update own agents"
ON public.zc_agents
FOR UPDATE
TO authenticated
USING (
    user_email = (auth.jwt() ->> 'email')
)
WITH CHECK (
    user_email = (auth.jwt() ->> 'email')
);

CREATE POLICY "Users can delete own agents"
ON public.zc_agents
FOR DELETE
TO authenticated
USING (
    user_email = (auth.jwt() ->> 'email')
);


-- zc_conversations
ALTER TABLE public.zc_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own conversations"
    ON public.zc_conversations;
DROP POLICY IF EXISTS "Users can create own conversations"
    ON public.zc_conversations;
DROP POLICY IF EXISTS "Users can update own conversations"
    ON public.zc_conversations;
DROP POLICY IF EXISTS "Users can delete own conversations"
    ON public.zc_conversations;

CREATE POLICY "Users can view own conversations"
ON public.zc_conversations
FOR SELECT
TO authenticated
USING (
    user_email = (auth.jwt() ->> 'email')
);

CREATE POLICY "Users can create own conversations"
ON public.zc_conversations
FOR INSERT
TO authenticated
WITH CHECK (
    user_email = (auth.jwt() ->> 'email')
);

CREATE POLICY "Users can update own conversations"
ON public.zc_conversations
FOR UPDATE
TO authenticated
USING (
    user_email = (auth.jwt() ->> 'email')
)
WITH CHECK (
    user_email = (auth.jwt() ->> 'email')
);

CREATE POLICY "Users can delete own conversations"
ON public.zc_conversations
FOR DELETE
TO authenticated
USING (
    user_email = (auth.jwt() ->> 'email')
);


-- ============================================================
-- 5. DEPENDENT TABLE RLS
-- These tables continue to reference conversation/message IDs.
-- Ownership is validated through the parent conversation.
-- ============================================================

-- zc_participants
ALTER TABLE public.zc_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage conversation participants"
    ON public.zc_participants;

CREATE POLICY "Users can manage conversation participants"
ON public.zc_participants
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.zc_conversations AS c
        WHERE c.id = zc_participants.conversation_id
          AND c.user_email = (auth.jwt() ->> 'email')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.zc_conversations AS c
        WHERE c.id = zc_participants.conversation_id
          AND c.user_email = (auth.jwt() ->> 'email')
    )
);


-- zc_messages
ALTER TABLE public.zc_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage conversation messages"
    ON public.zc_messages;

CREATE POLICY "Users can manage conversation messages"
ON public.zc_messages
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.zc_conversations AS c
        WHERE c.id = zc_messages.conversation_id
          AND c.user_email = (auth.jwt() ->> 'email')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.zc_conversations AS c
        WHERE c.id = zc_messages.conversation_id
          AND c.user_email = (auth.jwt() ->> 'email')
    )
);


-- zc_message_attachments
ALTER TABLE public.zc_message_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage message attachments"
    ON public.zc_message_attachments;

CREATE POLICY "Users can manage message attachments"
ON public.zc_message_attachments
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.zc_messages AS m
        INNER JOIN public.zc_conversations AS c
            ON c.id = m.conversation_id
        WHERE m.id = zc_message_attachments.message_id
          AND c.user_email = (auth.jwt() ->> 'email')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.zc_messages AS m
        INNER JOIN public.zc_conversations AS c
            ON c.id = m.conversation_id
        WHERE m.id = zc_message_attachments.message_id
          AND c.user_email = (auth.jwt() ->> 'email')
    )
);

COMMIT;
