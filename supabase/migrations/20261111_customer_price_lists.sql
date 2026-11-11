-- Menja i Mut: listini multipli e assegnazione per singolo cliente.
-- Eseguire una sola volta nel SQL Editor di Supabase.
alter table public.profiles add column if not exists price_list_id uuid;
drop policy if exists "records read by role" on public.records;
create policy "records read by role" on public.records for select to authenticated using (
  public.is_admin()
  or (owner_id=(select auth.uid()) and public.is_approved_customer())
  or (kind='orders' and public.is_approved_customer() and payload->>'customer_code'=(select customer_code from public.profiles where id=(select auth.uid())))
  or (kind='products' and public.is_approved_customer())
  or (kind='pricelists' and public.is_approved_customer() and (
    payload->>'id'=(select price_list_id::text from public.profiles where id=(select auth.uid()))
    or (nullif(payload->>'customer','') is not null and payload->>'customer'=(select coalesce(nullif(full_name,''),email) from public.profiles where id=(select auth.uid())))
    or (nullif(payload->>'customer','') is null and payload->>'category'=(select category from public.profiles where id=(select auth.uid())))
  ))
);
