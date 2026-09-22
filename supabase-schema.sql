-- Run this in Supabase SQL Editor before enabling supabase-sync.js.
-- The id columns are required because the JavaScript uses upsert(..., { onConflict: 'id' }).

create table if not exists stock (
  id uuid primary key default gen_random_uuid(),
  model text not null,
  category text not null,
  subcat text,
  qty integer not null default 0,
  cost_price numeric not null default 0,
  sell_price numeric not null default 0,
  supplier text,
  created_at timestamptz not null default now()
);

create table if not exists sales (
  id uuid primary key default gen_random_uuid(),
  date date,
  model text,
  quality text,
  customer text,
  "paymentMethod" text,
  qty integer,
  cost_price numeric,
  sell_price numeric,
  created_at timestamptz not null default now()
);

create table if not exists returns (
  id uuid primary key default gen_random_uuid(),
  date date,
  model text,
  quality text,
  customer text,
  qty integer,
  reason text,
  "isExchanged" boolean default false,
  created_at timestamptz not null default now()
);

create table if not exists supplier_returns (
  id uuid primary key default gen_random_uuid(),
  date date,
  model text,
  supplier text,
  qty integer,
  reason text,
  status text,
  created_at timestamptz not null default now()
);

create table if not exists requisitions (
  id text primary key,
  date date,
  item text,
  category text,
  qty integer,
  cost numeric,
  supplier text,
  notes text,
  status text,
  created_at timestamptz not null default now()
);

-- payments may already exist for Moniepoint webhooks.
create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  datetime timestamptz,
  reference text,
  sender_name text,
  account_number text,
  amount numeric,
  status text,
  created_at timestamptz not null default now()
);
