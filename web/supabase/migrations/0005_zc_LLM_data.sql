
-- -----------------------------------------------------------------------------
-- 1. AI PROVIDERS
-- -----------------------------------------------------------------------------
INSERT INTO public.zc_agent_providers (
  id,
  name,
  key_prefix,
  is_active
)
VALUES
  ('openai', 'OpenAI', 'sk-', TRUE),
  ('anthropic', 'Anthropic', 'sk-ant-', TRUE),
  ('google', 'Google Gemini', 'AIza', TRUE),
  ('groq', 'Groq', 'gsk_', FALSE),
  ('deepseek', 'DeepSeek', 'sk-', FALSE)

ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  key_prefix = EXCLUDED.key_prefix,
  is_active = EXCLUDED.is_active;


-- -----------------------------------------------------------------------------
-- 2. AI MODELS
-- -----------------------------------------------------------------------------
INSERT INTO public.zc_agent_models (
  id,
  name,
  provider_id,
  is_active
)
VALUES
  -- OpenAI: current general-purpose models
  ('gpt-6-astra', 'GPT-6 Astra', 'openai', TRUE),
  ('gpt-6.1-sol', 'GPT-6.1 Sol', 'openai', TRUE),
  ('gpt-6-luna', 'GPT-6 Luna', 'openai', TRUE),
  ('gpt-5.6-sol', 'GPT-5.6 Sol', 'openai', TRUE),
  ('gpt-5.6-terra', 'GPT-5.6 Terra', 'openai', TRUE),
  ('gpt-5.6-luna', 'GPT-5.6 Luna', 'openai', TRUE),
  ('gpt-5.5', 'GPT-5.5', 'openai', TRUE),
  ('gpt-oss-120b', 'GPT-OSS 120B', 'openai', TRUE),
  ('gpt-oss-20b', 'GPT-OSS 20B', 'openai', TRUE),

  -- OpenAI: legacy models
  ('gpt-4o', 'GPT-4o (Legacy)', 'openai', TRUE),
  ('gpt-4o-mini', 'GPT-4o Mini (Legacy)', 'openai', TRUE),
  ('o1-preview', 'o1 Preview (Legacy)', 'openai', TRUE),
  ('o1-mini', 'o1 Mini (Legacy)', 'openai', TRUE),

  -- Anthropic Claude
  ('claude-opus-4-8', 'Claude Opus 4.8', 'anthropic', TRUE),
  ('claude-opus-4-7', 'Claude Opus 4.7', 'anthropic', TRUE),
  ('claude-opus-4-6', 'Claude Opus 4.6', 'anthropic', TRUE),
  ('claude-sonnet-4-6', 'Claude Sonnet 4.6', 'anthropic', TRUE),
  ('claude-sonnet-4-5', 'Claude Sonnet 4.5', 'anthropic', TRUE),
  ('claude-haiku-4-5', 'Claude Haiku 4.5', 'anthropic', TRUE),
  ('claude-3-5-sonnet-20241022', 'Claude 3.5 Sonnet (Legacy)', 'anthropic', TRUE),
  ('claude-3-haiku-20240307', 'Claude 3 Haiku (Legacy)', 'anthropic', TRUE),
  ('claude-3-opus-20240229', 'Claude 3 Opus (Legacy)', 'anthropic', TRUE),

  -- Google Gemini
  ('gemini-4-argon', 'Gemini 4 Argon', 'google', TRUE),
  ('gemini-3.8-flash', 'Gemini 3.8 Flash', 'google', TRUE),
  ('gemini-3.7-flash', 'Gemini 3.7 Flash', 'google', TRUE),
  ('gemini-3.6-flash', 'Gemini 3.6 Flash', 'google', TRUE),
  ('gemini-3.5-flash', 'Gemini 3.5 Flash', 'google', TRUE),
  ('gemini-3.5-flash-lite', 'Gemini 3.5 Flash-Lite', 'google', TRUE),
  ('gemini-3.1-flash-lite', 'Gemini 3.1 Flash-Lite', 'google', TRUE),
  ('gemini-2.5-pro', 'Gemini 2.5 Pro (Legacy)', 'google', TRUE),
  ('gemini-2.5-flash', 'Gemini 2.5 Flash (Legacy)', 'google', TRUE),
  ('gemini-1.5-pro', 'Gemini 1.5 Pro (Legacy)', 'google', TRUE),
  ('gemini-1.5-flash', 'Gemini 1.5 Flash (Legacy)', 'google', TRUE),

  -- GroqCloud hosted models
  ('openai/gpt-oss-120b', 'GPT-OSS 120B (Groq)', 'groq', TRUE),
  ('openai/gpt-oss-20b', 'GPT-OSS 20B (Groq)', 'groq', TRUE),
  ('qwen/qwen3.8-27b', 'Qwen 3.8 27B (Groq)', 'groq', TRUE),
  ('minimaxai/minimax-m2.7', 'MiniMax M2.7 (Groq)', 'groq', TRUE),
  ('meta-models/muse-spark-open', 'Muse Spark Open (Groq)', 'groq', TRUE),
  ('llama-3.3-70b-versatile', 'Llama 3.3 70B (Groq; legacy/availability dependent)', 'groq', TRUE),
  ('mixtral-8x7b-32768', 'Mixtral 8x7B (Groq; legacy/availability dependent)', 'groq', TRUE),

  -- DeepSeek API
  ('deepseek-v4-pro', 'DeepSeek V4 Pro', 'deepseek', TRUE),
  ('deepseek-flash', 'DeepSeek V4.1 Flash', 'deepseek', TRUE),
  ('deepseek-v4-flash', 'DeepSeek V4 Flash (compatibility alias)', 'deepseek', TRUE),
  ('deepseek-chat', 'DeepSeek Chat (legacy alias)', 'deepseek', TRUE),
  ('deepseek-reasoner', 'DeepSeek Reasoner (legacy alias)', 'deepseek', TRUE),
  ('deepseek-v3.2', 'DeepSeek V3.2', 'deepseek', TRUE)

ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  provider_id = EXCLUDED.provider_id,
  is_active = EXCLUDED.is_active;
