-- ============================================================
-- 0. PREPARATION: Seed standard providers and models if missing
-- Ensures FK from zc_provider_keys and zc_agents does not fail
-- ============================================================
INSERT INTO public.zc_agent_providers (id, name)
VALUES 
    ('openai', 'OpenAI', 'sk-'),
    ('anthropic', 'Anthropic', 'sk-ant'),
    ('google', 'Google', 'AIza')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

INSERT INTO public.zc_agent_models (id, name, provider_id)
VALUES
    -- OpenAI – free on chatgpt.com, BYOK for API
    ('gpt-6-luna', 'GPT-6 Luna', 'openai'),
    ('gpt-6.1-sol', 'GPT-6.1 Sol', 'openai'),
    ('gpt-6.1-terra', 'GPT-6.1 Terra', 'openai'),
    -- Anthropic – free on claude.ai, BYOK for API
    ('claude-sonnet-5.5', 'Claude Sonnet 5.5', 'anthropic'),
    ('claude-haiku-5.5', 'Claude Haiku 5.5', 'anthropic'),
    -- Google – free on AI Studio API & web
    ('gemini-3.8-flash', 'Gemini 3.8 Flash', 'google'),
    ('gemini-3.6-flash', 'Gemini 3.6 Flash', 'google'),
    ('gemini-3.5-flash-lite', 'Gemini 3.5 Flash-Lite', 'google')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    provider_id = EXCLUDED.provider_id;

