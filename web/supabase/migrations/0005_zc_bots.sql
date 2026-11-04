-- Per-account user bots. One row per bot; accounts isolated by user_email, resolved from the
-- caller's session in web/src/app/api/bots/route.ts, never from client input. A bot only points
-- at a provider+model the account has connected (enforced in the route against zc_provider_keys),
-- so a bot can never silently run on another account's key.
--
-- Apply with the Supabase CLI (`supabase db push`) or paste into the dashboard SQL Editor.

create table if not exists public.zc_bots (
  user_email  text not null,
  id          text not null,
  name        text not null check (char_length(name) between 1 and 80),
  instruction text not null check (char_length(instruction) between 1 and 4000),
  provider    text not null check (provider in ('anthropic', 'openai')),
  model       text not null check (char_length(model) between 1 and 200),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (user_email, id)
);

comment on table public.zc_bots is
  'Per-account AI bots. Read/written server-side only via the service role; RLS denies everyone else.';

alter table public.zc_bots enable row level security;

-- No policy for anon/authenticated on purpose: the server route uses the service role key and
-- scopes every query by the session email. A permissive policy here would let a client read
-- another account's bots by guessing an email.
