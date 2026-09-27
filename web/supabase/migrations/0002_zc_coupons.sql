-- Zero Council coupons, accounts and plan grants.
--
-- Shared contract: whoever provisions the Supabase project applies this file, in order,
-- after 0001_zc_orders.sql. Do not hand-create these tables in the dashboard.
--
-- Apply with the Supabase CLI (`supabase db push`) or paste into the dashboard SQL Editor.
-- DDL cannot run through PostgREST or the JS client — see 0001 for why.
--
-- ---------------------------------------------------------------------------------------------
-- AUTH IS NOT HERE. Login belongs to a colleague working on the platform. This migration owns
-- only the ROLE, because the admin surface is this repo's work. The contract is one function:
-- web/src/lib/currentUser.ts returns { id, email } or null. Everything below keys off `email`.
-- ---------------------------------------------------------------------------------------------
--
-- FIRST ADMIN IS A MANUAL SEED, and that is deliberate. It is the trust root: if the code could
-- promote anyone to admin, so would anyone who reached it. Run this once, by hand, with your own
-- address — after that, any existing admin promotes the next one from the admin page:
--
--   insert into zc_users (email, role) values ('you@example.com', 'admin')
--   on conflict (email) do nothing;
--
-- No foreign keys on purpose. A coupon may be deleted from the admin page even after it was
-- redeemed, and the redemption rows must survive as the usage record. With an FK, delete would
-- either fail or cascade away the audit trail. Codes are plain text and are snapshotted onto the
-- redemption, so history survives deletion and a recreated code starts a fresh count.

-- ---------------------------------------------------------------------------------------------
-- Accounts
-- ---------------------------------------------------------------------------------------------
create table if not exists public.zc_users (
  email      text        primary key,
  role       text        not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now()
);

comment on table zc_users is
  'Identity is owned by the platform login; this table owns only the admin role. Rows are created with role=user on first authenticated request — never with admin.';

create index if not exists zc_users_role_idx on zc_users (role);

-- ---------------------------------------------------------------------------------------------
-- Orders gain the buyer
--
-- The payOS webhook arrives with no session: it is a server-to-server callback and has no idea
-- who paid. Without this column an order cannot be connected to an account, so a confirmed
-- payment would have nobody to grant a plan to — the paid-but-no-access hole. Added here rather
-- than to 0001 so that file stays the order contract as written, and so this still applies
-- cleanly if 0001 has already been run.
-- ---------------------------------------------------------------------------------------------
alter table public.zc_orders add column if not exists user_email text;
create index if not exists zc_orders_user_idx on zc_orders (user_email);

-- The coupon is recorded on the order rather than redeemed at checkout, so an abandoned payment
-- does not burn the account's single use. The webhook has no session and no coupon code in its
-- payload, so this is the only way it can know which code to redeem when the payment confirms.
alter table public.zc_orders add column if not exists coupon_code text;
alter table public.zc_orders add column if not exists coupon_percent integer;

-- ---------------------------------------------------------------------------------------------
-- Coupons
--
-- `percent` is the only discount shape: the brief was "coupon always discounts by %", so there
-- is no flat-amount column. A 100% coupon is legal and means "grant without charging" — it skips
-- payOS entirely rather than creating a zero-value transaction.
--
-- `expires_at` NULL = never expires. `max_total_redemptions` NULL = unlimited. Both are the two
-- configurable fields the admin page exposes. A per-user limit is deliberately NOT a column: the
-- rule is one redemption per account per code, which the unique constraint below already makes
-- unbreakable. A configurable per-user cap would need a counter checked inside a database
-- function, because a read-then-insert in application code races.
-- ---------------------------------------------------------------------------------------------
create table if not exists public.zc_coupons (
  code                  text        primary key,
  percent               integer     not null check (percent between 1 and 100),
  expires_at            timestamptz,
  max_total_redemptions integer     check (max_total_redemptions is null or max_total_redemptions > 0),
  active                boolean     not null default true,
  note                  text,
  created_by            text,
  created_at            timestamptz not null default now()
);

comment on table zc_coupons is
  'Discount codes, percentage only. NULL expires_at = never expires; NULL max_total_redemptions = unlimited.';

create index if not exists zc_coupons_active_idx on zc_coupons (active, code);

-- ---------------------------------------------------------------------------------------------
-- Redemptions — one row per account per code, enforced by the database
--
-- The composite primary key IS the "one code, one use per account" rule. It is a key, not a
-- count, so two simultaneous redemptions of the same code by the same account cannot both
-- succeed: the second insert collides. A read-then-insert in application code would race.
-- ---------------------------------------------------------------------------------------------
create table if not exists public.zc_coupon_redemptions (
  coupon_code  text        not null,
  user_email   text        not null,
  percent      integer     not null,
  order_code   bigint,
  redeemed_at  timestamptz not null default now(),
  primary key (coupon_code, user_email)
);

comment on table zc_coupon_redemptions is
  'Coupon usage. Composite primary key makes a second redemption of the same code by the same account impossible.';

create index if not exists zc_redemptions_code_idx on zc_coupon_redemptions (coupon_code);
create index if not exists zc_redemptions_user_idx on zc_coupon_redemptions (user_email);

-- ---------------------------------------------------------------------------------------------
-- Plan grants — the subscription record
--
-- One row per grant, never updated in place, so the history of what was bought and when stays
-- intact. Expiry is computed at read time (the query in web/src/lib/store/grants.ts): the
-- effective plan is the unexpired grant with the latest expires_at, and no such grant means the
-- free plan. No cron, no job, nothing to keep alive.
--
-- A renewal stacks rather than overwrites: starts_at is max(now, current expires_at) and
-- expires_at is starts_at plus one month, so paying a few days early does not lose those days.
-- ---------------------------------------------------------------------------------------------
create table if not exists public.zc_grants (
  id         bigint       generated always as identity primary key,
  user_email text         not null,
  plan_id    text         not null,
  source     text         not null check (source in ('PAYOS', 'COUPON')),
  order_code bigint,
  percent    integer,
  starts_at  timestamptz  not null,
  expires_at timestamptz  not null
);

comment on table zc_grants is
  'One row per granted month of a plan. Effective plan is the unexpired grant with the latest expires_at; no unexpired grant means free.';

create index if not exists zc_grants_user_idx on zc_grants (user_email, expires_at desc);

-- ---------------------------------------------------------------------------------------------
-- Row Level Security
--
-- Every table here is reached only with the service-role key from the server, which bypasses RLS.
-- Enabling RLS with no policies locks out anon and authenticated clients completely. That matters
-- most on zc_users: the admin role must not be readable or writable from the browser, or the
-- admin page would be a suggestion rather than a boundary.
-- ---------------------------------------------------------------------------------------------
alter table zc_users enable row level security;
alter table zc_coupons enable row level security;
alter table zc_coupon_redemptions enable row level security;
alter table zc_grants enable row level security;
