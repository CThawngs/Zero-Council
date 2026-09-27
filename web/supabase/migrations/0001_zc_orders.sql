-- Zero Council order store.
--
-- Shared contract: whoever provisions the Supabase project applies this file. It is the
-- only definition of the order table — do not hand-create the table in the dashboard, or
-- the columns will drift from web/src/lib/payos/orders.ts.
--
-- Apply with the Supabase CLI:
--   supabase db push
-- or paste into SQL Editor in the dashboard.
--
-- This file CANNOT be run through PostgREST or the Supabase JS client — the REST layer
-- speaks DML only, not DDL. It needs the CLI, the dashboard SQL Editor, or the Management
-- API (POST https://api.supabase.com/v1/projects/{ref}/database/query with a
-- `SUPABASE_ACCESS_TOKEN` starting `sbp_`; the service-role JWT does not work there).
--
-- Note the two names: DDL says `public.zc_orders`, the REST calls say `zc_orders` — the
-- schema is already chosen in the PostgREST URL, so a `public.` prefix there is a 404.
--
-- ponytail: one table, no accounts, no entitlements. An order records that a specific
-- sum arrived for a specific plan; it does not grant access to anything. `plan_id` stays a
-- free-text column so adding a plan to web/src/prototype/data/plans.ts never needs a
-- migration here.

create table if not exists public.zc_orders (
  order_code   bigint       primary key,
  plan_id      text         not null,
  amount_vnd   integer      not null,
  amount_usd   text         not null,
  status       text         not null
                             check (status in ('PENDING', 'PAID', 'FAILED', 'EXPIRED')),
  created_at   timestamptz  not null default now(),
  paid_at      timestamptz,
  reference    text,
  bank_account text
);

comment on table zc_orders is
  'payOS orders. amount_vnd is copied from plans.ts at creation time and is never taken from the client request.';

-- The return page polls by orderCode; the webhook looks up by orderCode then writes status.
create index if not exists zc_orders_status_idx on zc_orders (status);
create index if not exists zc_orders_paid_at_idx on zc_orders (paid_at desc nulls last);

-- Row Level Security: this table is reached only with the service-role key from the
-- server, which bypasses RLS. Enabling RLS with no policies therefore locks out
-- anon/authenticated clients entirely, which is what we want — an order contains a
-- payment reference and must not be readable from the browser.
--
-- The service role key lives in the host's env (SUPABASE_SERVICE_ROLE_KEY). It must never
-- be exposed to a client component or committed; it bypasses every policy on this table.
alter table zc_orders enable row level security;
