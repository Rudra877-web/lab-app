-- ============================================================
-- Laboratory Company & Employee Management System
-- Supabase PostgreSQL Schema (simple version - single fixed login,
-- no Supabase Auth users; the app's anon key does everything)
-- Run this whole file once in Supabase SQL Editor.
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- COMPANIES
-- ------------------------------------------------------------
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  details text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- EMPLOYEE / WORKER RECORDS - fields match the handwritten form
-- ------------------------------------------------------------
create table if not exists public.employee_records (
  id uuid primary key default gen_random_uuid(),
  record_date date not null default current_date,
  full_name text not null,
  gender text check (gender in ('Male','Female','Other')),
  age int check (age between 0 and 120),
  height numeric(6,2),
  weight numeric(6,2),
  chest numeric(6,2),
  abdomen numeric(6,2),
  waist numeric(6,2),
  hips numeric(6,2),
  rest text,
  tpa text,
  company_id uuid references public.companies(id) on delete restrict,
  service_type text,
  visit_type text default 'Center Visit',
  branch_number text,
  proposal_number text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Migration for existing database tables:
alter table public.employee_records add column if not exists visit_type text default 'Center Visit';
alter table public.employee_records add column if not exists branch_number text;
alter table public.employee_records add column if not exists proposal_number text;

create index if not exists idx_records_company on public.employee_records(company_id);
create index if not exists idx_records_date on public.employee_records(record_date);
create index if not exists idx_records_name on public.employee_records(full_name);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_records_updated on public.employee_records;
create trigger trg_records_updated
  before update on public.employee_records
  for each row execute procedure public.set_updated_at();

-- ------------------------------------------------------------
-- ROW LEVEL SECURITY
-- IMPORTANT: this app's login is a simple hardcoded check inside the
-- React app (src/authConfig.js) - it is NOT Supabase Auth. That means
-- Supabase itself cannot tell who is logged in, so these policies
-- allow full read/write to anyone holding your anon key. This is fine
-- for a small trusted team on a private link, but it is NOT the same
-- level of security as real per-user database authentication.
-- If you later want real per-user security, ask to upgrade to
-- Supabase Auth (email/password per employee) and RLS tied to auth.uid().
-- ------------------------------------------------------------
alter table public.companies enable row level security;
alter table public.employee_records enable row level security;

drop policy if exists "companies_all" on public.companies;
create policy "companies_all" on public.companies for all using (true) with check (true);

drop policy if exists "records_all" on public.employee_records;
create policy "records_all" on public.employee_records for all using (true) with check (true);

-- ------------------------------------------------------------
-- TAT LIST (separate feature - does not touch companies /
-- employee_records at all). Each TAT has one of two Highlight
-- Care selections, independently toggleable.
-- ------------------------------------------------------------
create table if not exists public.tat_list (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  highlight_care text check (highlight_care in ('1','2')),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_tat_list_updated on public.tat_list;
create trigger trg_tat_list_updated
  before update on public.tat_list
  for each row execute procedure public.set_updated_at();

alter table public.tat_list enable row level security;
drop policy if exists "tat_list_all" on public.tat_list;
create policy "tat_list_all" on public.tat_list for all using (true) with check (true);

insert into public.tat_list (name, sort_order, highlight_care) values
  ('Health India TPA', 1, '2'),
  ('MD India', 2, null),
  ('Visit Health', 3, '2'),
  ('Ericson', 4, '2'),
  ('Wel Next', 5, null),
  ('Medi Buddy', 6, null),
  ('eCure.com', 7, null),
  ('Get Visit', 8, null),
  ('Call Medi Life', 9, null),
  ('Call Medi Health', 10, null)
on conflict (name) do nothing;

-- Update legacy name if previously seeded as 'Health India TAT'
update public.tat_list set name = 'Health India TPA' where name = 'Health India TAT';
update public.employee_records set tpa = replace(tpa, 'Health India TAT', 'Health India TPA') where tpa like '%Health India TAT%';

-- If tat_list already existed from an earlier run, make sure these three
-- are set to Highlight Care 2 as requested (safe to re-run any time).
update public.tat_list set highlight_care = '2'
  where name in ('Health India TPA', 'Visit Health', 'Ericson');

-- ------------------------------------------------------------
-- SEED DATA - company / TPA list from your handwritten notes.
-- Edit or delete any of these any time from the Companies page.
-- ------------------------------------------------------------
insert into public.companies (name) values
  ('TATA AIA Life'), ('TATA General'), ('Bajaj Life'), ('Bajaj General'),
  ('Axis Max Life'), ('LIC of India'), ('Bharti AXA Life Insurance'),
  ('SBI Life'), ('SBI General'), ('India First Life'), ('ICICI Life'),
  ('Canara HSBC Life'), ('Ageas Life'), ('Star Union'), ('Aditya Birla'),
  ('Aditya Life'), ('Shri Ram Life'), ('HDFC Life'), ('PNB MetLife'),
  ('TATA Vitality'), ('Universal Sompo'), ('Bandhan Life'), ('Generali Central'),
  ('OPD'), ('Revival'), ('Aviva Life'), ('Reliance Life'), ('Acko Life'), ('Acko General'),
  ('Extra Life'), ('Kotak Life')
on conflict (name) do nothing;
