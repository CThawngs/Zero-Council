-- Zero Council Core Schema: Agents, Conversations, Models, and Plans
-- Integrated with Supabase auth.users & full Foreign Key constraints
--
-- Shared contract: applies in order after 0001_zc_orders.sql and 0002_zc_coupons.sql.
-- Does NOT touch or rewrite existing tables/columns from 0001 and 0002.
--
-- Apply with the Supabase CLI (`supabase db push`) or paste into Supabase dashboard SQL Editor.
-- DDL cannot run through PostgREST / Supabase JS client — see 0001 for rationale.
-- ---------------------------------------------------------------------------------------------

-- ---------------------------------------------------------------------------------------------
-- 0. Adapt zc_users and integrate with auth.users
-- ---------------------------------------------------------------------------------------------
-- 0002 created zc_users with (email text primary key).
-- We ensure the table exists and attach `id uuid` referencing Supabase `auth.users(id)` with ON DELETE CASCADE.
create table if not exists public.zc_users (
  email      text        primary key,
  role       text        not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now()
);

-- Add `id` column linked to auth.users(id) if not already present
alter table public.zc_users add column if not exists id uuid unique;

-- Safely add FK to auth.users if not present
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints 
    where constraint_name = 'fk_zc_users_auth_users' and table_name = 'zc_users'
  ) then
    alter table public.zc_users 
      add constraint fk_zc_users_auth_users 
      foreign key (id) references auth.users(id) on delete cascade;
  end if;
end $$;

create index if not exists zc_users_id_idx on public.zc_users (id);

-- Optional compatibility for zc_grants: ensure `expired_at` alias exists if schema uses that name
do $$
begin
  if exists (
    select 1 from information_schema.columns 
    where table_name = 'zc_grants' and column_name = 'expires_at'
  ) and not exists (
    select 1 from information_schema.columns 
    where table_name = 'zc_grants' and column_name = 'expired_at'
  ) then
    alter table public.zc_grants add column expired_at timestamptz;
    update public.zc_grants set expired_at = expires_at where expired_at is null;
  end if;
end $$;

-- Auto-sync trigger: When a new user registers in Supabase auth.users, create or link in zc_users
create or replace function public.handle_new_auth_user()
returns trigger as $$
begin
  insert into public.zc_users (id, email, role)
  values (new.id, lower(trim(new.email)), 'user')
  on conflict (email) do update set
    id = excluded.id;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- Backfill any existing auth users to zc_users if matching by email
update public.zc_users u
set id = a.id
from auth.users a
where lower(trim(u.email)) = lower(trim(a.email)) and u.id is null;

-- ---------------------------------------------------------------------------------------------
-- 1. Subscription Plans
-- ---------------------------------------------------------------------------------------------
create table if not exists public.zc_subscription_plans (
  id          text        primary key, -- 'free', 'pro', 'ultra' matching plans.ts
  name        text        not null,
  max_agents  integer     not null default 2,
  price_vnd   integer     not null default 0,
  price_usd   text        not null default '0',
  description text
);

comment on table public.zc_subscription_plans is
  'Tier definitions matching web/src/prototype/data/plans.ts. Single source of truth for features and agent limits.';

insert into public.zc_subscription_plans (id, name, max_agents, price_vnd, price_usd, description)
values
  ('free', 'Free', 2, 0, '0', 'Starter tier with 2 active advisors'),
  ('pro', 'Pro', 4, 139000, '5.99', 'Pro council with 4 active advisors'),
  ('ultra', 'Ultra', 8, 379000, '16.99', 'Full chamber with 8 active advisors')
on conflict (id) do update set
  name = excluded.name,
  max_agents = excluded.max_agents,
  price_vnd = excluded.price_vnd,
  price_usd = excluded.price_usd;

-- ---------------------------------------------------------------------------------------------
-- 2. AI Providers and Models
-- ---------------------------------------------------------------------------------------------
create table if not exists public.zc_agent_providers (
  id   text primary key default gen_random_uuid()::text,
  name text not null
);

comment on table public.zc_agent_providers is
  'LLM Providers (e.g. OpenAI, Anthropic, Google). Text ID allows both slugs (openai) and UUIDs.';

create table if not exists public.zc_agent_models (
  id          text primary key default gen_random_uuid()::text,
  name        text not null,
  provider_id text not null,
  constraint fk_agent_models_provider foreign key (provider_id)
    references public.zc_agent_providers(id) on delete cascade
);

comment on table public.zc_agent_models is
  'Supported model configurations per provider.';

create index if not exists zc_agent_models_provider_idx on public.zc_agent_models (provider_id);

-- ---------------------------------------------------------------------------------------------
-- 3. Deliberation Frameworks
-- ---------------------------------------------------------------------------------------------
create table if not exists public.zc_frameworks (
  id                 text primary key, -- 'scenarios', 'hats', 'matrix'
  name               text not null,
  description        text,
  system_instruction text
);

comment on table public.zc_frameworks is
  'Decision frameworks powering the deliberation engine (e.g. Six Thinking Hats, Decision Matrix).';

insert into public.zc_frameworks (id, name, description, system_instruction)
values
  ('scenarios', 'Good / Normal / Bad Scenarios', 'Explore best, expected, and worst case outcomes', 'Analyze the dilemma into three distinct probability branches: good, normal, and bad.'),
  ('hats', 'Six Thinking Hats', 'De Bono thinking hats method', 'Deconstruct perspectives across analytical, emotional, critical, and optimistic lenses.'),
  ('matrix', 'Decision Matrix', 'Weighted multi-criteria decision matrix', 'Score and evaluate alternatives across explicit weighted criteria.')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------------------------
-- 4. User API Keys
-- ---------------------------------------------------------------------------------------------
create table if not exists public.zc_users_api_keys (
  id            uuid        default gen_random_uuid() primary key,
  encrypted_key text        not null,
  is_valid      boolean     not null default true,
  user_id       uuid        not null,
  model_id      text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint fk_api_keys_user foreign key (user_id)
    references public.zc_users(id) on delete cascade,
  constraint fk_api_keys_model foreign key (model_id)
    references public.zc_agent_models(id) on delete cascade
);

comment on table public.zc_users_api_keys is
  'User-provided LLM credentials, encrypted before storage.';

create index if not exists zc_users_api_keys_user_idx on public.zc_users_api_keys (user_id);
create index if not exists zc_users_api_keys_model_idx on public.zc_users_api_keys (model_id);

-- ---------------------------------------------------------------------------------------------
-- 5. Agents (Advisors / Personas)
-- ---------------------------------------------------------------------------------------------
create table if not exists public.zc_agents (
  id            uuid        default gen_random_uuid() primary key,
  archetype     text        not null,
  decision_lens text,
  system_prompt text,
  user_id       uuid, -- NULL indicates system preset persona
  model_id      text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint fk_agents_user foreign key (user_id)
    references public.zc_users(id) on delete cascade,
  constraint fk_agents_model foreign key (model_id)
    references public.zc_agent_models(id) on delete set null
);

comment on table public.zc_agents is
  'Advisors / Personas participating in council deliberations. user_id NULL designates default presets.';

create index if not exists zc_agents_user_idx on public.zc_agents (user_id);
create index if not exists zc_agents_model_idx on public.zc_agents (model_id);

-- ---------------------------------------------------------------------------------------------
-- 6. Agent Tools
-- ---------------------------------------------------------------------------------------------
create table if not exists public.zc_agent_tools (
  id         uuid    default gen_random_uuid() primary key,
  agent_id   uuid    not null,
  tool_type  text    not null,
  is_enabled boolean not null default true,
  constraint fk_agent_tools_agent foreign key (agent_id)
    references public.zc_agents(id) on delete cascade
);

comment on table public.zc_agent_tools is
  'Capabilities and tools enabled for a specific agent (e.g. web_search, calculator).';

create index if not exists zc_agent_tools_agent_idx on public.zc_agent_tools (agent_id);

-- ---------------------------------------------------------------------------------------------
-- 7. Deliberation Conversations & Participants
-- ---------------------------------------------------------------------------------------------
create table if not exists public.zc_conversations (
  id                uuid        default gen_random_uuid() primary key,
  title             text        not null,
  conversation_type text        not null default 'debate',
  max_debate_round  integer     not null default 3,
  status            text        not null default 'Active' check (status in ('Active', 'Deliberating', 'Concluded')),
  user_id           uuid        not null,
  framework_id      text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint fk_conversations_user foreign key (user_id)
    references public.zc_users(id) on delete cascade,
  constraint fk_conversations_framework foreign key (framework_id)
    references public.zc_frameworks(id) on delete set null
);

comment on table public.zc_conversations is
  'Council deliberation sessions and debate chambers.';

create index if not exists zc_conversations_user_idx on public.zc_conversations (user_id);
create index if not exists zc_conversations_framework_idx on public.zc_conversations (framework_id);

create table if not exists public.zc_participants (
  conversation_id uuid not null,
  agent_id        uuid not null,
  primary key (conversation_id, agent_id),
  constraint fk_participants_conversation foreign key (conversation_id)
    references public.zc_conversations(id) on delete cascade,
  constraint fk_participants_agent foreign key (agent_id)
    references public.zc_agents(id) on delete cascade
);

comment on table public.zc_participants is
  'Advisors assigned to participate in a specific deliberation session.';

create index if not exists zc_participants_agent_idx on public.zc_participants (agent_id);

-- ---------------------------------------------------------------------------------------------
-- 8. Messages and Attachments
-- ---------------------------------------------------------------------------------------------
create table if not exists public.zc_messages (
  id              uuid        default gen_random_uuid() primary key,
  content         text        not null,
  sender_type     text        not null check (sender_type in ('user', 'agent', 'system')),
  round_number    integer     not null default 1,
  agent_id        uuid,
  conversation_id uuid        not null,
  created_at      timestamptz not null default now(),
  constraint fk_messages_conversation foreign key (conversation_id)
    references public.zc_conversations(id) on delete cascade,
  constraint fk_messages_agent foreign key (agent_id)
    references public.zc_agents(id) on delete set null
);

comment on table public.zc_messages is
  'Individual turns and arguments exchanged during a deliberation round.';

create index if not exists zc_messages_conversation_idx on public.zc_messages (conversation_id, round_number);
create index if not exists zc_messages_agent_idx on public.zc_messages (agent_id);

create table if not exists public.zc_message_attachments (
  id         uuid   default gen_random_uuid() primary key,
  file_name  text   not null,
  file_path  text   not null,
  file_type  text,
  file_size  bigint,
  message_id uuid   not null,
  constraint fk_attachments_message foreign key (message_id)
    references public.zc_messages(id) on delete cascade
);

comment on table public.zc_message_attachments is
  'File attachments supporting a prompt or message turn.';

create index if not exists zc_message_attachments_message_idx on public.zc_message_attachments (message_id);

-- ---------------------------------------------------------------------------------------------
-- 9. Row Level Security & Policies
-- ---------------------------------------------------------------------------------------------
alter table public.zc_subscription_plans enable row level security;
alter table public.zc_agent_providers enable row level security;
alter table public.zc_agent_models enable row level security;
alter table public.zc_frameworks enable row level security;
alter table public.zc_users_api_keys enable row level security;
alter table public.zc_agents enable row level security;
alter table public.zc_agent_tools enable row level security;
alter table public.zc_conversations enable row level security;
alter table public.zc_participants enable row level security;
alter table public.zc_messages enable row level security;
alter table public.zc_message_attachments enable row level security;

-- Public read-only policies for static catalogs
drop policy if exists "Allow public read on subscription plans" on public.zc_subscription_plans;

create policy "Allow public read on subscription plans"
  on public.zc_subscription_plans for select using (true);

drop policy if exists "Allow public read on frameworks" on public.zc_frameworks;

create policy "Allow public read on frameworks"
  on public.zc_frameworks for select using (true);

drop policy if exists "Allow public read on providers and models" on public.zc_agent_providers;

create policy "Allow public read on providers and models"
  on public.zc_agent_providers for select using (true);

drop policy if exists "Allow public read on models" on public.zc_agent_models;

create policy "Allow public read on models"
  on public.zc_agent_models for select using (true);

-- User-scoped policies matching Supabase Auth session (auth.uid())
drop policy if exists "Users can read/manage their own profile" on public.zc_users;

create policy "Users can read/manage their own profile"
  on public.zc_users for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Users can manage their own API keys" on public.zc_users_api_keys;

create policy "Users can manage their own API keys"
  on public.zc_users_api_keys for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can read system presets or own agents" on public.zc_agents;

create policy "Users can read system presets or own agents"
  on public.zc_agents for select
  using (user_id is null or auth.uid() = user_id);

drop policy if exists "Users can modify their own custom agents" on public.zc_agents;

create policy "Users can modify their own custom agents"
  on public.zc_agents for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can manage conversations they own" on public.zc_conversations;

create policy "Users can manage conversations they own"
  on public.zc_conversations for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can manage participants of their conversations" on public.zc_participants;

create policy "Users can manage participants of their conversations"
  on public.zc_participants for all
  using (
    exists (
      select 1 from public.zc_conversations c
      where c.id = zc_participants.conversation_id and c.user_id = auth.uid()
    )
  );

drop policy if exists "Users can view and write messages in their conversations" on public.zc_messages;

create policy "Users can view and write messages in their conversations"
  on public.zc_messages for all
  using (
    exists (
      select 1 from public.zc_conversations c
      where c.id = zc_messages.conversation_id and c.user_id = auth.uid()
    )
  );

drop policy if exists "Users can manage attachments in their conversation messages" on public.zc_message_attachments;

create policy "Users can manage attachments in their conversation messages"
  on public.zc_message_attachments for all
  using (
    exists (
      select 1 from public.zc_messages m
      join public.zc_conversations c on c.id = m.conversation_id
      where m.id = zc_message_attachments.message_id and c.user_id = auth.uid()
    )
  );
