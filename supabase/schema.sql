-- Menja i Mut Gestionale: schema iniziale. Eseguire nel SQL Editor Supabase.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null default '',
  category text not null default 'Privati' check (category in ('Privati','Pizzerie','Hotel','Ristoranti','Negozi e rivenditori','Altre attività')),
  role text not null default 'customer' check (role in ('admin','customer')),
  approval_status text not null default 'pending' check (approval_status in ('pending','approved','suspended','rejected')),
  created_at timestamptz not null default now()
);

create table if not exists public.records (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('customers','orders','products','pricelists','recipes','production','lots','inventory','fidelity','crm','finance','invoices','statistics','settings')),
  owner_id uuid references auth.users(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists records_kind_created_idx on public.records(kind, created_at desc);
create index if not exists records_owner_idx on public.records(owner_id, kind);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id,email,full_name,category)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name',''),
    case when new.raw_user_meta_data->>'category' in ('Privati','Pizzerie','Hotel','Ristoranti','Negozi e rivenditori','Altre attività') then new.raw_user_meta_data->>'category' else 'Privati' end);
  return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.records enable row level security;
revoke all on public.profiles, public.records from anon;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.records to authenticated;

create or replace function public.protect_profile_privileges()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (select auth.uid()) = old.id and (new.role <> old.role or new.approval_status <> old.approval_status) then
    raise exception 'Only an administrator can change account role or approval';
  end if;
  return new;
end; $$;
drop trigger if exists protect_profile_privileges on public.profiles;
create trigger protect_profile_privileges before update on public.profiles for each row execute procedure public.protect_profile_privileges();

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles where id=(select auth.uid()) and role='admin');
$$;
create or replace function public.is_approved_customer()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles where id=(select auth.uid()) and approval_status='approved');
$$;

drop policy if exists "profile self read" on public.profiles;
create policy "profile self read" on public.profiles for select to authenticated using (id = (select auth.uid()) or public.is_admin());
drop policy if exists "profile self update limited" on public.profiles;
drop policy if exists "admin profile management" on public.profiles;
create policy "admin profile management" on public.profiles for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "records read by role" on public.records;
create policy "records read by role" on public.records for select to authenticated using (
  public.is_admin()
  or (owner_id=(select auth.uid()) and public.is_approved_customer())
  or (kind='products' and public.is_approved_customer())
  or (kind='pricelists' and public.is_approved_customer() and (
    (nullif(payload->>'customer','') is not null and payload->>'customer'=(select coalesce(nullif(full_name,''),email) from public.profiles where id=(select auth.uid())))
    or (nullif(payload->>'customer','') is null and payload->>'category'=(select category from public.profiles where id=(select auth.uid())))
  ))
);
drop policy if exists "records insert by role" on public.records;
create policy "records insert by role" on public.records for insert to authenticated with check (
  public.is_admin()
  or (kind='orders' and owner_id=(select auth.uid()) and payload->>'status'='Da approvare'
    and payload->>'customer' = (select coalesce(nullif(full_name,''),email) from public.profiles where id=(select auth.uid()))
    and public.is_approved_customer())
);
drop policy if exists "records admin update" on public.records;
create policy "records admin update" on public.records for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "records admin delete" on public.records;
create policy "records admin delete" on public.records for delete to authenticated using (public.is_admin());

-- L'account iniziale diventa amministratore solo dopo conferma email e accesso.
-- Eseguire manualmente sostituendo l'indirizzo con quello del titolare:
-- update public.profiles set role='admin', approval_status='approved' where email='tuo-indirizzo@example.it';


-- Codici cliente progressivi e fidelity per nuove registrazioni.
create sequence if not exists public.customer_code_seq start with 29;
alter table public.profiles add column if not exists customer_code text;
alter table public.profiles add column if not exists fidelity_points integer not null default 0;
create unique index if not exists profiles_customer_code_unique on public.profiles(customer_code) where customer_code is not null;
select setval('public.customer_code_seq', greatest(28::bigint, coalesce((select max(nullif(regexp_replace(customer_code, '[^0-9]', '', 'g'), '')::bigint) from public.profiles), 0)), true);
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  customer_category text;
  next_code bigint;
begin
  customer_category := case when new.raw_user_meta_data->>'category' in ('Privati','Pizzerie','Hotel','Ristoranti','Negozi e rivenditori','Altre attività') then new.raw_user_meta_data->>'category' else 'Privati' end;
  next_code := nextval('public.customer_code_seq');
  insert into public.profiles(id,email,full_name,category,customer_code,fidelity_points)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name',''), customer_category,
    'C' || case when length(next_code::text)<3 then lpad(next_code::text,3,'0') else next_code::text end, 0);
  return new;
end; $$;
create or replace function public.allocate_customer_code()
returns text language plpgsql security definer set search_path = '' as $$
declare next_code bigint;
begin
  if (select auth.uid()) is null or not public.is_admin() then
    raise exception 'Only an administrator can allocate a manual customer code';
  end if;
  next_code := nextval('public.customer_code_seq');
  return 'C' || case when length(next_code::text)<3 then lpad(next_code::text,3,'0') else next_code::text end;
end; $$;
revoke all on function public.allocate_customer_code() from public, anon;
grant execute on function public.allocate_customer_code() to authenticated;


-- Chat privata cliente-titolare. Applicare lo schema anche ai progetti già avviati.
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  sender_role text not null check (sender_role in ('customer','admin')),
  body text not null check (length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists chat_messages_customer_created_idx on public.chat_messages(customer_id, created_at);
alter table public.chat_messages enable row level security;
revoke all on public.chat_messages from anon;
grant select, insert on public.chat_messages to authenticated;
drop policy if exists "chat participants read messages" on public.chat_messages;
create policy "chat participants read messages" on public.chat_messages for select to authenticated
using ((customer_id=(select auth.uid()) and public.is_approved_customer()) or public.is_admin());
drop policy if exists "chat participants send messages" on public.chat_messages;
create policy "chat participants send messages" on public.chat_messages for insert to authenticated
with check (sender_id=(select auth.uid()) and ((sender_role='customer' and customer_id=(select auth.uid()) and public.is_approved_customer()) or (sender_role='admin' and public.is_admin())));
