-- -----------------------------------------------------------------------------
-- 1. AI PROVIDERS
-- -----------------------------------------------------------------------------
INSERT INTO public.zc_agent_providers (id, name)
VALUES
  ('openai', 'OpenAI'),
  ('anthropic', 'Anthropic'),
  ('google', 'Google Gemini'),
  ('groq', 'Groq'),
  ('deepseek', 'DeepSeek')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name;

-- -----------------------------------------------------------------------------
-- 2. AI MODELS
-- Keep legacy rows for compatibility; add newer model IDs alongside them.
-- Verify availability and API access with each provider before production use.
-- -----------------------------------------------------------------------------
INSERT INTO public.zc_agent_models (id, name, provider_id)
VALUES
  -- OpenAI: current general-purpose models
  ('gpt-6-astra', 'GPT-6 Astra', 'openai'),
  ('gpt-6.1-sol', 'GPT-6.1 Sol', 'openai'),
  ('gpt-6-luna', 'GPT-6 Luna', 'openai'),
  ('gpt-5.6-sol', 'GPT-5.6 Sol', 'openai'),
  ('gpt-5.6-terra', 'GPT-5.6 Terra', 'openai'),
  ('gpt-5.6-luna', 'GPT-5.6 Luna', 'openai'),
  ('gpt-5.5', 'GPT-5.5', 'openai'),
  ('gpt-oss-120b', 'GPT-OSS 120B', 'openai'),
  ('gpt-oss-20b', 'GPT-OSS 20B', 'openai'),

  -- OpenAI: legacy models retained for existing configurations
  ('gpt-4o', 'GPT-4o (Legacy)', 'openai'),
  ('gpt-4o-mini', 'GPT-4o Mini (Legacy)', 'openai'),
  ('o1-preview', 'o1 Preview (Legacy)', 'openai'),
  ('o1-mini', 'o1 Mini (Legacy)', 'openai'),

  -- Anthropic Claude
  ('claude-opus-4-8', 'Claude Opus 4.8', 'anthropic'),
  ('claude-opus-4-7', 'Claude Opus 4.7', 'anthropic'),
  ('claude-opus-4-6', 'Claude Opus 4.6', 'anthropic'),
  ('claude-sonnet-4-6', 'Claude Sonnet 4.6', 'anthropic'),
  ('claude-sonnet-4-5', 'Claude Sonnet 4.5', 'anthropic'),
  ('claude-haiku-4-5', 'Claude Haiku 4.5', 'anthropic'),
  ('claude-3-5-sonnet-20241022', 'Claude 3.5 Sonnet (Legacy)', 'anthropic'),
  ('claude-3-haiku-20240307', 'Claude 3 Haiku (Legacy)', 'anthropic'),
  ('claude-3-opus-20240229', 'Claude 3 Opus (Legacy)', 'anthropic'),

  -- Google Gemini
  ('gemini-4-argon', 'Gemini 4 Argon', 'google'),
  ('gemini-3.8-flash', 'Gemini 3.8 Flash', 'google'),
  ('gemini-3.7-flash', 'Gemini 3.7 Flash', 'google'),
  ('gemini-3.6-flash', 'Gemini 3.6 Flash', 'google'),
  ('gemini-3.5-flash', 'Gemini 3.5 Flash', 'google'),
  ('gemini-3.5-flash-lite', 'Gemini 3.5 Flash-Lite', 'google'),
  ('gemini-3.1-flash-lite', 'Gemini 3.1 Flash-Lite', 'google'),
  ('gemini-2.5-pro', 'Gemini 2.5 Pro (Legacy)', 'google'),
  ('gemini-2.5-flash', 'Gemini 2.5 Flash (Legacy)', 'google'),
  ('gemini-1.5-pro', 'Gemini 1.5 Pro (Legacy)', 'google'),
  ('gemini-1.5-flash', 'Gemini 1.5 Flash (Legacy)', 'google'),

  -- GroqCloud hosted models
  ('openai/gpt-oss-120b', 'GPT-OSS 120B (Groq)', 'groq'),
  ('openai/gpt-oss-20b', 'GPT-OSS 20B (Groq)', 'groq'),
  ('qwen/qwen3.8-27b', 'Qwen 3.8 27B (Groq)', 'groq'),
  ('minimaxai/minimax-m2.7', 'MiniMax M2.7 (Groq)', 'groq'),
  ('meta-models/muse-spark-open', 'Muse Spark Open (Groq)', 'groq'),
  ('llama-3.3-70b-versatile', 'Llama 3.3 70B (Groq; legacy/availability dependent)', 'groq'),
  ('mixtral-8x7b-32768', 'Mixtral 8x7B (Groq; legacy/availability dependent)', 'groq'),

  -- DeepSeek API
  ('deepseek-v4-pro', 'DeepSeek V4 Pro', 'deepseek'),
  ('deepseek-flash', 'DeepSeek V4.1 Flash', 'deepseek'),
  ('deepseek-v4-flash', 'DeepSeek V4 Flash (compatibility alias)', 'deepseek'),
  ('deepseek-chat', 'DeepSeek Chat (legacy alias)', 'deepseek'),
  ('deepseek-reasoner', 'DeepSeek Reasoner (legacy alias)', 'deepseek'),
  ('deepseek-v3.2', 'DeepSeek V3.2', 'deepseek')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  provider_id = EXCLUDED.provider_id;
