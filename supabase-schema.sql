-- Project time tracker / Picfactory
-- A coller dans Supabase > SQL Editor, puis Run.
-- Ce script peut etre relance sans casser les tables existantes.

create extension if not exists pgcrypto;

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  contact text default '',
  email text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid references public.clients(id) on delete cascade,
  name text not null,
  price numeric default 0,
  target_rate numeric default 120,
  quotas jsonb not null default '{}'::jsonb,
  sessions jsonb not null default '[]'::jsonb,
  expenses jsonb not null default '[]'::jsonb,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.clients
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists name text,
  add column if not exists contact text default '',
  add column if not exists email text default '',
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.projects
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists client_id uuid references public.clients(id) on delete cascade,
  add column if not exists name text,
  add column if not exists price numeric default 0,
  add column if not exists target_rate numeric default 120,
  add column if not exists quotas jsonb not null default '{}'::jsonb,
  add column if not exists sessions jsonb not null default '[]'::jsonb,
  add column if not exists expenses jsonb not null default '[]'::jsonb,
  add column if not exists status text not null default 'active',
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.clients
  alter column name set not null,
  alter column contact set default '',
  alter column email set default '',
  alter column created_at set default now(),
  alter column updated_at set default now();

alter table public.projects
  alter column price set default 0,
  alter column target_rate set default 120,
  alter column quotas set default '{}'::jsonb,
  alter column sessions set default '[]'::jsonb,
  alter column expenses set default '[]'::jsonb,
  alter column status set default 'active',
  alter column created_at set default now(),
  alter column updated_at set default now();

-- Si une ancienne version a cree des projets sans client_id,
-- on cree un client par utilisateur pour pouvoir renforcer la relation.
insert into public.clients (user_id, name, contact, email)
select distinct p.user_id, 'Client non renseigne', '', ''
from public.projects p
where p.user_id is not null
  and p.client_id is null
  and not exists (
    select 1
    from public.clients c
    where c.user_id = p.user_id
      and c.name = 'Client non renseigne'
  );

update public.projects p
set client_id = c.id
from public.clients c
where p.client_id is null
  and p.user_id = c.user_id
  and c.name = 'Client non renseigne';

alter table public.clients
  alter column user_id set not null;

alter table public.projects
  alter column user_id set not null,
  alter column client_id set not null,
  alter column name set not null,
  alter column quotas set not null,
  alter column sessions set not null,
  alter column expenses set not null,
  alter column status set not null;

create index if not exists clients_user_id_idx on public.clients(user_id);
create index if not exists projects_user_id_idx on public.projects(user_id);
create index if not exists projects_client_id_idx on public.projects(client_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists clients_set_updated_at on public.clients;
create trigger clients_set_updated_at
before update on public.clients
for each row
execute function public.set_updated_at();

drop trigger if exists projects_set_updated_at on public.projects;
create trigger projects_set_updated_at
before update on public.projects
for each row
execute function public.set_updated_at();

alter table public.clients enable row level security;
alter table public.projects enable row level security;
alter table public.clients force row level security;
alter table public.projects force row level security;

drop policy if exists "clients_select_own" on public.clients;
drop policy if exists "clients_insert_own" on public.clients;
drop policy if exists "clients_update_own" on public.clients;
drop policy if exists "clients_delete_own" on public.clients;
drop policy if exists "projects_select_own" on public.projects;
drop policy if exists "projects_insert_own" on public.projects;
drop policy if exists "projects_update_own" on public.projects;
drop policy if exists "projects_delete_own" on public.projects;

create policy "clients_select_own"
  on public.clients for select
  using (auth.uid() = user_id);

create policy "clients_insert_own"
  on public.clients for insert
  with check (auth.uid() = user_id);

create policy "clients_update_own"
  on public.clients for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "clients_delete_own"
  on public.clients for delete
  using (auth.uid() = user_id);

create policy "projects_select_own"
  on public.projects for select
  using (auth.uid() = user_id);

create policy "projects_insert_own"
  on public.projects for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.clients
      where clients.id = projects.client_id
        and clients.user_id = auth.uid()
    )
  );

create policy "projects_update_own"
  on public.projects for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.clients
      where clients.id = projects.client_id
        and clients.user_id = auth.uid()
    )
  );

create policy "projects_delete_own"
  on public.projects for delete
  using (auth.uid() = user_id);
