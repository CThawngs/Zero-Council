-- Per-account BYOK provider keys. One row per (account, provider): accounts are isolated by
-- user_email, and every route resolves that email from the caller's session, never from input.
-- The key is AES-256-GCM encrypted server-side (see web/src/lib/crypto/providerKeys.ts); this
-- table never holds a plaintext secret. Separate from 0003's zc_users_api_keys, which ties keys
-- to a fixed model catalog row — BYOK now allows any model id the provider returns.
--
-- Apply with the Supabase CLI (`supabase db push`) or paste into the dashboard SQL Editor.

create table if not exists public.zc_provider_keys (
  user_email    text not null,
  provider      text not null check (provider in ('anthropic', 'openai')),
  model         text not null,
  encrypted_key text not null,
  updated_at    timestamptz not null default now(),
  primary key (user_email, provider)
);

comment on table public.zc_provider_keys is
  'Encrypted per-account provider keys. Read/written server-side only via the service role; RLS denies everyone else.';

alter table public.zc_provider_keys enable row level security;

-- No policy for anon/authenticated on purpose: the server route uses the service role key and
-- scopes every query by the session email. A permissive policy here would let a client read
-- another account's ciphertext by guessing an email.
