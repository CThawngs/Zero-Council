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
-- ============================================================

BEGIN;

-- ============================================================
-- 0. PREPARATION: Seed standard providers if missing
-- Ensures FK from zc_provider_keys and zc_agents does not fail
-- ============================================================
INSERT INTO public.zc_agent_providers (id, name)
VALUES 
    ('openai', 'OpenAI'),
    ('anthropic', 'Anthropic')
ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- 1. DROP DEPENDENT RLS POLICIES FIRST
-- PostgreSQL prevents dropping columns (user_id) if policies depend on them.
-- ============================================================

-- Policies depending on zc_agents.user_id
DROP POLICY IF EXISTS "Users can read system presets or own agents" ON public.zc_agents;
DROP POLICY IF EXISTS "Users can modify their own custom agents" ON public.zc_agents;
DROP POLICY IF EXISTS "Users can view agents" ON public.zc_agents;
DROP POLICY IF EXISTS "Users can insert own agents" ON public.zc_agents;
DROP POLICY IF EXISTS "Users can update own agents" ON public.zc_agents;
DROP POLICY IF EXISTS "Users can delete own agents" ON public.zc_agents;

-- Policies depending on zc_conversations.user_id (direct or through subqueries)
DROP POLICY IF EXISTS "Users can manage attachments in their conversation messages" ON public.zc_message_attachments;
DROP POLICY IF EXISTS "Users can manage message attachments" ON public.zc_message_attachments;

DROP POLICY IF EXISTS "Users can view and write messages in their conversations" ON public.zc_messages;
DROP POLICY IF EXISTS "Users can manage conversation messages" ON public.zc_messages;

DROP POLICY IF EXISTS "Users can manage participants of their conversations" ON public.zc_participants;
DROP POLICY IF EXISTS "Users can manage conversation participants" ON public.zc_participants;

DROP POLICY IF EXISTS "Users can manage conversations they own" ON public.zc_conversations;
DROP POLICY IF EXISTS "Users can view own conversations" ON public.zc_conversations;
DROP POLICY IF EXISTS "Users can create own conversations" ON public.zc_conversations;
DROP POLICY IF EXISTS "Users can update own conversations" ON public.zc_conversations;
DROP POLICY IF EXISTS "Users can delete own conversations" ON public.zc_conversations;


-- ============================================================
-- 2. ZC_PROVIDER_KEYS
-- Migrate schema cleanly without losing existing keys.
-- ============================================================

DROP TABLE IF EXISTS public.zc_users_api_keys;

CREATE TABLE IF NOT EXISTS public.zc_provider_keys (
    user_email TEXT NOT NULL,
    provider TEXT NOT NULL,
    model TEXT NOT NULL DEFAULT '',
    encrypted_key TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT pk_zc_provider_keys PRIMARY KEY (user_email, provider)
);

-- If table already existed (from 0004), add missing columns safely
ALTER TABLE public.zc_provider_keys
    ADD COLUMN IF NOT EXISTS model TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Re-establish constraints cleanly
ALTER TABLE public.zc_provider_keys
    DROP CONSTRAINT IF EXISTS fk_zc_provider_keys_user_email,
    DROP CONSTRAINT IF EXISTS fk_zc_provider_keys_provider,
    DROP CONSTRAINT IF EXISTS zc_provider_keys_user_email_fkey,
    DROP CONSTRAINT IF EXISTS zc_provider_keys_provider_fkey;

ALTER TABLE public.zc_provider_keys
    ADD CONSTRAINT fk_zc_provider_keys_user_email
        FOREIGN KEY (user_email)
        REFERENCES public.zc_users(email)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    ADD CONSTRAINT fk_zc_provider_keys_provider
        FOREIGN KEY (provider)
        REFERENCES public.zc_agent_providers(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT;

ALTER TABLE public.zc_provider_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own provider keys" ON public.zc_provider_keys;

-- API keys are managed by the trusted backend only.
REVOKE ALL ON public.zc_provider_keys FROM anon, authenticated;
GRANT ALL ON public.zc_provider_keys TO service_role;


-- ============================================================
-- 3. ZC_AGENTS
-- Merge the agent schema with the former bot fields.
-- ============================================================

-- Rename columns if they exist under old names
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'zc_agents' AND column_name = 'archetype'
  ) THEN
    ALTER TABLE public.zc_agents RENAME COLUMN archetype TO name;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'zc_agents' AND column_name = 'system_prompt'
  ) THEN
    ALTER TABLE public.zc_agents RENAME COLUMN system_prompt TO instruction;
  END IF;
END $$;

ALTER TABLE public.zc_agents
    ADD COLUMN IF NOT EXISTS user_email TEXT,
    ADD COLUMN IF NOT EXISTS provider TEXT,
    ADD COLUMN IF NOT EXISTS model TEXT;

-- Migrate ownership from old UUID relationship to email
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'zc_agents' AND column_name = 'user_id'
  ) THEN
    UPDATE public.zc_agents AS a
    SET user_email = u.email
    FROM public.zc_users AS u
    WHERE a.user_id = u.id
      AND a.user_email IS NULL;
  END IF;
END $$;

-- Migrate provider and model from the old model catalog if model_id still exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'zc_agents' AND column_name = 'model_id'
  ) THEN
    UPDATE public.zc_agents AS a
    SET
        provider = m.provider_id,
        model = m.id
    FROM public.zc_agent_models AS m
    WHERE a.model_id = m.id
      AND a.model IS NULL;
  END IF;
END $$;

-- Remove old foreign keys and columns
ALTER TABLE public.zc_agents
    DROP CONSTRAINT IF EXISTS fk_agents_user,
    DROP CONSTRAINT IF EXISTS fk_agents_model,
    DROP CONSTRAINT IF EXISTS zc_agents_user_id_fkey,
    DROP CONSTRAINT IF EXISTS zc_agents_model_id_fkey;

ALTER TABLE public.zc_agents
    DROP COLUMN IF EXISTS user_id,
    DROP COLUMN IF EXISTS model_id,
    DROP COLUMN IF EXISTS decision_lens;

-- Backfill any null names or instructions before setting NOT NULL
UPDATE public.zc_agents SET name = 'Unnamed Agent' WHERE name IS NULL;
UPDATE public.zc_agents SET instruction = '' WHERE instruction IS NULL;

ALTER TABLE public.zc_agents
    ALTER COLUMN name SET NOT NULL,
    ALTER COLUMN instruction SET NOT NULL;

-- Add new ownership and provider relationships
ALTER TABLE public.zc_agents
    DROP CONSTRAINT IF EXISTS fk_zc_agents_user_email,
    DROP CONSTRAINT IF EXISTS fk_zc_agents_provider;

ALTER TABLE public.zc_agents
    ADD CONSTRAINT fk_zc_agents_user_email
        FOREIGN KEY (user_email)
        REFERENCES public.zc_users(email)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    ADD CONSTRAINT fk_zc_agents_provider
        FOREIGN KEY (provider)
        REFERENCES public.zc_agent_providers(id)
        ON UPDATE CASCADE
        ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_zc_agents_user_email
    ON public.zc_agents(user_email);

CREATE INDEX IF NOT EXISTS idx_zc_agents_provider
    ON public.zc_agents(provider);

-- zc_bots is dropped as its logic is now merged into zc_agents
DROP TABLE IF EXISTS public.zc_bots;


-- ============================================================
-- 4. ZC_CONVERSATIONS
-- Replace user_id with user_email.
-- ============================================================

ALTER TABLE public.zc_conversations
    ADD COLUMN IF NOT EXISTS user_email TEXT;

-- Backfill email using existing user_id relationship if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'zc_conversations' AND column_name = 'user_id'
  ) THEN
    UPDATE public.zc_conversations AS c
    SET user_email = u.email
    FROM public.zc_users AS u
    WHERE c.user_id = u.id
      AND c.user_email IS NULL;
  END IF;
END $$;

-- Clean up any orphaned conversations or set fallback before NOT NULL
DELETE FROM public.zc_conversations WHERE user_email IS NULL;

ALTER TABLE public.zc_conversations
    ALTER COLUMN user_email SET NOT NULL;

ALTER TABLE public.zc_conversations
    DROP CONSTRAINT IF EXISTS fk_conversations_user,
    DROP CONSTRAINT IF EXISTS fk_zc_conversations_user_id,
    DROP CONSTRAINT IF EXISTS zc_conversations_user_id_fkey;

ALTER TABLE public.zc_conversations
    DROP COLUMN IF EXISTS user_id;

ALTER TABLE public.zc_conversations
    DROP CONSTRAINT IF EXISTS fk_zc_conversations_user_email;

ALTER TABLE public.zc_conversations
    ADD CONSTRAINT fk_zc_conversations_user_email
        FOREIGN KEY (user_email)
        REFERENCES public.zc_users(email)
        ON UPDATE CASCADE
        ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_zc_conversations_user_email
    ON public.zc_conversations(user_email);


-- ============================================================
-- 5. RE-APPLY RLS POLICIES (EMAIL BASED)
-- ============================================================

-- zc_agents
ALTER TABLE public.zc_agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view agents"
ON public.zc_agents
FOR SELECT
TO authenticated
USING (
    user_email IS NULL
    OR lower(user_email) = lower(auth.jwt() ->> 'email')
);

CREATE POLICY "Users can insert own agents"
ON public.zc_agents
FOR INSERT
TO authenticated
WITH CHECK (
    lower(user_email) = lower(auth.jwt() ->> 'email')
);

CREATE POLICY "Users can update own agents"
ON public.zc_agents
FOR UPDATE
TO authenticated
USING (
    lower(user_email) = lower(auth.jwt() ->> 'email')
)
WITH CHECK (
    lower(user_email) = lower(auth.jwt() ->> 'email')
);

CREATE POLICY "Users can delete own agents"
ON public.zc_agents
FOR DELETE
TO authenticated
USING (
    lower(user_email) = lower(auth.jwt() ->> 'email')
);


-- zc_conversations
ALTER TABLE public.zc_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own conversations"
ON public.zc_conversations
FOR SELECT
TO authenticated
USING (
    lower(user_email) = lower(auth.jwt() ->> 'email')
);

CREATE POLICY "Users can create own conversations"
ON public.zc_conversations
FOR INSERT
TO authenticated
WITH CHECK (
    lower(user_email) = lower(auth.jwt() ->> 'email')
);

CREATE POLICY "Users can update own conversations"
ON public.zc_conversations
FOR UPDATE
TO authenticated
USING (
    lower(user_email) = lower(auth.jwt() ->> 'email')
)
WITH CHECK (
    lower(user_email) = lower(auth.jwt() ->> 'email')
);

CREATE POLICY "Users can delete own conversations"
ON public.zc_conversations
FOR DELETE
TO authenticated
USING (
    lower(user_email) = lower(auth.jwt() ->> 'email')
);


-- zc_participants
ALTER TABLE public.zc_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage conversation participants"
ON public.zc_participants
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.zc_conversations AS c
        WHERE c.id = zc_participants.conversation_id
          AND lower(c.user_email) = lower(auth.jwt() ->> 'email')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.zc_conversations AS c
        WHERE c.id = zc_participants.conversation_id
          AND lower(c.user_email) = lower(auth.jwt() ->> 'email')
    )
);


-- zc_messages
ALTER TABLE public.zc_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage conversation messages"
ON public.zc_messages
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.zc_conversations AS c
        WHERE c.id = zc_messages.conversation_id
          AND lower(c.user_email) = lower(auth.jwt() ->> 'email')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.zc_conversations AS c
        WHERE c.id = zc_messages.conversation_id
          AND lower(c.user_email) = lower(auth.jwt() ->> 'email')
    )
);


-- zc_message_attachments
ALTER TABLE public.zc_message_attachments ENABLE ROW LEVEL SECURITY;

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
          AND lower(c.user_email) = lower(auth.jwt() ->> 'email')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.zc_messages AS m
        INNER JOIN public.zc_conversations AS c
            ON c.id = m.conversation_id
        WHERE m.id = zc_message_attachments.message_id
          AND lower(c.user_email) = lower(auth.jwt() ->> 'email')
    )
);

COMMIT;
